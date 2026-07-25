import { EventEmitter } from "events";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";
import type { OraclePerson } from "@/src/lib/oracle/channel";

/**
 * The Oracle's local transport.
 *
 * On the night the Oracle runs from a single Next process on the church laptop,
 * with the admin phone and the TV both on the venue wifi. So "get the command
 * from the admin to the TV" is an in-process fan-out, not a network problem:
 * the pick route emits here and `/api/oracle/stream` pushes it straight down
 * each open SSE connection. No Supabase, no WebSocket handshake, no internet.
 *
 * (`channel.ts` notes that an in-memory store was tried before and dropped
 * because a second laptop never got the commands. That was a *multi-instance*
 * failure on the cloud deployment — every server had its own store. A single
 * local process is exactly the case where this is the right answer.)
 */

/** The one emitter event; the Oracle event name travels inside the payload. */
const BUS_EVENT = "oracle";

export interface OracleMessage {
    event: string;
    payload: Record<string, unknown>;
}

/**
 * What the screen should currently be showing. Held so a TV that connects late
 * — or reloads mid-reveal — catches up instead of dropping back to standby.
 */
export interface OracleState {
    phase: "idle" | "preparing" | "spinning" | "revealed";
    raffleId: number | null;
    spinDuration: number;
    person: OraclePerson | null;
    /** When this state was set, epoch ms. */
    at: number;
}

const IDLE: OracleState = {
    phase: "idle",
    raffleId: null,
    spinDuration: 3000,
    person: null,
    at: 0,
};

/**
 * Pinned to `globalThis` so `next dev`'s hot reload doesn't leave the TV
 * subscribed to an emitter the pick route no longer publishes to.
 */
const globalForBus = globalThis as typeof globalThis & {
    __cfmOracleBus?: EventEmitter;
    __cfmOracleState?: OracleState;
};

export const oracleBus: EventEmitter =
    globalForBus.__cfmOracleBus ?? (globalForBus.__cfmOracleBus = new EventEmitter());

// One listener per open TV/console stream; the default cap of 10 would warn.
oracleBus.setMaxListeners(64);

export function getOracleState(): OracleState {
    return globalForBus.__cfmOracleState ?? IDLE;
}

function setOracleState(next: Partial<OracleState>) {
    globalForBus.__cfmOracleState = {
        ...getOracleState(),
        ...next,
        at: Date.now(),
    };
}

/** Roll the catch-up state forward to match an outgoing event. */
function applyToState(event: string, payload: Record<string, unknown>) {
    switch (event) {
        case ORACLE_EVENTS.PREPARING:
            setOracleState({ phase: "preparing", raffleId: null, person: null });
            break;
        case ORACLE_EVENTS.SELECTION:
            setOracleState({
                phase: "spinning",
                raffleId: Number(payload.raffleId) || null,
                spinDuration: Number(payload.spinDuration) || 3000,
                person: null,
            });
            break;
        case ORACLE_EVENTS.REVEAL:
            setOracleState({
                phase: "revealed",
                person: payload as unknown as OraclePerson,
            });
            break;
        case ORACLE_EVENTS.RESET:
            globalForBus.__cfmOracleState = { ...IDLE, at: Date.now() };
            break;
    }
}

/**
 * Publish one or more events to every connected screen. Synchronous and
 * in-process — this is the call that has to be fast, and it is.
 */
export function publishOracle(messages: OracleMessage[]): void {
    for (const message of messages) {
        applyToState(message.event, message.payload);
        oracleBus.emit(BUS_EVENT, message);
    }
}

export function subscribeOracle(
    listener: (message: OracleMessage) => void
): () => void {
    oracleBus.on(BUS_EVENT, listener);
    return () => {
        oracleBus.off(BUS_EVENT, listener);
    };
}
