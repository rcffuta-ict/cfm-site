"use client";

import { useCallback, useEffect, useState } from "react";
import { Signal, ArrowLeft, RotateCcw, Gamepad2, Volume2 } from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import { cn } from "@/src/lib/utils";
import {
    pingOnce,
    median,
    gradeLatency,
    GRADE_COPY,
    GOOD_MS,
    FAIR_MS,
    type ConnectionGrade,
} from "@/src/lib/games/connection";

const ROUNDS = 7;

const GRADE_STYLE: Record<ConnectionGrade, string> = {
    good: "bg-success-container text-on-success-container",
    fair: "bg-tertiary text-on-tertiary",
    poor: "bg-error-container text-on-error-container",
    offline: "bg-error-container text-on-error-container",
};

/**
 * A connection check people can run themselves.
 *
 * Measures the same round trip the games depend on — against `/api/ping`, which
 * does no work at all — so the number on screen is the number that decides
 * whether they stand a chance on the buzzer.
 */
export default function NetworkCheck() {
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(0);
    const [samples, setSamples] = useState<(number | null)[]>([]);

    const run = useCallback(async () => {
        setRunning(true);
        setDone(0);
        setSamples([]);

        const collected: (number | null)[] = [];
        for (let i = 0; i < ROUNDS; i++) {
            // Discard the first result: it pays for DNS and the TLS handshake,
            // which a phone already in the app has long since done.
            const ms = await pingOnce();
            if (i > 0) collected.push(ms);
            setSamples([...collected]);
            setDone(i + 1);
            await new Promise((r) => setTimeout(r, 250));
        }
        setRunning(false);
    }, []);

    useEffect(() => {
        run();
    }, [run]);

    const ok = samples.filter((v): v is number => v !== null);
    const lossRate = samples.length ? (samples.length - ok.length) / samples.length : 0;
    const latency = median(ok);
    const grade = samples.length === 0 ? null : gradeLatency(latency, lossRate);
    const copy = grade ? GRADE_COPY[grade] : null;

    return (
        <div className="relative min-h-[100dvh] py-6">
            <Ambient />

            <header className="mb-5 flex items-center justify-between gap-3">
                <h1 className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight text-on-surface">
                    <Signal className="size-5 text-primary" /> Connection check
                </h1>
                <Button asChild variant="text" size="sm">
                    <a href="/">
                        <ArrowLeft /> Dashboard
                    </a>
                </Button>
            </header>

            <main className="space-y-4">
                {/* ── Verdict ──────────────────────────────────────────── */}
                <Card
                    variant="elevated"
                    className={cn(
                        "p-6 text-center transition-colors duration-300",
                        grade ? GRADE_STYLE[grade] : "bg-surface-container-low"
                    )}
                >
                    {running && samples.length === 0 ? (
                        <>
                            <p className="mb-4 text-sm font-semibold">Testing…</p>
                            <Progress thickness={6} />
                        </>
                    ) : (
                        <>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                                Your connection
                            </p>
                            <p className="mt-2 font-display text-4xl font-extrabold leading-none">
                                {copy?.label ?? "—"}
                            </p>
                            <p className="mt-3 text-sm font-semibold leading-6">
                                {copy?.summary}
                            </p>
                        </>
                    )}
                </Card>

                {/* ── Numbers ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                    <Card variant="elevated" className="p-4 text-center">
                        <p className="font-display text-2xl font-extrabold tabular-nums text-on-surface">
                            {latency === null ? "—" : `${Math.round(latency)}`}
                            <span className="ml-0.5 text-sm font-bold">ms</span>
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                            Round trip
                        </p>
                    </Card>
                    <Card variant="elevated" className="p-4 text-center">
                        <p
                            className={cn(
                                "font-display text-2xl font-extrabold tabular-nums",
                                lossRate > 0 ? "text-error" : "text-on-surface"
                            )}
                        >
                            {Math.round(lossRate * 100)}
                            <span className="ml-0.5 text-sm font-bold">%</span>
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                            Requests lost
                        </p>
                    </Card>
                </div>

                {running && (
                    <p className="text-center text-xs text-on-surface-variant">
                        {done} of {ROUNDS} checks
                    </p>
                )}

                {/* ── What to do ───────────────────────────────────────── */}
                {copy && !running && (
                    <Card variant="elevated" className="p-5">
                        <h2 className="mb-2 text-sm font-bold text-on-surface">
                            What to do
                        </h2>
                        <p className="text-sm leading-6 text-on-surface-variant">
                            {copy.advice}
                        </p>
                    </Card>
                )}

                {/* ── What the numbers mean ────────────────────────────── */}
                <Card variant="elevated" className="p-5">
                    <h2 className="mb-3 text-sm font-bold text-on-surface">
                        What counts as good
                    </h2>
                    <div className="space-y-2 text-sm">
                        <Row
                            tone="bg-success-container"
                            label={`Under ${GOOD_MS}ms`}
                            note="Competitive on every game, buzzer included."
                        />
                        <Row
                            tone="bg-tertiary"
                            label={`${GOOD_MS}–${FAIR_MS}ms`}
                            note="Fine for trivia and bingo; a handicap on the buzzer."
                        />
                        <Row
                            tone="bg-error-container"
                            label={`Over ${FAIR_MS}ms`}
                            note="Answers may land late or get lost."
                        />
                    </div>
                    <p className="mt-4 text-xs leading-5 text-on-surface-variant">
                        The buzzer is decided by the order presses reach the server, so
                        a slow connection is a real disadvantage there. Trivia and bingo
                        are far more forgiving.
                    </p>
                </Card>

                {/* Sound has its own page — it needs room for per-cue
                    playback, and the sound desk shouldn't have to scroll past a
                    latency report to reach it. */}
                <Card variant="elevated" className="p-5">
                    <h2 className="mb-2 text-sm font-bold text-on-surface">Sound</h2>
                    <p className="mb-4 text-sm leading-6 text-on-surface-variant">
                        Turn sound on and hear every game cue on demand.
                    </p>
                    <Button asChild variant="tonal" className="w-full">
                        <a href="/sound">
                            <Volume2 /> Open sound check
                        </a>
                    </Button>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                    <Button variant="tonal" onClick={run} disabled={running}>
                        <RotateCcw /> {running ? "Testing…" : "Test again"}
                    </Button>
                    <Button asChild variant="filled">
                        <a href="/play">
                            <Gamepad2 /> Play
                        </a>
                    </Button>
                </div>
            </main>
        </div>
    );
}

function Row({
    tone,
    label,
    note,
}: {
    tone: string;
    label: string;
    note: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <span className={cn("mt-1 size-3 shrink-0 rounded-full", tone)} />
            <span className="min-w-0">
                <span className="font-semibold text-on-surface">{label}</span>
                <span className="block text-xs leading-5 text-on-surface-variant">
                    {note}
                </span>
            </span>
        </div>
    );
}
