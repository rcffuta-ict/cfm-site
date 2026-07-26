"use client";

import { useEffect, useState } from "react";
import { Trophy, Timer, Lock, CheckCircle2, Megaphone } from "lucide-react";
import { createBrowserClient } from "@/src/lib/supabase/client";
import { GAME_CHANNEL, GAME_EVENTS } from "@/src/lib/games/channel";
import { useGameState, useCountdown } from "@/src/hooks/useGameState";
import type { LeaderboardEntry } from "@/src/lib/games/types";
import { CfmLogo } from "@/src/components/common/Brand";
import { Chip } from "@/src/components/ui/chip";
import { Avatar } from "@/src/components/ui/avatar";
import { Progress } from "@/src/components/ui/progress";
import { cn } from "@/src/lib/utils";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function GamesScreen() {
    const { state, clockOffset, offline, refetch } = useGameState();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

    const round = state?.round ?? null;
    const question = state?.question ?? null;
    const remaining = useCountdown(
        round?.status === "active" ? round.endsAt : null,
        clockOffset
    );

    /**
     * Realtime is a shortcut, not the mechanism — `useGameState` is already
     * polling. This just removes the poll delay on a transition, and if the
     * socket drops on bad wifi the screen keeps working a beat slower.
     */
    useEffect(() => {
        const supabase = createBrowserClient();
        const channel = supabase
            .channel(GAME_CHANNEL)
            .on("broadcast", { event: GAME_EVENTS.ROUND_UPDATE }, () => refetch())
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [refetch]);

    // The standings only matter at the reveal, so only fetch them then.
    useEffect(() => {
        if (round?.status !== "revealed") return;
        fetch("/api/games/leaderboard", { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => setLeaderboard(d.entries ?? []))
            .catch(() => {});
    }, [round?.status, round?.id]);

    const totalMs =
        round?.startsAt && round?.endsAt ? round.endsAt - round.startsAt : null;
    const progress =
        totalMs && remaining !== null
            ? Math.max(0, Math.min(100, ((remaining * 1000) / totalMs) * 100))
            : 0;

    return (
        <div className="relative flex min-h-[100dvh] flex-col gap-[clamp(1.5rem,3vh,3rem)] px-[clamp(1.5rem,4vw,5rem)] py-[clamp(1.5rem,4vh,3.5rem)]">
            <header className="flex items-center justify-between gap-6">
                <CfmLogo width={160} height={48} priority />
                <div className="flex items-center gap-3">
                    {offline && (
                        <Chip variant="error" size="tv">
                            Reconnecting…
                        </Chip>
                    )}
                    {round && (
                        <Chip variant="secondary" size="tv">
                            Question {round.orderIndex + 1}
                        </Chip>
                    )}
                </div>
            </header>

            {/* ── Idle ─────────────────────────────────────────────────── */}
            {(!round || round.status === "pending") && (
                <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                    <h1 className="font-display text-[clamp(2.5rem,7vw,6rem)] font-extrabold leading-none tracking-tight text-on-surface">
                        {state?.session?.title ?? "CFM Games"}
                    </h1>
                    <p className="text-[clamp(1.1rem,2.4vw,2rem)] text-on-surface-variant">
                        Get your phones ready…
                    </p>
                </div>
            )}

            {/* ── Bingo ───────────────────────────────────────────────── */}
            {round?.type === "bingo" && round.status !== "pending" && state?.bingo && (
                <div className="flex flex-1 flex-col justify-center gap-[clamp(1rem,3vh,2.5rem)]">
                    <div className="text-center">
                        <p className="flex items-center justify-center gap-3 text-[clamp(0.9rem,2vw,1.6rem)] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                            <Megaphone className="size-[1.1em]" /> Called
                        </p>
                        <p className="mt-4 font-display text-[clamp(2.6rem,9vw,7rem)] font-extrabold leading-[1.05] tracking-tight text-on-surface">
                            {state.bingo.called.length === 0
                                ? "Ready…"
                                : state.bingo.items[state.bingo.called[0]]}
                        </p>
                        <p className="mt-4 text-[clamp(0.9rem,1.8vw,1.4rem)] text-on-surface-variant">
                            {state.bingo.called.length} of {state.bingo.items.length}{" "}
                            called
                        </p>
                    </div>

                    {state.bingo.called.length > 1 && (
                        <div className="flex flex-wrap justify-center gap-2">
                            {state.bingo.called.slice(1, 12).map((i) => (
                                <Chip key={i} variant="neutral" size="tv">
                                    {state.bingo!.items[i]}
                                </Chip>
                            ))}
                        </div>
                    )}

                    {state.bingo.winners.length > 0 && (
                        <div className="rounded-xl bg-success-container p-[clamp(1rem,2.5vh,1.8rem)] text-on-success-container">
                            <p className="flex items-center justify-center gap-3 font-display text-[clamp(1.2rem,3vw,2.2rem)] font-extrabold">
                                <Trophy className="size-[1.1em]" />
                                {state.bingo.winners[0].name} got bingo!
                            </p>
                            {state.bingo.winners.length > 1 && (
                                <p className="mt-2 text-center text-[clamp(0.9rem,1.6vw,1.3rem)]">
                                    {state.bingo.winners
                                        .slice(1, 6)
                                        .map((w) => `${w.position}. ${w.name}`)
                                        .join("   ·   ")}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Question / Locked / Reveal ───────────────────────────── */}
            {round?.type === "trivia" && round.status !== "pending" && question && (
                <div className="flex flex-1 flex-col gap-[clamp(1rem,3vh,2.5rem)]">
                    {round.status === "active" && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-[clamp(1rem,2vw,1.6rem)] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                                    <Timer className="size-[1.1em]" /> Time left
                                </span>
                                <span
                                    className={cn(
                                        "font-display text-[clamp(2rem,5vw,4rem)] font-extrabold leading-none tabular-nums",
                                        remaining !== null && remaining <= 5
                                            ? "text-error"
                                            : "text-on-surface"
                                    )}
                                >
                                    {remaining ?? "—"}
                                </span>
                            </div>
                            <Progress value={progress} thickness={10} />
                        </div>
                    )}

                    {round.status === "locked" && (
                        <div className="flex items-center justify-center gap-3 text-[clamp(1.2rem,2.6vw,2.2rem)] font-bold uppercase tracking-[0.2em] text-tertiary">
                            <Lock className="size-[1.1em]" /> Answers locked
                        </div>
                    )}

                    <h2 className="font-display text-[clamp(1.8rem,4.5vw,4rem)] font-extrabold leading-[1.15] tracking-tight text-on-surface">
                        {question.question}
                    </h2>

                    <div className="grid gap-[clamp(0.6rem,1.5vh,1.2rem)] sm:grid-cols-2">
                        {question.options.map((option, index) => {
                            const isAnswer =
                                state?.correctIndex !== null &&
                                state?.correctIndex === index;
                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex items-center gap-4 rounded-lg p-[clamp(0.9rem,2vh,1.6rem)] transition-colors duration-300 ease-standard",
                                        isAnswer
                                            ? "bg-success-container text-on-success-container shadow-e-3"
                                            : "bg-surface-container-high text-on-surface"
                                    )}
                                >
                                    <span className="flex size-[clamp(2rem,3.5vw,3rem)] shrink-0 items-center justify-center rounded-md bg-surface-container-highest font-display text-[clamp(1rem,2vw,1.6rem)] font-extrabold">
                                        {OPTION_LABELS[index]}
                                    </span>
                                    <span className="text-[clamp(1.05rem,2.2vw,1.9rem)] font-semibold">
                                        {option}
                                    </span>
                                    {isAnswer && (
                                        <CheckCircle2 className="ml-auto size-[clamp(1.6rem,3vw,2.6rem)] shrink-0" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Leaderboard, at the reveal ───────────────────────────── */}
            {round?.status === "revealed" && leaderboard.length > 0 && (
                <div className="rounded-xl bg-surface-container-low p-[clamp(1rem,2.5vh,2rem)]">
                    <h3 className="mb-4 flex items-center gap-3 font-display text-[clamp(1.2rem,2.6vw,2rem)] font-extrabold text-on-surface">
                        <Trophy className="size-[1.1em] text-tertiary" /> Leaderboard
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {leaderboard.slice(0, 6).map((entry, index) => (
                            <div
                                key={entry.profileId}
                                className="flex items-center gap-3 rounded-md bg-surface-container-highest p-3"
                            >
                                <span className="w-8 shrink-0 text-center font-display text-[clamp(1rem,1.8vw,1.5rem)] font-extrabold text-primary">
                                    {index + 1}
                                </span>
                                <Avatar
                                    src={entry.avatarUrl}
                                    name={entry.name}
                                    size="sm"
                                />
                                <span className="min-w-0 flex-1 truncate text-[clamp(0.95rem,1.6vw,1.3rem)] font-semibold text-on-surface">
                                    {entry.name}
                                </span>
                                <span className="shrink-0 font-display text-[clamp(1rem,1.8vw,1.5rem)] font-extrabold tabular-nums text-on-surface">
                                    {entry.points}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
