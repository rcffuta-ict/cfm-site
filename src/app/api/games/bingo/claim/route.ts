import { NextResponse } from "next/server";
import { getAdminClient, broadcastEvents } from "@/src/lib/supabase/server";
import { getSessionCookie } from "@/src/lib/auth/session";
import { invalidateGameState, loadGameState } from "@/src/lib/games/service";
import { GAME_CHANNEL, GAME_EVENTS } from "@/src/lib/games/channel";
import {
    findWin,
    parseBingoConfig,
    scoreWin,
    describePattern,
} from "@/src/lib/games/bingo";

/**
 * Claim a bingo.
 *
 * Re-checks the line server-side from the marks on record. Those marks could
 * only have been written for items the host actually called (see the mark
 * route), so a valid line here is a real one.
 *
 * Position is assigned by counting existing wins inside the insert's unique
 * constraint — two people shouting at the same instant get first and second,
 * never a shared first.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
    const session = await getSessionCookie();
    if (!session?.pid)
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.round || state.round.type !== "bingo")
        return NextResponse.json({ error: "No bingo round." }, { status: 409 });

    if (state.round.status !== "active")
        return NextResponse.json(
            { error: "That round is closed." },
            { status: 409 }
        );

    const roundId = state.round.id;

    const { data: roundRow } = await supabase
        .from("game_rounds")
        .select("config")
        .eq("id", roundId)
        .maybeSingle();
    const config = parseBingoConfig(roundRow?.config);

    const { data: card } = await supabase
        .from("bingo_cards")
        .select("id")
        .eq("round_id", roundId)
        .eq("profile_id", session.pid)
        .maybeSingle();

    if (!card)
        return NextResponse.json({ error: "You have no card." }, { status: 404 });

    const { data: marks } = await supabase
        .from("bingo_marks")
        .select("cell_index")
        .eq("card_id", card.id);

    const marked = new Set((marks ?? []).map((m) => m.cell_index));
    const pattern = findWin(config, marked);

    if (!pattern)
        return NextResponse.json(
            { error: "Not a bingo yet — keep going!" },
            { status: 409 }
        );

    // Retry on the position collision rather than reading-then-writing, so
    // simultaneous claims queue up instead of overwriting each other.
    for (let attempt = 0; attempt < 5; attempt++) {
        const { count } = await supabase
            .from("bingo_wins")
            .select("id", { count: "exact", head: true })
            .eq("round_id", roundId);

        const position = (count ?? 0) + 1;
        const points = scoreWin(config.basePoints, position);

        const { error } = await supabase.from("bingo_wins").insert({
            round_id: roundId,
            profile_id: session.pid,
            pattern,
            position,
            points_awarded: points,
        });

        if (!error) {
            invalidateGameState();
            broadcastEvents(GAME_CHANNEL, [
                { event: GAME_EVENTS.ROUND_UPDATE, payload: { bingo: true } },
            ]).catch(() => {});

            return NextResponse.json({
                success: true,
                position,
                points,
                pattern,
                patternLabel: describePattern(pattern),
            });
        }

        // 23505: either this person already won, or someone took that position.
        if (error.code === "23505") {
            const { data: mine } = await supabase
                .from("bingo_wins")
                .select("pattern, position, points_awarded")
                .eq("round_id", roundId)
                .eq("profile_id", session.pid)
                .maybeSingle();

            if (mine)
                return NextResponse.json({
                    success: true,
                    already: true,
                    position: mine.position,
                    points: mine.points_awarded,
                    pattern: mine.pattern,
                    patternLabel: describePattern(mine.pattern),
                });

            continue; // position was taken — recount and try again
        }

        return NextResponse.json(
            { error: "Couldn't record your bingo." },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { error: "Too busy right now — tap again." },
        { status: 503 }
    );
}
