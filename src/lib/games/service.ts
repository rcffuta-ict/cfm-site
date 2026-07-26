import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getCfmEvent } from "@/src/lib/event";
import {
    DEFAULT_ROUND_CONFIG,
    type GameState,
    type PublicBingo,
    type PublicBuzzer,
    type PublicQuestion,
    type PublicRound,
    type RoundConfig,
    type SessionStatus,
} from "@/src/lib/games/types";
import { parseBingoConfig } from "@/src/lib/games/bingo";
import { parseBuzzerConfig } from "@/src/lib/games/buzzer";

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

/** Server-side so it can be flipped without a rebuild, unlike NEXT_PUBLIC_*. */
const HELPERS_ON = process.env.GAME_HELPERS === "1";

const EMPTY: Omit<GameState, "serverNow"> = {
    session: null,
    helpers: HELPERS_ON,
    round: null,
    question: null,
    bingo: null,
    buzzer: null,
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
    let bingo: PublicBingo | null = null;
    let buzzer: PublicBuzzer | null = null;

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

    if (round.type === "bingo") {
        const config = parseBingoConfig(roundRow.config);

        const { data: calls } = await supabase
            .from("bingo_calls")
            .select("item_index, call_order")
            .eq("round_id", round.id)
            .order("call_order", { ascending: false });

        const { data: wins } = await supabase
            .from("bingo_wins")
            .select("profile_id, pattern, position")
            .eq("round_id", round.id)
            .order("position", { ascending: true });

        // Only the visible handful of winners need names.
        const winnerIds = (wins ?? []).slice(0, 10).map((w) => w.profile_id);
        const nameById = new Map<string, string>();
        if (winnerIds.length > 0) {
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", winnerIds);
            for (const p of profiles ?? [])
                nameById.set(p.id, `${p.first_name} ${p.last_name}`.trim());
        }

        bingo = {
            gridSize: config.gridSize,
            freeCentre: config.freeCentre,
            pattern: config.pattern,
            items: config.items,
            called: (calls ?? []).map((c) => c.item_index),
            winners: (wins ?? []).slice(0, 10).map((w) => ({
                name: nameById.get(w.profile_id) ?? "Someone",
                pattern: w.pattern,
                position: w.position,
            })),
        };
    }

    if (round.type === "buzzer") {
        const config = parseBuzzerConfig(roundRow.config);

        const { data: prompts } = await supabase
            .from("buzzer_prompts")
            .select("id, prompt_text, order_index, opened_at")
            .eq("round_id", round.id)
            .order("order_index", { ascending: true });

        const list = prompts ?? [];
        // Which prompt is in play is tracked explicitly on the round rather than
        // inferred from `opened_at`. Inferring it breaks the moment the host
        // moves on without opening: every prompt is closed, and "last opened"
        // would snap back to the top of the list.
        const currentId = (roundRow.config as { currentPromptId?: string } | null)
            ?.currentPromptId;
        const active = list.find((p) => p.id === currentId) ?? list[0] ?? null;

        let presses: PublicBuzzer["presses"] = [];
        if (active) {
            const { data: rows } = await supabase
                .from("buzzer_presses")
                .select("profile_id, position, reaction_ms, points_awarded")
                .eq("prompt_id", active.id)
                .order("position", { ascending: true })
                .limit(10);

            const ids = (rows ?? []).map((r) => r.profile_id);
            const nameById = new Map<string, string>();
            if (ids.length > 0) {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("id, first_name, last_name")
                    .in("id", ids);
                for (const p of profiles ?? [])
                    nameById.set(p.id, `${p.first_name} ${p.last_name}`.trim());
            }

            presses = (rows ?? []).map((r) => ({
                name: nameById.get(r.profile_id) ?? "Someone",
                position: r.position,
                reactionMs: r.reaction_ms ?? null,
                points: r.points_awarded ?? 0,
            }));
        }

        buzzer = {
            promptId: active?.id ?? null,
            promptText: active?.prompt_text ?? null,
            open: !!active?.opened_at,
            scoringPlaces: config.scoringPlaces,
            presses,
            index: active ? list.findIndex((p) => p.id === active.id) : -1,
            total: list.length,
        };
    }

    return {
        session: sessionPublic,
        helpers: HELPERS_ON,
        round,
        question,
        bingo,
        buzzer,
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
            // A new call or a new winner has to invalidate the ETag, or phones
            // would sit on a 304 through the whole bingo round.
            bingo ? `b${bingo.called.length}.${bingo.winners.length}` : "-",
            // A new press has to change the ETag, or the TV would sit on a 304
            // while the room is watching for the winner.
            buzzer
                ? `z${buzzer.promptId ?? "-"}.${buzzer.open ? 1 : 0}.${buzzer.presses.length}`
                : "-",
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
