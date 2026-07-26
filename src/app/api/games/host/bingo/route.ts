import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { getCfmEvent } from "@/src/lib/event";
import { invalidateGameState } from "@/src/lib/games/service";
import {
    DEFAULT_BINGO_CONFIG,
    parseBingoConfig,
    validateBingoConfig,
    cellsNeeded,
    type BingoConfig,
} from "@/src/lib/games/bingo";
import { DEFAULT_ROUND_CONFIG } from "@/src/lib/games/types";

/**
 * Create and edit the bingo round for the live session.
 *
 * One bingo round per session keeps the mental model simple: there's "the
 * bingo", it runs alongside the trivia, and the host calls items whenever the
 * programme has a gap.
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
        .eq("type", "bingo")
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (!round) return NextResponse.json({ round: null });

    const config = parseBingoConfig(round.config);

    const { data: calls } = await supabase
        .from("bingo_calls")
        .select("item_index, call_order")
        .eq("round_id", round.id)
        .order("call_order", { ascending: false });

    const { count: cardCount } = await supabase
        .from("bingo_cards")
        .select("id", { count: "exact", head: true })
        .eq("round_id", round.id);

    const { count: winCount } = await supabase
        .from("bingo_wins")
        .select("id", { count: "exact", head: true })
        .eq("round_id", round.id);

    return NextResponse.json({
        round: {
            id: round.id,
            status: round.status,
            orderIndex: round.order_index,
            config,
            called: (calls ?? []).map((c) => c.item_index),
            cardCount: cardCount ?? 0,
            winCount: winCount ?? 0,
        },
    });
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as Partial<BingoConfig>;

    const config: BingoConfig = {
        ...DEFAULT_BINGO_CONFIG,
        ...parseBingoConfig(body),
        items: (Array.isArray(body.items) ? body.items : [])
            .map((i) => String(i).trim())
            .filter(Boolean),
    };

    const invalid = validateBingoConfig(config);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const supabase = getAdminClient();
    const session = await liveSession(supabase);
    if (!session)
        return NextResponse.json(
            { error: "No live session — create one first." },
            { status: 409 }
        );

    const { data: existing } = await supabase
        .from("game_rounds")
        .select("id, status")
        .eq("session_id", session.id)
        .eq("type", "bingo")
        .maybeSingle();

    if (existing) {
        const { count: cardCount } = await supabase
            .from("bingo_cards")
            .select("id", { count: "exact", head: true })
            .eq("round_id", existing.id);

        // Changing the pool after cards exist would silently repoint every
        // card's indexes at different words.
        if ((cardCount ?? 0) > 0)
            return NextResponse.json(
                {
                    error: `${cardCount} card${cardCount === 1 ? " has" : "s have"} already been handed out — editing the list now would change what's printed on them. Reset the bingo to start over.`,
                },
                { status: 409 }
            );

        await supabase
            .from("game_rounds")
            .update({ config: { ...DEFAULT_ROUND_CONFIG, ...config } })
            .eq("id", existing.id);

        invalidateGameState();
        return NextResponse.json({ success: true, roundId: existing.id });
    }

    const { data: last } = await supabase
        .from("game_rounds")
        .select("order_index")
        .eq("session_id", session.id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

    const { data: round, error } = await supabase
        .from("game_rounds")
        .insert({
            session_id: session.id,
            type: "bingo",
            status: "pending",
            order_index: (last?.order_index ?? -1) + 1,
            config: { ...DEFAULT_ROUND_CONFIG, ...config },
        })
        .select("id")
        .single();

    if (error || !round)
        return NextResponse.json(
            { error: "Couldn't create the bingo round." },
            { status: 500 }
        );

    invalidateGameState();
    return NextResponse.json({
        success: true,
        roundId: round.id,
        cellsNeeded: cellsNeeded(config),
    });
}

/** Clear calls, cards, marks and wins so the bingo can be run again. */
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
        .eq("type", "bingo")
        .maybeSingle();

    if (!round)
        return NextResponse.json({ error: "No bingo round." }, { status: 404 });

    // Cards cascade to marks; calls and wins are keyed on the round.
    await supabase.from("bingo_wins").delete().eq("round_id", round.id);
    await supabase.from("bingo_calls").delete().eq("round_id", round.id);
    await supabase.from("bingo_cards").delete().eq("round_id", round.id);
    await supabase
        .from("game_rounds")
        .update({ status: "pending", starts_at: null, ends_at: null })
        .eq("id", round.id);

    invalidateGameState();
    return NextResponse.json({ success: true });
}
