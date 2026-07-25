import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getCfmEvent } from "@/src/lib/event";
import {
    DEFAULT_ROUND_CONFIG,
    type GameState,
    type PublicQuestion,
    type PublicRound,
    type RoundConfig,
    type SessionStatus,
} from "@/src/lib/games/types";

/**
 * Reading the live game state.
 *
 * A round is one question. The host creates a round per question and walks
 * Start → Lock → Reveal → Next, so the control flow maps 1:1 onto what the
 * hall sees and there's no separate question pointer to keep in sync.
 */

const CACHE_TTL_MS = 1000;

const globalForGames = globalThis as typeof globalThis & {
    __cfmGameCache?: { state: GameState; at: number };
    __cfmGameInflight?: Promise<GameState>;
};

const EMPTY: Omit<GameState, "serverNow"> = {
    session: null,
    round: null,
    question: null,
    correctIndex: null,
    version: "idle",
};

function toEpoch(value: string | null): number | null {
    return value ? new Date(value).getTime() : null;
}

function parseConfig(raw: unknown): RoundConfig {
    const config = (raw ?? {}) as Partial<RoundConfig>;
    return {
        durationSeconds:
            Number(config.durationSeconds) || DEFAULT_ROUND_CONFIG.durationSeconds,
        basePoints: Number(config.basePoints) || DEFAULT_ROUND_CONFIG.basePoints,
        speedBonus:
            config.speedBonus === undefined
                ? DEFAULT_ROUND_CONFIG.speedBonus
                : Number(config.speedBonus),
    };
}

/** Read straight from Postgres. Callers should prefer `getGameState`. */
export async function loadGameState(
    supabase: SupabaseClient = getAdminClient()
): Promise<GameState> {
    const serverNow = Date.now();

    const event = await getCfmEvent(supabase);
    if (!event) return { ...EMPTY, serverNow };

    const { data: session } = await supabase
        .from("game_sessions")
        .select("id, title, status, current_round_id")
        .eq("event_id", event.id)
        .eq("status", "live")
        .maybeSingle();

    if (!session) return { ...EMPTY, serverNow };

    const sessionPublic = {
        id: session.id as string,
        title: session.title as string,
        status: session.status as SessionStatus,
    };

    if (!session.current_round_id)
        return {
            ...EMPTY,
            session: sessionPublic,
            version: `${session.id}:none`,
            serverNow,
        };

    const { data: roundRow } = await supabase
        .from("game_rounds")
        .select("id, type, status, order_index, config, starts_at, ends_at")
        .eq("id", session.current_round_id)
        .maybeSingle();

    if (!roundRow)
        return {
            ...EMPTY,
            session: sessionPublic,
            version: `${session.id}:none`,
            serverNow,
        };

    const round: PublicRound = {
        id: roundRow.id,
        type: roundRow.type,
        status: roundRow.status,
        orderIndex: roundRow.order_index,
        startsAt: toEpoch(roundRow.starts_at),
        endsAt: toEpoch(roundRow.ends_at),
        config: parseConfig(roundRow.config),
    };

    let question: PublicQuestion | null = null;
    let correctIndex: number | null = null;

    if (round.type === "trivia") {
        const { data: q } = await supabase
            .from("trivia_questions")
            .select("id, question, options, correct_index, points, order_index")
            .eq("round_id", round.id)
            .order("order_index", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (q) {
            question = {
                id: q.id,
                question: q.question,
                options: (q.options ?? []) as string[],
                points: q.points,
                orderIndex: q.order_index,
            };
            // The answer only ever leaves the server once the round is revealed.
            // Anything else and a phone could read it out of the poll response
            // while the round is still live.
            if (round.status === "revealed" || round.status === "ended") {
                correctIndex = q.correct_index;
            }
        }
    }

    return {
        session: sessionPublic,
        round,
        question,
        correctIndex,
        serverNow,
        // Everything a client renders differently is folded in, so an unchanged
        // version genuinely means "nothing to redraw".
        version: [
            session.id,
            round.id,
            round.status,
            round.endsAt ?? "-",
            question?.id ?? "-",
            correctIndex ?? "-",
        ].join(":"),
    };
}

/**
 * Cached read for the poll endpoint.
 *
 * 500 phones polling every ~2.5s is roughly 200 requests a second. Without
 * this they'd be 200 database round trips a second; with it they collapse to
 * about one, and the extra second of staleness is invisible next to the poll
 * interval itself. The in-flight promise is shared so an expiring cache can't
 * let a burst of requests through at once.
 */
export async function getGameState(): Promise<GameState> {
    const cached = globalForGames.__cfmGameCache;
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        // Keep the clock honest even on a cache hit, or every phone in a
        // one-second window would compute its countdown from the same stale
        // `serverNow` and drift.
        return { ...cached.state, serverNow: Date.now() };
    }

    if (globalForGames.__cfmGameInflight) return globalForGames.__cfmGameInflight;

    const inflight = loadGameState()
        .then((state) => {
            globalForGames.__cfmGameCache = { state, at: Date.now() };
            return state;
        })
        .finally(() => {
            globalForGames.__cfmGameInflight = undefined;
        });

    globalForGames.__cfmGameInflight = inflight;
    return inflight;
}

/** Drop the cache so a host action shows up on the next poll, not a second later. */
export function invalidateGameState(): void {
    globalForGames.__cfmGameCache = undefined;
}
