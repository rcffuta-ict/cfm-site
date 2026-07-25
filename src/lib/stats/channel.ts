/**
 * Live registration stats ride Supabase Realtime, unlike the Oracle.
 *
 * The trigger for a stats refresh is a member logging in or registering, which
 * happens on the *cloud* instance — so it can't reach the Oracle's in-process
 * bus on the church laptop. Stats are also just a counter with no latency
 * requirement (the screen polls every 15s anyway), so the round trip is fine
 * here in a way it isn't for the draw.
 */
export const STATS_CHANNEL = "stats-channel";

export const STATS_EVENTS = {
    /** Registration counts changed — the stats screen should refetch. */
    UPDATE: "stats:update",
} as const;
