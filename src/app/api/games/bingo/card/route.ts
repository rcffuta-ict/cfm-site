import { NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getSessionCookie } from "@/src/lib/auth/session";
import { loadGameState } from "@/src/lib/games/service";
import {
    generateLayout,
    parseBingoConfig,
    type CardLayout,
} from "@/src/lib/games/bingo";

/**
 * Your card for the current bingo round, generated on first ask and kept.
 *
 * Generated once and stored (game-plan §7): reshuffling on refresh would hand
 * someone a brand-new card halfway through a round they'd been marking all
 * evening.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getSessionCookie();
    if (!session?.pid)
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.round || state.round.type !== "bingo")
        return NextResponse.json({ card: null, marks: [] });

    const roundId = state.round.id;

    const { data: existing } = await supabase
        .from("bingo_cards")
        .select("id, layout")
        .eq("round_id", roundId)
        .eq("profile_id", session.pid)
        .maybeSingle();

    let cardId = existing?.id as string | undefined;
    let layout = existing?.layout as CardLayout | undefined;

    if (!cardId) {
        const { data: roundRow } = await supabase
            .from("game_rounds")
            .select("config")
            .eq("id", roundId)
            .maybeSingle();

        const config = parseBingoConfig(roundRow?.config);

        let generated: CardLayout;
        try {
            generated = generateLayout(config);
        } catch (err) {
            return NextResponse.json(
                { error: (err as Error).message },
                { status: 409 }
            );
        }

        const { data: created, error } = await supabase
            .from("bingo_cards")
            .insert({
                round_id: roundId,
                profile_id: session.pid,
                layout: generated,
            })
            .select("id, layout")
            .single();

        if (error) {
            // Two tabs asking at once — the unique constraint means one of them
            // lost the race, so read back the card that won.
            const { data: raced } = await supabase
                .from("bingo_cards")
                .select("id, layout")
                .eq("round_id", roundId)
                .eq("profile_id", session.pid)
                .maybeSingle();
            if (!raced)
                return NextResponse.json(
                    { error: "Couldn't create your card." },
                    { status: 500 }
                );
            cardId = raced.id;
            layout = raced.layout as CardLayout;
        } else {
            cardId = created.id;
            layout = created.layout as CardLayout;

            // The free centre starts marked — it's free.
            const config2 = parseBingoConfig(roundRow?.config);
            const centre = Math.floor((config2.gridSize * config2.gridSize) / 2);
            if (layout[centre] === null) {
                await supabase
                    .from("bingo_marks")
                    .insert({ card_id: cardId, cell_index: centre });
            }
        }
    }

    const { data: marks } = await supabase
        .from("bingo_marks")
        .select("cell_index")
        .eq("card_id", cardId);

    const { data: win } = await supabase
        .from("bingo_wins")
        .select("pattern, position")
        .eq("round_id", roundId)
        .eq("profile_id", session.pid)
        .maybeSingle();

    return NextResponse.json({
        card: { id: cardId, layout },
        marks: (marks ?? []).map((m) => m.cell_index),
        win: win ?? null,
    });
}
