import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, broadcastEvents } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { invalidateGameState, loadGameState } from "@/src/lib/games/service";
import { GAME_CHANNEL, GAME_EVENTS } from "@/src/lib/games/channel";

/**
 * Running the buzzer: open a prompt, clear it, or move to the next one.
 *
 * "Open" is the moment the race starts — it stamps `opened_at`, which is the
 * origin every reaction time is measured from. Nothing before that stamp can be
 * buzzed, so the button genuinely cannot be jumped.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "open" | "close" | "reset" | "next" | "prev";

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, promptId } = (await request.json()) as {
        action: Action;
        promptId?: string;
    };

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.round || state.round.type !== "buzzer")
        return NextResponse.json(
            { error: "The buzzer round isn't the current round." },
            { status: 409 }
        );

    const roundId = state.round.id;

    const { data: roundRow } = await supabase
        .from("game_rounds")
        .select("config")
        .eq("id", roundId)
        .maybeSingle();
    const roundConfig = (roundRow?.config ?? {}) as Record<string, unknown>;

    /** Point the round at a prompt; this is what "current" means. */
    const setCurrent = (id: string) =>
        supabase
            .from("game_rounds")
            .update({ config: { ...roundConfig, currentPromptId: id } })
            .eq("id", roundId);

    const { data: prompts } = await supabase
        .from("buzzer_prompts")
        .select("id, order_index, opened_at")
        .eq("round_id", roundId)
        .order("order_index", { ascending: true });

    const list = prompts ?? [];
    if (list.length === 0)
        return NextResponse.json({ error: "No prompts yet." }, { status: 409 });

    const currentId = state.buzzer?.promptId ?? list[0].id;
    const currentIndex = list.findIndex((p) => p.id === currentId);

    switch (action) {
        case "open": {
            const target = promptId ?? currentId;

            // Clearing any stale presses means re-opening a prompt is always a
            // clean race rather than inheriting an earlier one.
            await supabase.from("buzzer_presses").delete().eq("prompt_id", target);
            await supabase
                .from("buzzer_prompts")
                .update({ opened_at: new Date().toISOString() })
                .eq("id", target);
            await setCurrent(target);
            break;
        }

        case "close": {
            await supabase
                .from("buzzer_prompts")
                .update({ opened_at: null })
                .eq("id", currentId);
            break;
        }

        case "reset": {
            await supabase.from("buzzer_presses").delete().eq("prompt_id", currentId);
            await supabase
                .from("buzzer_prompts")
                .update({ opened_at: null })
                .eq("id", currentId);
            break;
        }

        case "next":
        case "prev": {
            const step = action === "next" ? 1 : -1;
            const target = list[currentIndex + step];
            if (!target)
                return NextResponse.json(
                    {
                        error:
                            action === "next"
                                ? "That was the last prompt."
                                : "Already on the first prompt.",
                    },
                    { status: 409 }
                );

            // Close the one we're leaving so it can't still be buzzed, and
            // leave the new one shut until the host opens it deliberately.
            await supabase
                .from("buzzer_prompts")
                .update({ opened_at: null })
                .eq("id", currentId);
            await supabase
                .from("buzzer_prompts")
                .update({ opened_at: null })
                .eq("id", target.id);
            await setCurrent(target.id);
            break;
        }

        default:
            return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    invalidateGameState();
    const next = await loadGameState(supabase);

    broadcastEvents(GAME_CHANNEL, [
        { event: GAME_EVENTS.ROUND_UPDATE, payload: { version: next.version } },
    ]).catch(() => {});

    return NextResponse.json({ success: true, state: next });
}
