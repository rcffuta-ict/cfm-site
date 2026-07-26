import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getSessionCookie } from "@/src/lib/auth/session";
import { loadGameState } from "@/src/lib/games/service";
import { parseBingoConfig, type CardLayout } from "@/src/lib/games/bingo";

/**
 * Mark or unmark one cell.
 *
 * This route is where bingo's fairness actually lives: **a cell can only be
 * marked once its item has been called.** Because that's enforced on write,
 * the win check downstream can trust the marks it reads and doesn't need to
 * re-derive anything — and no amount of tapping ahead can manufacture a line.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const session = await getSessionCookie();
    if (!session?.pid)
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { cellIndex, marked } = await request.json();
    if (typeof cellIndex !== "number")
        return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.round || state.round.type !== "bingo")
        return NextResponse.json({ error: "No bingo round." }, { status: 409 });

    if (state.round.status !== "active")
        return NextResponse.json(
            { error: "That round is closed." },
            { status: 409 }
        );

    const { data: card } = await supabase
        .from("bingo_cards")
        .select("id, layout")
        .eq("round_id", state.round.id)
        .eq("profile_id", session.pid)
        .maybeSingle();

    if (!card)
        return NextResponse.json({ error: "You have no card." }, { status: 404 });

    const layout = card.layout as CardLayout;
    if (cellIndex < 0 || cellIndex >= layout.length)
        return NextResponse.json({ error: "No such square." }, { status: 400 });

    const itemIndex = layout[cellIndex];

    // The free centre is permanently marked; nothing to toggle.
    if (itemIndex === null)
        return NextResponse.json({ success: true, marked: true });

    if (marked === false) {
        await supabase
            .from("bingo_marks")
            .delete()
            .eq("card_id", card.id)
            .eq("cell_index", cellIndex);
        return NextResponse.json({ success: true, marked: false });
    }

    const { data: called } = await supabase
        .from("bingo_calls")
        .select("id")
        .eq("round_id", state.round.id)
        .eq("item_index", itemIndex)
        .maybeSingle();

    if (!called) {
        const config = parseBingoConfig(
            (await supabase
                .from("game_rounds")
                .select("config")
                .eq("id", state.round.id)
                .maybeSingle()).data?.config
        );
        const label = config.items[itemIndex] ?? "That";
        return NextResponse.json(
            { error: `"${label}" hasn't been called yet.` },
            { status: 409 }
        );
    }

    const { error } = await supabase
        .from("bingo_marks")
        .upsert(
            { card_id: card.id, cell_index: cellIndex },
            { onConflict: "card_id,cell_index", ignoreDuplicates: true }
        );

    if (error)
        return NextResponse.json({ error: "Couldn't mark it." }, { status: 500 });

    return NextResponse.json({ success: true, marked: true });
}
