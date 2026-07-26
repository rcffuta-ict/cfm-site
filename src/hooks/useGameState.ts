"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/src/lib/games/types";
import {
    gradeLatency,
    median,
    type ConnectionReading,
} from "@/src/lib/games/connection";

/**
 * The one source of game state for both the TV and members' phones.
 *
 * Polling, not sockets: 500 phones each holding a Supabase Realtime connection
 * would blow past the plan's cap, whereas polling an ETag'd endpoint costs
 * almost nothing (docs/game-plan.md §3). The TV additionally subscribes to the
 * broadcast channel for instant transitions — but that only ever *shortens*
 * the wait, since the poll keeps running underneath. A dropped socket on bad
 * wifi therefore degrades to "up to ~3s behind", never to a frozen screen.
 */

/**
 * Poll cadence, jittered so 500 phones don't all wake in the same millisecond
 * after a transition and arrive as one spike.
 *
 * The countdown is derived locally from the round's absolute `endsAt`, so a
 * phone does *not* need frequent polls to render a smooth timer — it only
 * needs to notice status changes. That lets the idle cadence be much slower
 * than it first appears, which matters: most of the evening is spent between
 * rounds, and at 500 phones the difference is roughly 200 req/s versus 60.
 */
const POLL_LIVE_MS = 2500;
const POLL_LIVE_JITTER_MS = 1500;
const POLL_IDLE_MS = 6000;
const POLL_IDLE_JITTER_MS = 4000;

function nextInterval(status: string | undefined) {
    // "locked" stays fast because the reveal is seconds away.
    const live = status === "active" || status === "locked";
    return live
        ? POLL_LIVE_MS + Math.random() * POLL_LIVE_JITTER_MS
        : POLL_IDLE_MS + Math.random() * POLL_IDLE_JITTER_MS;
}

/** Rolling window for the connection grade — long enough to ignore one blip. */
const SAMPLE_WINDOW = 6;

export interface UseGameState {
    state: GameState | null;
    /** serverNow - Date.now(), so a device with a wrong clock still counts down right. */
    clockOffset: number;
    loading: boolean;
    /** True once at least one poll has failed in a row; clears on success. */
    offline: boolean;
    /**
     * How this phone's connection is doing, measured from the poll loop itself
     * rather than extra requests — the polls are already happening, and they're
     * the same round trip the games depend on.
     */
    connection: ConnectionReading;
    refetch: () => void;
}

export function useGameState(): UseGameState {
    const [state, setState] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [offline, setOffline] = useState(false);
    const [clockOffset, setClockOffset] = useState(0);
    const [connection, setConnection] = useState<ConnectionReading>({
        grade: "good",
        latencyMs: null,
        lossRate: 0,
    });
    const samplesRef = useRef<(number | null)[]>([]);

    const etagRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const aliveRef = useRef(true);
    /** Read by the scheduler, which must not re-create itself on every poll. */
    const statusRef = useRef<string | undefined>(undefined);

    /** Fold one round trip (or failure) into the rolling connection grade. */
    const record = useCallback((latency: number | null) => {
        const samples = [...samplesRef.current, latency].slice(-SAMPLE_WINDOW);
        samplesRef.current = samples;

        const ok = samples.filter((v): v is number => v !== null);
        const lossRate = (samples.length - ok.length) / samples.length;
        const latencyMs = median(ok);

        setConnection({ grade: gradeLatency(latencyMs, lossRate), latencyMs, lossRate });
    }, []);

    const poll = useCallback(async () => {
        const started = performance.now();
        try {
            const res = await fetch("/api/games/state", {
                cache: "no-store",
                headers: etagRef.current
                    ? { "If-None-Match": etagRef.current }
                    : undefined,
            });

            if (!aliveRef.current) return;

            // Unchanged — the common case between transitions. Nothing to
            // re-render, but the clock offset is still worth refreshing.
            if (res.status === 304) {
                record(performance.now() - started);
                setOffline(false);
                setLoading(false);
                return;
            }

            if (!res.ok) {
                record(null);
                setOffline(true);
                return;
            }

            record(performance.now() - started);
            etagRef.current = res.headers.get("etag");
            const next = (await res.json()) as GameState;
            statusRef.current = next.round?.status;
            setState(next);
            setClockOffset(next.serverNow - Date.now());
            setOffline(false);
            setLoading(false);
        } catch {
            if (aliveRef.current) {
                record(null);
                setOffline(true);
            }
        }
    }, [record]);

    const schedule = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            await poll();
            if (aliveRef.current) schedule();
        }, nextInterval(statusRef.current));
    }, [poll]);

    const refetch = useCallback(() => {
        poll().then(() => {
            if (aliveRef.current) schedule();
        });
    }, [poll, schedule]);

    useEffect(() => {
        aliveRef.current = true;
        poll().then(() => {
            if (aliveRef.current) schedule();
        });

        // A phone that was locked mid-round should catch up the instant it's
        // unlocked rather than waiting out the poll interval.
        const onVisible = () => {
            if (document.visibilityState === "visible") refetch();
        };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            aliveRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [poll, schedule, refetch]);

    return { state, clockOffset, loading, offline, connection, refetch };
}

/**
 * Seconds left in the round, derived from the absolute `endsAt` plus the
 * server clock offset — never from a duration counted down locally, which
 * would drift apart across devices that got the message at different times.
 */
export function useCountdown(
    endsAt: number | null,
    clockOffset: number
): number | null {
    const [remaining, setRemaining] = useState<number | null>(null);

    useEffect(() => {
        if (!endsAt) {
            setRemaining(null);
            return;
        }

        const tick = () => {
            const now = Date.now() + clockOffset;
            setRemaining(Math.max(0, Math.ceil((endsAt - now) / 1000)));
        };

        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [endsAt, clockOffset]);

    return remaining;
}
