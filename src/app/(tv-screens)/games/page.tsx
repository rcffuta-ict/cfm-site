"use client";

import { useEffect, useState } from "react";
import { Trophy, Timer, Lock, CheckCircle2, Megaphone, Zap, Volume2, VolumeX } from "lucide-react";
import { formatReaction } from "@/src/lib/games/buzzer";
import { createBrowserClient } from "@/src/lib/supabase/client";
import { GAME_CHANNEL, GAME_EVENTS } from "@/src/lib/games/channel";
import { useGameState, useCountdown } from "@/src/hooks/useGameState";
import { useSound, useGameSounds } from "@/src/hooks/useSound";
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

    // The TV runs through the church PA, so it's the loud one. `ready` is the
    // browser's autoplay gate, which nothing can bypass without a real click —
    // hence the prompt below.
    const sound = useSound(true, 1);

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

    useGameSounds(state, sound.play, { tv: true, remaining });

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
                    {round && round.type === "trivia" && (
                        <Chip variant="secondary" size="tv">
                            Question {round.orderIndex + 1}
                        </Chip>
                    )}
                    {round && round.type === "bingo" && (
                        <Chip variant="secondary" size="tv">Bingo</Chip>
                    )}
                    {round && round.type === "buzzer" && (
                        <Chip variant="secondary" size="tv">Buzzer</Chip>
                    )}
                    {/* <button
                        type="button"
                        onClick={sound.ready ? sound.toggle : sound.enable}
                        aria-label={sound.enabled && sound.ready ? "Mute" : "Enable sound"}
                        className="state-layer grid size-12 place-items-center rounded-full text-on-surface-variant"
                    >
                        {sound.enabled && sound.ready ? (
                            <Volume2 className="size-6" />
                        ) : (
                            <VolumeX className="size-6" />
                        )}
                    </button> */}
                </div>
            </header>

            {/* ── Autoplay gate ────────────────────────────────────────
                Browsers refuse to start audio until someone has clicked the
                page, and nobody touches a TV once it's set up. Without this
                prompt the sound would simply never play and there'd be no clue
                why — so it takes over the screen until it's dealt with. */}
            {!sound.ready && (
                <button
                    type="button"
                    onClick={sound.enable}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/88 p-8 text-center backdrop-blur-sm"
                >
                    <Volume2 className="size-[clamp(3rem,8vw,6rem)] text-tertiary" />
                    <span className="font-display text-[clamp(1.8rem,5vw,3.5rem)] font-extrabold leading-tight tracking-tight text-on-surface">
                        Tap anywhere to turn on sound
                    </span>
                    <span className="max-w-2xl text-[clamp(0.95rem,2vw,1.5rem)] text-on-surface-variant">
                        Do this once before the programme starts. Check the
                        volume on the sound desk at the same time.
                    </span>
                </button>
            )}

            {/* ── Idle ─────────────────────────────────────────────────
                Deliberately not the session title: that's an admin's label
                ("CFM Trivia") and it would contradict the one thing this screen
                is for — one surface, whichever game is running. */}
            {(!round || round.status === "pending") && (
                <div className="flex flex-1 flex-col items-center justify-center gap-[clamp(1.5rem,4vh,3rem)] text-center">
                    {/* Each letter takes one of the three brand accents, so the
                        monogram carries the identity without a logo file. */}
                    <h1
                        className="flex items-baseline justify-center gap-[0.06em] font-display font-extrabold uppercase leading-[0.85] tracking-[-0.04em]"
                        style={{ fontSize: "clamp(5rem, 22vw, 18rem)" }}
                        aria-label="CFM Games"
                    >
                        <span className="animate-letter-in text-primary [animation-delay:0ms]">C</span>
                        <span className="animate-letter-in text-secondary [animation-delay:120ms]">F</span>
                        <span className="animate-letter-in text-tertiary [animation-delay:240ms]">M</span>
                    </h1>

                    <div className="space-y-[clamp(0.4rem,1.2vh,0.9rem)]">
                        <p className="font-display text-[clamp(1.4rem,4.5vw,3.4rem)] font-extrabold uppercase leading-none tracking-[0.02em] text-on-surface">
                            Combined Family Meeting
                        </p>
                        <p className="text-[clamp(0.85rem,2vw,1.6rem)] font-semibold uppercase tracking-[0.4em] text-on-surface-variant">
                            Games
                        </p>
                    </div>

                    <div className="mt-[clamp(0.5rem,2vh,1.5rem)] flex flex-wrap items-center justify-center gap-3">
                        <Chip variant="primary" size="tv">Trivia</Chip>
                        <Chip variant="secondary" size="tv">Bingo</Chip>
                        <Chip variant="tertiary" size="tv">Buzzer</Chip>
                    </div>

                    <p className="flex items-center gap-3 text-[clamp(1rem,2.2vw,1.9rem)] text-on-surface-variant">
                        <span className="size-[0.5em] animate-pulse-dot rounded-full bg-primary" />
                        Grab your phone and open the app
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

            {/* ── Buzzer ──────────────────────────────────────────────── */}
            {round?.type === "buzzer" && round.status !== "pending" && state?.buzzer && (
                <div className="flex flex-1 flex-col justify-center gap-[clamp(1rem,3vh,2.5rem)]">
                    <div className="text-center">
                        <p
                            className={cn(
                                "flex items-center justify-center gap-3 text-[clamp(0.9rem,2vw,1.6rem)] font-semibold uppercase tracking-[0.22em]",
                                state.buzzer.open
                                    ? "text-tertiary"
                                    : "text-on-surface-variant"
                            )}
                        >
                            <Zap className="size-[1.1em]" />
                            {state.buzzer.open ? "Buzzers open" : "Get ready"}
                        </p>
                        <p className="mt-4 font-display text-[clamp(1.8rem,5vw,4.2rem)] font-extrabold leading-[1.1] tracking-tight text-on-surface">
                            {state.buzzer.promptText ?? "…"}
                        </p>
                    </div>

                    {state.buzzer.presses.length === 0 ? (
                        <p className="text-center text-[clamp(1rem,2.2vw,1.8rem)] text-on-surface-variant">
                            {state.buzzer.open
                                ? "Waiting for the first finger…"
                                : "Buzzers are closed."}
                        </p>
                    ) : (
                        <>
                            {/* First place gets the full width — with 500 people
                                racing, the winner is the only thing most of the
                                hall is looking for. */}
                            <div className="mx-auto w-full max-w-5xl rounded-xl bg-tertiary p-[clamp(0.9rem,2.5vh,1.8rem)] text-on-tertiary shadow-e-3">
                                <div className="flex items-center gap-5">
                                    <span className="font-display text-[clamp(2rem,6vw,4.5rem)] font-extrabold leading-none">
                                        1
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-display text-[clamp(1.4rem,4.5vw,3.4rem)] font-extrabold leading-tight">
                                        {state.buzzer.presses[0].name}
                                    </span>
                                    <span className="shrink-0 font-mono text-[clamp(0.9rem,2vw,1.7rem)] tabular-nums opacity-85">
                                        {formatReaction(state.buzzer.presses[0].reactionMs)}
                                    </span>
                                </div>
                            </div>

                            {/* The rest go in a grid rather than a column: a TV
                                can't be scrolled, so runners-up have to fit the
                                screen sideways. */}
                            {state.buzzer.presses.length > 1 && (
                                <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-[clamp(0.35rem,1vh,0.7rem)] sm:grid-cols-3 lg:grid-cols-4">
                                    {state.buzzer.presses
                                        .slice(1, 9)
                                        .map((press) => (
                                            <div
                                                key={press.position}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-lg p-[clamp(0.5rem,1.3vh,0.9rem)]",
                                                    press.position <=
                                                        state.buzzer!.scoringPlaces
                                                        ? "bg-success-container text-on-success-container"
                                                        : "bg-surface-container-high text-on-surface"
                                                )}
                                            >
                                                <span className="shrink-0 font-display text-[clamp(0.95rem,1.9vw,1.6rem)] font-extrabold leading-none opacity-80">
                                                    {press.position}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-[clamp(0.8rem,1.6vw,1.3rem)] font-bold">
                                                    {press.name}
                                                </span>
                                                <span className="shrink-0 font-mono text-[clamp(0.65rem,1.2vw,1rem)] tabular-nums opacity-75">
                                                    {formatReaction(press.reactionMs)}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </>
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

            {/* ── Leaderboard, at the reveal ─────────────────────────────
                Split by game so people can see where the points came from —
                with three games running, a single total hides who's actually
                been carrying which one. */}
            {round?.status === "revealed" && leaderboard.length > 0 && (
                <div className="rounded-xl bg-surface-container-low p-[clamp(1rem,2.5vh,2rem)]">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <h3 className="flex items-center gap-3 font-display text-[clamp(1.2rem,2.6vw,2rem)] font-extrabold text-on-surface">
                            <Trophy className="size-[1.1em] text-tertiary" /> Leaderboard
                        </h3>
                        <div className="flex items-center gap-3 text-[clamp(0.6rem,1.1vw,0.9rem)] font-semibold uppercase tracking-[0.16em]">
                            <span className="text-primary">Trivia</span>
                            <span className="text-secondary">Bingo</span>
                            <span className="text-tertiary">Buzzer</span>
                        </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                        {leaderboard.slice(0, 8).map((entry, index) => (
                            <div
                                key={entry.profileId}
                                className={cn(
                                    "flex items-center gap-3 rounded-md p-3",
                                    index === 0
                                        ? "bg-tertiary text-on-tertiary"
                                        : "bg-surface-container-highest text-on-surface"
                                )}
                            >
                                <span className="w-7 shrink-0 text-center font-display text-[clamp(1rem,1.8vw,1.5rem)] font-extrabold">
                                    {index + 1}
                                </span>
                                <Avatar src={entry.avatarUrl} name={entry.name} size="sm" />

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[clamp(0.95rem,1.6vw,1.3rem)] font-semibold">
                                        {entry.name}
                                    </p>
                                    {/* Per-game split, in the same colour order as
                                        the key above. Zeroes are dropped so the
                                        line stays readable at a distance. */}
                                    <p className="flex flex-wrap gap-x-3 text-[clamp(0.65rem,1.1vw,0.9rem)] font-semibold tabular-nums opacity-80">
                                        {entry.trivia > 0 && <span>T {entry.trivia}</span>}
                                        {entry.bingo > 0 && <span>B {entry.bingo}</span>}
                                        {entry.buzzer > 0 && <span>Z {entry.buzzer}</span>}
                                    </p>
                                </div>

                                <span className="shrink-0 font-display text-[clamp(1.1rem,2vw,1.7rem)] font-extrabold tabular-nums">
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
