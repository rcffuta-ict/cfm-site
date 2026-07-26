"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, Lock, CheckCircle2, RotateCcw, Hourglass, Signal } from "lucide-react";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { Progress } from "@/src/components/ui/progress";
import { useGameState, useCountdown } from "@/src/hooks/useGameState";
import BingoPanel from "@/src/components/BingoPanel";
import BuzzerPanel from "@/src/components/BuzzerPanel";
import ConnectionWatch from "@/src/components/ConnectionWatch";
import { useGameSounds, type UseSound } from "@/src/hooks/useSound";
import { cn } from "@/src/lib/utils";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

type Submission =
    | { status: "idle" }
    | { status: "sending"; choice: number }
    | { status: "sent"; choice: number }
    | { status: "failed"; choice: number; message: string };

/**
 * The member-facing game panel.
 *
 * Follows docs/game-plan.md §7: it switches itself to whatever is live so
 * nobody hunts for a tab, confirms a tap immediately rather than after the
 * network answers, and offers an explicit retry when a submission fails —
 * which on patchy mobile data matters more than almost anything else.
 */
export default function GamePanel({ sound }: { sound: UseSound }) {
    const { state, clockOffset, loading, offline, connection } = useGameState();
    const [submission, setSubmission] = useState<Submission>({ status: "idle" });
    const lastQuestionRef = useRef<string | null>(null);

    const round = state?.round ?? null;
    const question = state?.question ?? null;
    const remaining = useCountdown(
        round?.status === "active" ? round.endsAt : null,
        clockOffset
    );

    // A new question means a clean slate — otherwise the previous answer's
    // confirmation would carry over and look like it had been submitted.
    useEffect(() => {
        if (question?.id !== lastQuestionRef.current) {
            lastQuestionRef.current = question?.id ?? null;
            setSubmission({ status: "idle" });
        }
    }, [question?.id]);

    async function submit(choice: number) {
        if (!question) return;
        // Request first, feedback second — the speed bonus is measured from
        // when the answer reaches the server, so nothing decorative should sit
        // in front of it. The optimistic UI still updates on the same tick.
        const pending = fetch("/api/games/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: question.id, choiceIndex: choice }),
        });

        setSubmission({ status: "sending", choice });
        sound.play("tap");

        try {
            const res = await pending;
            const json = await res.json();
            if (!res.ok || !json.success) {
                // An already-recorded answer is a success from the member's
                // point of view — their tap did land, just earlier.
                if (json.duplicate) {
                    setSubmission({ status: "sent", choice });
                    return;
                }
                setSubmission({
                    status: "failed",
                    choice,
                    message: json.error || "Couldn't submit",
                });
                return;
            }
            setSubmission({ status: "sent", choice });
            sound.play("lockedIn");
        } catch {
            setSubmission({
                status: "failed",
                choice,
                message: "No connection",
            });
        }
    }

    // Phones get the buzzer-open cue and their own confirmations, but not the
    // round-transition fanfare — that belongs to the PA.
    useGameSounds(state, sound.play, { tv: false });

    // Mounted for the whole life of the panel so the warning can fire whatever
    // game is on screen.
    const watch = <ConnectionWatch connection={connection} />;

    const poorBanner =
        connection.grade === "poor" || connection.grade === "offline" ? (
            <a
                href="/network"
                className="state-layer mb-3 flex items-center gap-3 rounded-md bg-error-container p-3 text-sm font-semibold text-on-error-container"
            >
                <Signal className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                    Weak connection — you may be at a disadvantage. Tap to check.
                </span>
            </a>
        ) : null;

    if (loading) {
        return (
            <>
                {watch}
                <Card variant="elevated" className="p-5">
                    <Progress thickness={4} />
                </Card>
            </>
        );
    }

    // ── Each game gets its own surface; the poll decides which ──────────
    if (round && round.type === "bingo" && state?.bingo && round.status !== "pending")
        return (
            <>
                {watch}
                {poorBanner}
                <BingoPanel
                    round={round}
                    bingo={state.bingo}
                    helpers={state.helpers}
                    sound={sound}
                />
            </>
        );

    if (round && round.type === "buzzer" && state?.buzzer && round.status !== "pending")
        return (
            <>
                {watch}
                {poorBanner}
                <BuzzerPanel round={round} buzzer={state.buzzer} sound={sound} />
            </>
        );

    // ── Nothing live ────────────────────────────────────────────────────
    if (!round || round.status === "pending" || !question) {
        return (
            <>
                {watch}
                {poorBanner}
            <Card variant="elevated" className="p-6 text-center">
                <Hourglass className="mx-auto mb-3 size-6 text-on-surface-variant" />
                <p className="text-sm font-semibold text-on-surface">
                    Waiting for the next round…
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                    Keep this open — it switches over on its own.
                </p>
            </Card>
            </>
        );
    }

    const locked = round.status !== "active";
    const chosen =
        submission.status === "idle" ? null : submission.choice;

    return (
        <>
        {watch}
        {poorBanner}
        <Card variant="elevated" className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <Chip variant="neutral" size="sm">
                    Question {round.orderIndex + 1}
                </Chip>
                {round.status === "active" ? (
                    <Chip
                        variant={
                            remaining !== null && remaining <= 5
                                ? "error"
                                : "secondary"
                        }
                        size="sm"
                    >
                        <Timer /> {remaining ?? "—"}s
                    </Chip>
                ) : (
                    <Chip variant="tertiary" size="sm">
                        <Lock /> Locked
                    </Chip>
                )}
            </div>

            <p className="mb-5 text-base font-bold leading-6 text-on-surface">
                {question.question}
            </p>

            <div className="space-y-2.5">
                {question.options.map((option, index) => {
                    const isChosen = chosen === index;
                    const isAnswer =
                        state?.correctIndex !== null &&
                        state?.correctIndex === index;

                    return (
                        <button
                            key={index}
                            type="button"
                            disabled={locked || submission.status !== "idle"}
                            onClick={() => submit(index)}
                            className={cn(
                                "state-layer flex w-full items-center gap-3 rounded-md p-4 text-left transition-colors duration-200 ease-standard",
                                "disabled:pointer-events-none",
                                isAnswer
                                    ? "bg-success-container text-on-success-container"
                                    : isChosen
                                      ? "bg-primary-container text-on-primary-container"
                                      : "bg-surface-container-highest text-on-surface",
                                locked && !isChosen && !isAnswer && "opacity-50"
                            )}
                        >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-container font-display text-xs font-extrabold">
                                {OPTION_LABELS[index]}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-semibold">
                                {option}
                            </span>
                            {isChosen && submission.status === "sent" && (
                                <CheckCircle2 className="size-5 shrink-0" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Submission feedback ────────────────────────────────── */}
            {submission.status === "sending" && (
                <p className="mt-4 text-center text-sm font-semibold text-on-surface-variant">
                    Locking in…
                </p>
            )}
            {submission.status === "sent" && (
                <p className="mt-4 text-center text-sm font-semibold text-primary">
                    Answer locked in ✅
                </p>
            )}
            {submission.status === "failed" && (
                <button
                    type="button"
                    onClick={() => submit(submission.choice)}
                    className="state-layer mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-error-container p-3 text-sm font-semibold text-on-error-container"
                >
                    <RotateCcw className="size-4" />
                    {submission.message} — tap to retry
                </button>
            )}
            {offline && submission.status === "idle" && (
                <p className="mt-4 text-center text-xs text-on-surface-variant">
                    Reconnecting…
                </p>
            )}
        </Card>
        </>
    );
}
