"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Trophy, Megaphone, Star } from "lucide-react";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { Button } from "@/src/components/ui/button";
import { Progress } from "@/src/components/ui/progress";
import { cn } from "@/src/lib/utils";
import type { PublicBingo, PublicRound } from "@/src/lib/games/types";

type Layout = (number | null)[];

interface Win {
    pattern: string;
    position: number;
}

/**
 * The member's bingo card.
 *
 * Marking is optimistic — on patchy data the square fills the instant it's
 * tapped — but the server is the authority: it refuses any cell whose item
 * hasn't been called, and a refused tap rolls back with an explanation rather
 * than failing silently.
 */
export default function BingoPanel({
    round,
    bingo,
    helpers,
}: {
    round: PublicRound;
    bingo: PublicBingo;
    /**
     * On-screen assistance, off unless `GAME_HELPERS=1`. With it off the phone
     * shows the card and nothing else: what's been called comes from the caller
     * and the big screen, which is where the room should be looking.
     */
    helpers: boolean;
}) {
    const [layout, setLayout] = useState<Layout | null>(null);
    const [marks, setMarks] = useState<Set<number>>(new Set());
    const [win, setWin] = useState<Win | null>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const inflight = useRef<Set<number>>(new Set());

    const loadCard = useCallback(async () => {
        try {
            const res = await fetch("/api/games/bingo/card", { cache: "no-store" });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.error || "Couldn't get your card");
                return;
            }
            if (json.card) {
                setLayout(json.card.layout as Layout);
                setMarks(new Set<number>(json.marks ?? []));
                setWin(json.win ?? null);
            }
        } catch {
            toast.error("Couldn't reach the server");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCard();
    }, [loadCard]);

    const called = new Set(bingo.called);
    const isOpen = round.status === "active";

    async function toggle(cell: number) {
        if (!layout || !isOpen || win) return;
        const item = layout[cell];
        if (item === null) return; // free centre
        if (inflight.current.has(cell)) return;

        const wasMarked = marks.has(cell);

        // With helpers on, refuse locally so the feedback is instant. With them
        // off we let the request go and report it neutrally — naming the item
        // would hand back the very thing the helpers were hiding.
        if (helpers && !wasMarked && !called.has(item)) {
            toast(`"${bingo.items[item]}" hasn't been called yet`, { icon: "🔇" });
            return;
        }

        inflight.current.add(cell);
        setMarks((prev) => {
            const next = new Set(prev);
            if (wasMarked) next.delete(cell);
            else next.add(cell);
            return next;
        });

        try {
            const res = await fetch("/api/games/bingo/mark", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cellIndex: cell, marked: !wasMarked }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                // Roll back to what the server believes.
                setMarks((prev) => {
                    const next = new Set(prev);
                    if (wasMarked) next.add(cell);
                    else next.delete(cell);
                    return next;
                });
                toast.error(
                    helpers
                        ? json.error || "Couldn't mark that"
                        : "Not yet — listen for the call",
                    { icon: helpers ? undefined : "🔇" }
                );
            }
        } catch {
            setMarks((prev) => {
                const next = new Set(prev);
                if (wasMarked) next.add(cell);
                else next.delete(cell);
                return next;
            });
            toast.error("No connection — tap again");
        } finally {
            inflight.current.delete(cell);
        }
    }

    async function claim() {
        setClaiming(true);
        try {
            const res = await fetch("/api/games/bingo/claim", { method: "POST" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Not yet!");
                return;
            }
            setWin({ pattern: json.pattern, position: json.position });
            toast.success(
                json.already
                    ? "Already counted — you're in!"
                    : `BINGO! ${json.patternLabel} · #${json.position}`,
                { duration: 6000 }
            );
        } catch {
            toast.error("No connection — tap again");
        } finally {
            setClaiming(false);
        }
    }

    if (loading)
        return (
            <Card variant="elevated" className="p-5">
                <Progress thickness={4} />
            </Card>
        );

    if (!layout)
        return (
            <Card variant="elevated" className="p-6 text-center">
                <p className="text-sm text-on-surface-variant">
                    No card yet — hang on a moment.
                </p>
            </Card>
        );

    const lastCalled = bingo.called[0];

    return (
        <div className="space-y-4">
            {/* ── What was just called ─────────────────────────────────
                Helpers only. Without them the phone still shows how far along
                the game is — that's pacing, not an advantage — but never what
                was called. */}
            {helpers ? (
                <Card variant="elevated" className="p-5">
                    <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                            <Megaphone className="size-4" /> Just called
                        </span>
                        <Chip variant="neutral" size="sm">
                            {bingo.called.length} of {bingo.items.length}
                        </Chip>
                    </div>
                    <p className="mt-2 font-display text-2xl font-extrabold leading-tight text-on-surface">
                        {lastCalled === undefined
                            ? "Nothing yet…"
                            : bingo.items[lastCalled]}
                    </p>
                    {bingo.called.length > 1 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {bingo.called.slice(1, 7).map((i) => (
                                <Chip key={i} variant="outlined" size="sm">
                                    {bingo.items[i]}
                                </Chip>
                            ))}
                        </div>
                    )}
                </Card>
            ) : (
                <Card variant="elevated" className="flex items-center justify-between gap-3 p-4">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        <Megaphone className="size-4" /> Listen for the call
                    </span>
                    <Chip variant="neutral" size="sm">
                        {bingo.called.length} of {bingo.items.length}
                    </Chip>
                </Card>
            )}

            {/* ── The card ─────────────────────────────────────────────── */}
            <Card variant="elevated" className="p-4">
                <div
                    className="grid gap-1.5"
                    style={{
                        gridTemplateColumns: `repeat(${bingo.gridSize}, minmax(0, 1fr))`,
                    }}
                >
                    {layout.map((item, cell) => {
                        const free = item === null;
                        const isMarked = free || marks.has(cell);
                        // The tint that says "this one's been called" is the
                        // single biggest assist on the card, so it's gated too.
                        const showAsCalled =
                            helpers && (free || (item !== null && called.has(item)));

                        return (
                            <button
                                key={cell}
                                type="button"
                                onClick={() => toggle(cell)}
                                disabled={!isOpen || free || !!win}
                                aria-pressed={isMarked}
                                className={cn(
                                    "state-layer flex aspect-square items-center justify-center rounded-sm p-1 text-center",
                                    "text-[0.62rem] font-semibold leading-tight sm:text-[0.7rem]",
                                    "transition-colors duration-150 ease-standard",
                                    isMarked
                                        ? "bg-primary text-on-primary"
                                        : showAsCalled
                                          ? "bg-secondary-container text-on-secondary-container"
                                          : "bg-surface-container-highest text-on-surface-variant",
                                    !isOpen && "opacity-70"
                                )}
                            >
                                {free ? (
                                    <Star className="size-4" />
                                ) : (
                                    <span className="line-clamp-3 break-words">
                                        {bingo.items[item]}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <p className="mt-3 text-center text-xs text-on-surface-variant">
                    {win
                        ? "Your card is locked in."
                        : isOpen
                          ? "Tap a square once you hear it called."
                          : "Bingo isn't running right now."}
                </p>
            </Card>

            {/* ── Claim ────────────────────────────────────────────────── */}
            {win ? (
                <Card
                    variant="elevated"
                    className="bg-success-container p-5 text-center text-on-success-container"
                >
                    <Trophy className="mx-auto mb-2 size-6" />
                    <p className="font-display text-xl font-extrabold">
                        You got bingo!
                    </p>
                    <p className="mt-1 text-sm">
                        {win.position === 1
                            ? "First in the room."
                            : `Number ${win.position} to call it.`}
                    </p>
                </Card>
            ) : (
                <Button
                    variant="tertiary"
                    size="xl"
                    className="w-full"
                    onClick={claim}
                    disabled={!isOpen || claiming}
                >
                    {claiming ? "Checking…" : "BINGO!"}
                </Button>
            )}

            {bingo.winners.length > 0 && (
                <Card variant="elevated" className="p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        Already won
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {bingo.winners.map((w) => (
                            <Chip key={w.position} variant="tertiary" size="sm">
                                {w.position}. {w.name}
                            </Chip>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
