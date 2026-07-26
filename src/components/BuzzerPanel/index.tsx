"use client";

import { useEffect, useRef, useState } from "react";
import { Zap, Trophy, Hourglass } from "lucide-react";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { cn } from "@/src/lib/utils";
import { ordinal, formatReaction } from "@/src/lib/games/buzzer";
import type { PublicBuzzer, PublicRound } from "@/src/lib/games/types";
import type { UseSound } from "@/src/hooks/useSound";

type Press =
    | { state: "idle" }
    | { state: "sending" }
    | { state: "in"; position: number; reactionMs: number | null; points?: number }
    | { state: "failed"; message: string };

/**
 * The buzzer.
 *
 * Everything here is in service of the tap feeling instantaneous — the button
 * responds on `pointerdown`, not click, and confirms locally before the network
 * answers. None of that decides who won: the position comes back from the
 * server, which is the only thing that could ever judge it fairly.
 */
export default function BuzzerPanel({
    round,
    buzzer,
    sound,
}: {
    round: PublicRound;
    buzzer: PublicBuzzer;
    sound: UseSound;
}) {
    const [press, setPress] = useState<Press>({ state: "idle" });
    const lastPromptRef = useRef<string | null>(null);

    // A new prompt is a new race — clear whatever the last one left on screen.
    useEffect(() => {
        if (buzzer.promptId !== lastPromptRef.current) {
            lastPromptRef.current = buzzer.promptId;
            setPress({ state: "idle" });
        }
    }, [buzzer.promptId]);

    const open = round.status === "active" && buzzer.open;

    async function buzz() {
        if (!open || press.state !== "idle") return;

        // ── Order matters here ──────────────────────────────────────────
        // The request goes out FIRST, before any feedback. Position is decided
        // by arrival order at the server, so anything done ahead of the fetch —
        // starting a sound, buzzing the motor — is time taken off this person's
        // place. Feedback follows on the next line and still lands instantly to
        // a human.
        const pending = fetch("/api/games/buzzer/press", { method: "POST" });

        setPress({ state: "sending" });
        sound.play("buzzed");

        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try {
                navigator.vibrate(60);
            } catch {
                // Unsupported or blocked — it's a flourish, not a feature.
            }
        }

        try {
            const res = await pending;
            const json = await res.json();
            if (!res.ok || !json.success) {
                setPress({ state: "failed", message: json.error || "Missed it" });
                return;
            }
            setPress({
                state: "in",
                position: json.position,
                reactionMs: json.reactionMs,
                points: json.points,
            });
        } catch {
            setPress({ state: "failed", message: "No connection" });
        }
    }

    return (
        <div className="space-y-4">
            {/* ── The prompt ───────────────────────────────────────────── */}
            <Card variant="elevated" className="p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        {buzzer.total > 0
                            ? `Prompt ${buzzer.index + 1} of ${buzzer.total}`
                            : "Buzzer"}
                    </span>
                    <Chip variant={open ? "primary" : "neutral"} size="sm">
                        {open ? "Open" : "Closed"}
                    </Chip>
                </div>
                <p className="font-display text-lg font-extrabold leading-tight text-on-surface">
                    {buzzer.promptText ?? "Waiting for the host…"}
                </p>
                <p className="mt-2 text-xs text-on-surface-variant">
                    Top {buzzer.scoringPlaces} score.
                </p>
            </Card>

            {/* ── The button ───────────────────────────────────────────── */}
            {press.state === "in" ? (
                <Card
                    variant="elevated"
                    className={cn(
                        "p-8 text-center",
                        press.position === 1
                            ? "bg-tertiary text-on-tertiary"
                            : press.position <= buzzer.scoringPlaces
                              ? "bg-success-container text-on-success-container"
                              : "bg-surface-container-highest text-on-surface"
                    )}
                >
                    <Trophy className="mx-auto mb-2 size-7" />
                    <p className="font-display text-3xl font-extrabold leading-none">
                        {ordinal(press.position)}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                        {formatReaction(press.reactionMs)}
                        {press.points ? ` · ${press.points} pts` : ""}
                    </p>
                    {press.position === 1 && (
                        <p className="mt-1 text-sm opacity-90">
                            You were first in the room.
                        </p>
                    )}
                </Card>
            ) : (
                <button
                    type="button"
                    // pointerdown, not click — it fires earlier, and on a race
                    // that difference is the whole game.
                    onPointerDown={buzz}
                    disabled={!open || press.state === "sending"}
                    className={cn(
                        "flex aspect-square w-full select-none items-center justify-center rounded-full",
                        "font-display text-4xl font-extrabold uppercase tracking-[0.1em]",
                        "transition-transform duration-75 ease-standard",
                        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-surface",
                        open
                            ? "bg-tertiary text-on-tertiary shadow-e-5 active:scale-95"
                            : "bg-surface-container-highest text-on-surface-variant",
                        press.state === "sending" && "scale-95 opacity-80"
                    )}
                >
                    {open ? (
                        <span className="flex flex-col items-center gap-2">
                            <Zap className="size-10" strokeWidth={2.5} />
                            {press.state === "sending" ? "…" : "BUZZ"}
                        </span>
                    ) : (
                        <span className="flex flex-col items-center gap-2 text-base tracking-normal">
                            <Hourglass className="size-8" />
                            Wait for it
                        </span>
                    )}
                </button>
            )}

            {press.state === "failed" && (
                <p className="text-center text-sm font-semibold text-error">
                    {press.message}
                </p>
            )}

            {/* ── Who got there first ──────────────────────────────────── */}
            {buzzer.presses.length > 0 && (
                <Card variant="elevated" className="p-4">
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        Fastest fingers
                    </p>
                    <div className="space-y-1.5">
                        {buzzer.presses.slice(0, 5).map((p) => (
                            <div
                                key={p.position}
                                className="flex items-center gap-3 rounded-sm bg-surface-container-highest px-3 py-2"
                            >
                                <span className="w-6 shrink-0 font-display text-sm font-extrabold text-primary">
                                    {p.position}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">
                                    {p.name}
                                </span>
                                <span className="shrink-0 font-mono text-xs tabular-nums text-on-surface-variant">
                                    {formatReaction(p.reactionMs)}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
