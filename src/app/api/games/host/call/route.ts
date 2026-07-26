import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, broadcastEvents } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { invalidateGameState, loadGameState } from "@/src/lib/games/service";
import { GAME_CHANNEL, GAME_EVENTS } from "@/src/lib/games/channel";
import { parseBingoConfig } from "@/src/lib/games/bingo";
import crypto from "crypto";

/**
 * Call the next bingo item.
 *
 * The host can let it pick at random from what's left, or choose a specific
 * item — useful when the caller is reading from a physical list. Either way the
 * `UNIQUE (round_id, item_index)` constraint means a double-tap on a phone
 * can't burn two items.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { itemIndex } = (await request.json().catch(() => ({}))) as {
        itemIndex?: number;
    };

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.round || state.round.type !== "bingo")
        return NextResponse.json({ error: "No bingo round." }, { status: 409 });

    if (state.round.status !== "active")
        return NextResponse.json(
            { error: "Start the round before calling items." },
            { status: 409 }
        );

    const roundId = state.round.id;

    const { data: roundRow } = await supabase
        .from("game_rounds")
        .select("config")
        .eq("id", roundId)
        .maybeSingle();
    const config = parseBingoConfig(roundRow?.config);

    const { data: calls } = await supabase
        .from("bingo_calls")
        .select("item_index, call_order")
        .eq("round_id", roundId)
        .order("call_order", { ascending: false });

    const alreadyCalled = new Set((calls ?? []).map((c) => c.item_index));
    const nextOrder = (calls?.[0]?.call_order ?? 0) + 1;

    let chosen: number;
    if (typeof itemIndex === "number") {
        if (itemIndex < 0 || itemIndex >= config.items.length)
            return NextResponse.json({ error: "No such item." }, { status: 400 });
        if (alreadyCalled.has(itemIndex))
            return NextResponse.json(
                { error: `"${config.items[itemIndex]}" was already called.` },
                { status: 409 }
            );
        chosen = itemIndex;
    } else {
        const remaining = config.items
            .map((_, i) => i)
            .filter((i) => !alreadyCalled.has(i));

        if (remaining.length === 0)
            return NextResponse.json(
                { error: "Every item has been called." },
                { status: 409 }
            );

        chosen = remaining[crypto.randomInt(remaining.length)];
    }

    const { error } = await supabase.from("bingo_calls").insert({
        round_id: roundId,
        item_index: chosen,
        call_order: nextOrder,
    });

    if (error) {
        // Someone got there first — almost always a double-tap.
        if (error.code === "23505")
            return NextResponse.json(
                { error: "That call already landed — try again." },
                { status: 409 }
            );
        return NextResponse.json({ error: "Couldn't call it." }, { status: 500 });
    }

    invalidateGameState();
    broadcastEvents(GAME_CHANNEL, [
        { event: GAME_EVENTS.ROUND_UPDATE, payload: { called: chosen } },
    ]).catch(() => {});

    return NextResponse.json({
        success: true,
        itemIndex: chosen,
        item: config.items[chosen],
        callOrder: nextOrder,
        remaining: config.items.length - alreadyCalled.size - 1,
    });
}

/** Undo the most recent call — for when the caller misreads their list. */
export async function DELETE() {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.round || state.round.type !== "bingo")
        return NextResponse.json({ error: "No bingo round." }, { status: 409 });

    const { data: last } = await supabase
        .from("bingo_calls")
        .select("id, item_index")
        .eq("round_id", state.round.id)
        .order("call_order", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!last)
        return NextResponse.json({ error: "Nothing called yet." }, { status: 409 });

    await supabase.from("bingo_calls").delete().eq("id", last.id);

    // Marks made against the undone item have to go too, or they'd count
    // toward a line for an item nobody actually called.
    const { data: cards } = await supabase
        .from("bingo_cards")
        .select("id, layout")
        .eq("round_id", state.round.id);

    for (const card of cards ?? []) {
        const layout = card.layout as (number | null)[];
        const cells = layout
            .map((item, cell) => (item === last.item_index ? cell : -1))
            .filter((c) => c >= 0);
        if (cells.length > 0)
            await supabase
                .from("bingo_marks")
                .delete()
                .eq("card_id", card.id)
                .in("cell_index", cells);
    }

    invalidateGameState();
    broadcastEvents(GAME_CHANNEL, [
        { event: GAME_EVENTS.ROUND_UPDATE, payload: { undone: true } },
    ]).catch(() => {});

    return NextResponse.json({ success: true, undone: last.item_index });
}
