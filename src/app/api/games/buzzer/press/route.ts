import { NextResponse } from "next/server";
import { getAdminClient, broadcastEvents } from "@/src/lib/supabase/server";
import { getSessionCookie } from "@/src/lib/auth/session";
import { invalidateGameState, loadGameState } from "@/src/lib/games/service";
import { GAME_CHANNEL, GAME_EVENTS } from "@/src/lib/games/channel";
import {
    parseBuzzerConfig,
    scorePress,
    ordinal,
} from "@/src/lib/games/buzzer";

/**
 * Buzz.
 *
 * This is the hottest path in the whole app — hundreds of presses inside a
 * second — so it does the minimum: resolve who you are from the cookie, then a
 * single `buzzer_press` RPC that allocates your position atomically in
 * Postgres. No read-then-write, no client timestamps, no tie-breaking in
 * JavaScript. The database is the referee (docs/game-plan.md §5).
 *
 * Points are written after the race is decided, so scoring can never delay the
 * answer to "was I first?".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
    const session = await getSessionCookie();
    if (!session?.pid)
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.round || state.round.type !== "buzzer")
        return NextResponse.json({ error: "No buzzer round." }, { status: 409 });

    if (state.round.status !== "active" || !state.buzzer?.promptId)
        return NextResponse.json(
            { error: "The buzzer isn't open." },
            { status: 409 }
        );

    const promptId = state.buzzer.promptId;

    // Retry only the "another press took our computed position" case; the
    // function reports that distinctly from a duplicate press.
    for (let attempt = 0; attempt < 6; attempt++) {
        const { data, error } = await supabase.rpc("buzzer_press", {
            p_prompt_id: promptId,
            p_profile_id: session.pid,
        });

        if (!error) {
            // `press_position` rather than `position`: the latter is a reserved
            // word in a RETURNS TABLE clause (see docs/buzzer-schema.sql).
            const row = Array.isArray(data) ? data[0] : data;
            const position = Number(row?.press_position);
            const reactionMs = row?.press_reaction_ms ?? null;
            const already = row?.press_already === true;

            const config = parseBuzzerConfig(state.round.config);
            const points = scorePress(config, position);

            if (!already && points > 0) {
                await supabase
                    .from("buzzer_presses")
                    .update({ points_awarded: points })
                    .eq("prompt_id", promptId)
                    .eq("profile_id", session.pid);
            }

            invalidateGameState();
            if (!already)
                broadcastEvents(GAME_CHANNEL, [
                    { event: GAME_EVENTS.ROUND_UPDATE, payload: { buzz: position } },
                ]).catch(() => {});

            return NextResponse.json({
                success: true,
                already,
                position,
                positionLabel: ordinal(position),
                reactionMs,
                points: already ? undefined : points,
            });
        }

        const message = error.message ?? "";
        if (message.includes("buzzer_closed"))
            return NextResponse.json(
                { error: "The buzzer isn't open." },
                { status: 409 }
            );
        if (message.includes("position_taken")) continue;

        return NextResponse.json(
            { error: "Couldn't register your buzz." },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { error: "Too many at once — tap again." },
        { status: 503 }
    );
}
