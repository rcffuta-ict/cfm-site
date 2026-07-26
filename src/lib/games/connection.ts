/**
 * Judging a phone's connection.
 *
 * This exists because of something we only saw once real people played: a
 * member on a weak signal loses a buzzer race or misses a trivia window and has
 * no idea why. They assume they were slow. Telling them plainly that the
 * network is the problem — and that moving might fix it — is the difference
 * between a fair-feeling game and a frustrating one.
 */

export type ConnectionGrade = "good" | "fair" | "poor" | "offline";

/**
 * Thresholds are round-trip milliseconds to our own `/api/ping`, chosen against
 * what each game actually needs:
 *
 *  - Buzzer is the strictest. Position is decided by arrival order at the
 *    server, so latency is a direct handicap — 250ms behind is 250ms behind.
 *  - Trivia is forgiving: the speed bonus decays over the whole round, so a
 *    few hundred milliseconds costs a point or two, not the answer.
 *  - Past a second, round transitions start arriving visibly late.
 */
export const GOOD_MS = 300;
export const FAIR_MS = 800;

export interface ConnectionReading {
    grade: ConnectionGrade;
    /** Median round trip, ms. Null when every attempt failed. */
    latencyMs: number | null;
    /** Share of requests that failed outright, 0–1. */
    lossRate: number;
}

export function gradeLatency(
    latencyMs: number | null,
    lossRate = 0
): ConnectionGrade {
    if (latencyMs === null) return "offline";
    // Dropped requests hurt more than slow ones: a lost buzz is not late, it's
    // simply gone.
    if (lossRate >= 0.34) return "poor";
    if (latencyMs <= GOOD_MS && lossRate === 0) return "good";
    if (latencyMs <= FAIR_MS && lossRate < 0.2) return "fair";
    return "poor";
}

export function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export const GRADE_COPY: Record<
    ConnectionGrade,
    { label: string; summary: string; advice: string }
> = {
    good: {
        label: "Strong",
        summary: "You're in good shape for every game.",
        advice: "Nothing to do — enjoy it.",
    },
    fair: {
        label: "Workable",
        summary:
            "Trivia and bingo will be fine. The buzzer may cost you a place or two.",
        advice:
            "If you're going for the buzzer, try moving closer to a window or away from the crowd.",
    },
    poor: {
        label: "Weak",
        summary:
            "Answers may arrive late or not at all, and you'll be at a real disadvantage on the buzzer.",
        advice:
            "Move to a different part of the hall, switch between wifi and mobile data, or turn flight mode on and off to grab a fresh signal.",
    },
    offline: {
        label: "No connection",
        summary: "We can't reach the server at all.",
        advice:
            "Check that mobile data or wifi is on, then try again. You won't be able to play until this clears.",
    },
};

/** One measured round trip against `/api/ping`, or null if it failed. */
export async function pingOnce(timeoutMs = 5000): Promise<number | null> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    const started = performance.now();
    try {
        const res = await fetch(`/api/ping?n=${Math.random()}`, {
            cache: "no-store",
            signal: abort.signal,
        });
        if (!res.ok) return null;
        await res.arrayBuffer();
        return performance.now() - started;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
