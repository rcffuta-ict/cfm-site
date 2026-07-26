import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { getCfmEvent } from "@/src/lib/event";
import { invalidateGameState } from "@/src/lib/games/service";
import {
    DEFAULT_BUZZER_CONFIG,
    parseBuzzerConfig,
    validatePrompts,
} from "@/src/lib/games/buzzer";
import { DEFAULT_ROUND_CONFIG } from "@/src/lib/games/types";

/**
 * Authoring the buzzer round: the list of prompts and how many places score.
 *
 * One buzzer round per session, holding many prompts — the host opens them one
 * at a time, which matches how a quizmaster actually works through a list.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function liveSession(supabase: ReturnType<typeof getAdminClient>) {
    const event = await getCfmEvent(supabase);
    if (!event) return null;
    const { data } = await supabase
        .from("game_sessions")
        .select("id, current_round_id")
        .eq("event_id", event.id)
        .eq("status", "live")
        .maybeSingle();
    return data ?? null;
}

export async function GET() {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getAdminClient();
    const session = await liveSession(supabase);
    if (!session) return NextResponse.json({ round: null });

    const { data: round } = await supabase
        .from("game_rounds")
        .select("id, status, order_index, config")
        .eq("session_id", session.id)
        .eq("type", "buzzer")
        .maybeSingle();

    if (!round) return NextResponse.json({ round: null });

    const { data: prompts } = await supabase
        .from("buzzer_prompts")
        .select("id, prompt_text, order_index, opened_at")
        .eq("round_id", round.id)
        .order("order_index", { ascending: true });

    const ids = (prompts ?? []).map((p) => p.id);
    const pressCounts = new Map<string, number>();
    if (ids.length > 0) {
        const { data: presses } = await supabase
            .from("buzzer_presses")
            .select("prompt_id")
            .in("prompt_id", ids);
        for (const p of presses ?? [])
            pressCounts.set(p.prompt_id, (pressCounts.get(p.prompt_id) ?? 0) + 1);
    }

    return NextResponse.json({
        round: {
            id: round.id,
            status: round.status,
            orderIndex: round.order_index,
            config: parseBuzzerConfig(round.config),
            isCurrent: session.current_round_id === round.id,
            prompts: (prompts ?? []).map((p) => ({
                id: p.id,
                text: p.prompt_text,
                orderIndex: p.order_index,
                open: !!p.opened_at,
                presses: pressCounts.get(p.id) ?? 0,
            })),
        },
    });
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
        prompts?: string[];
        scoringPlaces?: number;
        basePoints?: number;
    };

    const prompts = (Array.isArray(body.prompts) ? body.prompts : [])
        .map((p) => String(p).trim())
        .filter(Boolean);

    const invalid = validatePrompts(prompts);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const config = parseBuzzerConfig({
        scoringPlaces: body.scoringPlaces ?? DEFAULT_BUZZER_CONFIG.scoringPlaces,
        basePoints: body.basePoints ?? DEFAULT_BUZZER_CONFIG.basePoints,
    });

    const supabase = getAdminClient();
    const session = await liveSession(supabase);
    if (!session)
        return NextResponse.json(
            { error: "No live session — create one first." },
            { status: 409 }
        );

    let { data: round } = await supabase
        .from("game_rounds")
        .select("id")
        .eq("session_id", session.id)
        .eq("type", "buzzer")
        .maybeSingle();

    if (!round) {
        const { data: last } = await supabase
            .from("game_rounds")
            .select("order_index")
            .eq("session_id", session.id)
            .order("order_index", { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data: created, error } = await supabase
            .from("game_rounds")
            .insert({
                session_id: session.id,
                type: "buzzer",
                status: "pending",
                order_index: (last?.order_index ?? -1) + 1,
                config: { ...DEFAULT_ROUND_CONFIG, ...config },
            })
            .select("id")
            .single();

        if (error || !created)
            return NextResponse.json(
                { error: "Couldn't create the buzzer round." },
                { status: 500 }
            );
        round = created;
    } else {
        await supabase
            .from("game_rounds")
            .update({ config: { ...DEFAULT_ROUND_CONFIG, ...config } })
            .eq("id", round.id);
    }

    // Prompts that have already been buzzed on are left alone — rewriting one
    // would leave presses attached to a question nobody was asked.
    const { data: existing } = await supabase
        .from("buzzer_prompts")
        .select("id, order_index")
        .eq("round_id", round.id);

    const usedIds = new Set<string>();
    if ((existing ?? []).length > 0) {
        const { data: presses } = await supabase
            .from("buzzer_presses")
            .select("prompt_id")
            .in("prompt_id", (existing ?? []).map((p) => p.id));
        for (const p of presses ?? []) usedIds.add(p.prompt_id);
    }

    const untouched = (existing ?? []).filter((p) => !usedIds.has(p.id));
    if (untouched.length > 0)
        await supabase
            .from("buzzer_prompts")
            .delete()
            .in("id", untouched.map((p) => p.id));

    const keptCount = (existing ?? []).length - untouched.length;

    if (prompts.length > 0)
        await supabase.from("buzzer_prompts").insert(
            prompts.map((text, i) => ({
                round_id: round!.id,
                prompt_text: text,
                order_index: keptCount + i,
            }))
        );

    if (!session.current_round_id)
        await supabase
            .from("game_sessions")
            .update({ current_round_id: round.id })
            .eq("id", session.id);

    invalidateGameState();
    return NextResponse.json({
        success: true,
        roundId: round.id,
        keptCount,
        addedCount: prompts.length,
    });
}

/** Wipe every prompt and press so the buzzer can be run again from scratch. */
export async function DELETE() {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getAdminClient();
    const session = await liveSession(supabase);
    if (!session)
        return NextResponse.json({ error: "No live session." }, { status: 409 });

    const { data: round } = await supabase
        .from("game_rounds")
        .select("id")
        .eq("session_id", session.id)
        .eq("type", "buzzer")
        .maybeSingle();

    if (!round)
        return NextResponse.json({ error: "No buzzer round." }, { status: 404 });

    // Prompts cascade to presses.
    await supabase.from("buzzer_prompts").delete().eq("round_id", round.id);
    await supabase
        .from("game_rounds")
        .update({ status: "pending", starts_at: null, ends_at: null })
        .eq("id", round.id);

    invalidateGameState();
    return NextResponse.json({ success: true });
}
