/**
 * The oracle event vocabulary — shared between the server (which publishes on
 * the in-process bus) and the TV screen (which consumes them over SSE).
 *
 * These commands travel over `src/lib/oracle/bus.ts` + `/api/oracle/stream`,
 * entirely inside the local Next process on the church laptop. That keeps the
 * draw off the network: the admin's phone and the TV are both on the venue
 * wifi, so a roll reaches the screen in milliseconds and a bad uplink can't
 * stall it. Live registration stats are a separate concern and still ride
 * Supabase Realtime — see `src/lib/stats/channel.ts`.
 */
export const ORACLE_EVENTS = {
    /** Screen should clear and show the "choosing…" state. */
    PREPARING: "preparing",
    /** A raffle id was picked — start the slot machine. */
    SELECTION: "selection",
    /** Reveal the full person details overlay. */
    REVEAL: "selection:details:show",
    /** Clear everything back to standby. */
    RESET: "reset",
    /** Sent once when a screen connects, so it can catch up mid-round. */
    SYNC: "sync",
} as const;

export interface OraclePerson {
    raffleId: number;
    firstName: string;
    lastName: string;
    level: string;
    unit: string | null;
    gender: string;
    /** The winner's profile picture, when they have one on their profile. */
    avatarUrl: string | null;
}
