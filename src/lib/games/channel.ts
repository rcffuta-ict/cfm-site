/**
 * The games control plane.
 *
 * Unlike the Oracle — which runs entirely on the venue LAN — games span the
 * cloud instance, because the data originates on 500 members' phones. So the
 * TV subscribes to Supabase Realtime here, exactly as docs/game-plan.md §3
 * describes: one connection for the whole venue, phones hold none.
 *
 * The broadcast is an *optimisation*, never the source of truth. The TV also
 * polls `/api/games/state`, so a dropped socket on bad wifi costs a beat of
 * latency rather than a frozen screen.
 */
export const GAME_CHANNEL = "game-channel";

export const GAME_EVENTS = {
    /** Round state changed — re-read `/api/games/state` now rather than waiting. */
    ROUND_UPDATE: "round:update",
    /** Scores changed — leaderboard should refetch. */
    SCORES_UPDATE: "scores:update",
} as const;
