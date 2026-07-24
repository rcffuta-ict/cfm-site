/**
 * The oracle live channel — shared between server (broadcaster) and browser
 * (subscribers). We use Supabase Realtime broadcast so a command from the admin
 * reaches every oracle screen on any device/instance, exactly like the stats
 * page. (The old in-memory SSE store only reached viewers connected to the same
 * server process, which is why a second laptop never got the commands.)
 */
export const ORACLE_CHANNEL = "oracle-channel";

export const ORACLE_EVENTS = {
    /** Screen should clear and show the "choosing…" state. */
    PREPARING: "preparing",
    /** A raffle id was picked — start the slot machine. */
    SELECTION: "selection",
    /** Reveal the full person details overlay. */
    REVEAL: "selection:details:show",
    /** Clear everything back to standby. */
    RESET: "reset",
    /** Registration counts changed — stats page should refetch. */
    STATS_UPDATE: "stats:update",
} as const;

export interface OraclePerson {
    raffleId: number;
    firstName: string;
    lastName: string;
    level: string;
    unit: string | null;
    gender: string;
}
