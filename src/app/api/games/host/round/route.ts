import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, broadcastEvents } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { GAME_CHANNEL, GAME_EVENTS } from "@/src/lib/games/channel";
import { invalidateGameState, loadGameState } from "@/src/lib/games/service";
import { isDisabled } from "@/src/lib/games/questions";
import { DEFAULT_ROUND_CONFIG, type RoundConfig } from "@/src/lib/games/types";

/**
 * Host controls: Start → Lock → Reveal → Next.
 *
 * Each press is one database write plus one broadcast. The broadcast is a
 * nudge, not the truth — every client also polls `/api/games/state`, so a
 * missed message costs a beat rather than desynchronising the room.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "start" | "lock" | "reveal" | "next" | "end";

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, roundId } = (await request.json()) as {
        action: Action;
        roundId?: string;
    };

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.session)
        return NextResponse.json(
            { error: "No live session. Start one first." },
            { status: 409 }
        );

    const sessionId = state.session.id;
    const current = state.round;

    switch (action) {
        case "start": {
            const target = roundId ?? current?.id;
            if (!target)
                return NextResponse.json(
                    { error: "No round selected." },
                    { status: 409 }
                );

            const { data: round } = await supabase
                .from("game_rounds")
                .select("id, config")
                .eq("id", target)
                .maybeSingle();
            if (!round)
                return NextResponse.json({ error: "Unknown round" }, { status: 404 });

            if (isDisabled(round.config))
                return NextResponse.json(
                    { error: "That question is disabled — enable it first." },
                    { status: 409 }
                );

            const config = {
                ...DEFAULT_ROUND_CONFIG,
                ...(round.config ?? {}),
            } as RoundConfig;

            // Absolute timestamps, set once here. Every screen derives its own
            // countdown from ends_at, so nothing drifts if a device gets the
            // message late.
            const startsAt = new Date();
            const endsAt = new Date(
                startsAt.getTime() + config.durationSeconds * 1000
            );

            await supabase
                .from("game_rounds")
                .update({
                    status: "active",
                    starts_at: startsAt.toISOString(),
                    ends_at: endsAt.toISOString(),
                })
                .eq("id", target);

            await supabase
                .from("game_sessions")
                .update({ current_round_id: target })
                .eq("id", sessionId);
            break;
        }

        case "lock":
        case "reveal": {
            if (!current)
                return NextResponse.json({ error: "No active round." }, { status: 409 });
            await supabase
                .from("game_rounds")
                .update({ status: action === "lock" ? "locked" : "revealed" })
                .eq("id", current.id);
            break;
        }

        case "next": {
            if (current) {
                await supabase
                    .from("game_rounds")
                    .update({ status: "ended" })
                    .eq("id", current.id);
            }

            // Fetch the tail of the run of show rather than just the next row,
            // so disabled questions are skipped over instead of stalling the
            // host on a round they can't start.
            const { data: upcoming } = await supabase
                .from("game_rounds")
                .select("id, config")
                .eq("session_id", sessionId)
                .gt("order_index", current?.orderIndex ?? -1)
                .order("order_index", { ascending: true });

            const nextRound = (upcoming ?? []).find((r) => !isDisabled(r.config));

            await supabase
                .from("game_sessions")
                .update({ current_round_id: nextRound?.id ?? null })
                .eq("id", sessionId);
            break;
        }

        case "end": {
            if (current) {
                await supabase
                    .from("game_rounds")
                    .update({ status: "ended" })
                    .eq("id", current.id);
            }
            await supabase
                .from("game_sessions")
                .update({ status: "ended", current_round_id: null })
                .eq("id", sessionId);
            break;
        }

        default:
            return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    invalidateGameState();
    const next = await loadGameState(supabase);

    // Best-effort — the poll loop is the guarantee, this is just the fast path.
    broadcastEvents(GAME_CHANNEL, [
        { event: GAME_EVENTS.ROUND_UPDATE, payload: { version: next.version } },
    ]).catch(() => {});

    return NextResponse.json({ success: true, state: next });
}
