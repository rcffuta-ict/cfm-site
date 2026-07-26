"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    Grid3x3,
    Megaphone,
    Undo2,
    RotateCcw,
    Play,
    Save,
    Trophy,
    Users,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { Switch } from "@/src/components/ui/switch";
import { cn } from "@/src/lib/utils";

interface BingoRound {
    id: string;
    status: string;
    orderIndex: number;
    config: {
        gridSize: number;
        freeCentre: boolean;
        pattern: "line" | "full";
        items: string[];
        basePoints: number;
    };
    called: number[];
    cardCount: number;
    winCount: number;
}

const GRIDS = [3, 4, 5];

/** Cells a card consumes — the free centre only exists on an odd grid. */
function cellsNeeded(gridSize: number, freeCentre: boolean) {
    return gridSize * gridSize - (freeCentre && gridSize % 2 === 1 ? 1 : 0);
}

export default function BingoEditor({ onChanged }: { onChanged?: () => void }) {
    const [round, setRound] = useState<BingoRound | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const [itemsText, setItemsText] = useState("");
    const [gridSize, setGridSize] = useState(5);
    const [freeCentre, setFreeCentre] = useState(true);
    const [pattern, setPattern] = useState<"line" | "full">("line");
    const [basePoints, setBasePoints] = useState(300);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/games/host/bingo", { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            setRound(json.round);
            if (json.round) {
                setItemsText(json.round.config.items.join("\n"));
                setGridSize(json.round.config.gridSize);
                setFreeCentre(json.round.config.freeCentre);
                setPattern(json.round.config.pattern);
                setBasePoints(json.round.config.basePoints);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const items = itemsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const need = cellsNeeded(gridSize, freeCentre);
    const enough = items.length >= need;
    const locked = (round?.cardCount ?? 0) > 0;

    async function save() {
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/bingo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items,
                    gridSize,
                    freeCentre,
                    pattern,
                    basePoints,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't save", { duration: 7000 });
                return;
            }
            toast.success(round ? "Bingo updated" : "Bingo created");
            load();
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    async function call(itemIndex?: number) {
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(itemIndex === undefined ? {} : { itemIndex }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't call");
                return;
            }
            toast.success(`Called: ${json.item}`);
            load();
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    async function undo() {
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/call", { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Nothing to undo");
                return;
            }
            toast.success("Last call undone");
            load();
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    async function reset() {
        if (
            !window.confirm(
                "Reset the bingo? Every card, mark, call and win is cleared so it can be played again from scratch."
            )
        )
            return;
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/bingo", { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't reset");
                return;
            }
            toast.success("Bingo reset");
            load();
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    async function startRound() {
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/round", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "start", roundId: round?.id }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't start");
                return;
            }
            toast.success("Bingo is live");
            load();
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    if (loading)
        return (
            <Card variant="elevated" className="p-5">
                <p className="text-sm text-on-surface-variant">Loading bingo…</p>
            </Card>
        );

    const called = new Set(round?.called ?? []);
    const isLive = round?.status === "active";

    return (
        <Card variant="elevated" className="p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                    <Grid3x3 className="size-5 text-secondary" /> Bingo
                    {round && (
                        <Chip
                            variant={isLive ? "primary" : "outlined"}
                            size="sm"
                        >
                            {round.status}
                        </Chip>
                    )}
                </h2>
                {round && (
                    <div className="flex items-center gap-2">
                        <Chip variant="neutral" size="sm">
                            <Users /> {round.cardCount} cards
                        </Chip>
                        {round.winCount > 0 && (
                            <Chip variant="success" size="sm">
                                <Trophy /> {round.winCount}
                            </Chip>
                        )}
                    </div>
                )}
            </div>

            {/* ── Calling ─────────────────────────────────────────────── */}
            {round && (
                <div className="mb-6 rounded-md bg-surface-container-highest p-4">
                    {!isLive ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-on-surface-variant">
                                Bingo isn&apos;t running yet.
                            </p>
                            <Button
                                variant="tertiary"
                                onClick={startRound}
                                disabled={busy || round.config.items.length === 0}
                            >
                                <Play /> Start bingo
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                                    {round.called.length} of{" "}
                                    {round.config.items.length} called
                                </span>
                                <span className="font-display text-lg font-extrabold text-on-surface">
                                    {round.called.length > 0
                                        ? round.config.items[round.called[0]]
                                        : "—"}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="tertiary"
                                    onClick={() => call()}
                                    disabled={
                                        busy ||
                                        round.called.length >=
                                            round.config.items.length
                                    }
                                >
                                    <Megaphone /> Call next
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={undo}
                                    disabled={busy || round.called.length === 0}
                                >
                                    <Undo2 /> Undo last
                                </Button>
                            </div>

                            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                                Or call one directly
                            </p>
                            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                                {round.config.items.map((item, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        disabled={busy || called.has(i)}
                                        onClick={() => call(i)}
                                        className={cn(
                                            "state-layer rounded-sm px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                                            called.has(i)
                                                ? "bg-surface-container text-on-surface-variant line-through opacity-50"
                                                : "border border-outline text-on-surface"
                                        )}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Setup ───────────────────────────────────────────────── */}
            <h3 className="mb-1 text-sm font-bold text-on-surface">
                {round ? "Card setup" : "Create the bingo"}
            </h3>
            <p className="mb-4 text-xs leading-5 text-on-surface-variant">
                One item per line. Everyone gets the same list shuffled into a
                different card.
            </p>

            {locked && (
                <p className="mb-3 rounded-md bg-error-container/40 p-3 text-xs leading-5 text-on-surface">
                    {round?.cardCount} card
                    {round?.cardCount === 1 ? " has" : "s have"} been handed out, so
                    the list is locked — changing it now would change what&apos;s
                    printed on them. Reset the bingo to start over.
                </p>
            )}

            <textarea
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                disabled={busy || locked}
                rows={8}
                placeholder={"Someone wearing red\nA choir member\nSomeone from 100L"}
                className="w-full rounded-t-xs bg-surface-container-highest p-4 font-mono text-sm text-on-surface caret-primary outline-none transition-colors duration-200 placeholder:text-on-surface-variant/50 hover:bg-surface-container-high focus:ring-2 focus:ring-primary disabled:opacity-40"
            />

            <p
                className={cn(
                    "mt-2 text-xs font-semibold",
                    enough ? "text-on-surface-variant" : "text-error"
                )}
            >
                {items.length} item{items.length === 1 ? "" : "s"} · a {gridSize}×
                {gridSize} card needs {need}
                {!enough && ` — ${need - items.length} more`}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        Card size
                    </p>
                    <div className="flex gap-2">
                        {GRIDS.map((g) => (
                            <button
                                key={g}
                                type="button"
                                disabled={busy || locked}
                                onClick={() => setGridSize(g)}
                                className={cn(
                                    "state-layer h-9 rounded-sm px-3 text-sm font-medium transition-colors duration-150",
                                    gridSize === g
                                        ? "bg-secondary-container text-on-secondary-container"
                                        : "border border-outline text-on-surface-variant"
                                )}
                            >
                                {g}×{g}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        To win
                    </p>
                    <div className="flex gap-2">
                        {(["line", "full"] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                disabled={busy || locked}
                                onClick={() => setPattern(p)}
                                className={cn(
                                    "state-layer h-9 rounded-sm px-3 text-sm font-medium transition-colors duration-150",
                                    pattern === p
                                        ? "bg-secondary-container text-on-secondary-container"
                                        : "border border-outline text-on-surface-variant"
                                )}
                            >
                                {p === "line" ? "Any line" : "Full house"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-md bg-surface-container-highest p-4">
                <div>
                    <p className="text-sm font-semibold text-on-surface">
                        Free centre square
                    </p>
                    <p className="text-xs text-on-surface-variant">
                        {gridSize % 2 === 1
                            ? "Starts already marked."
                            : "Only possible on odd-sized cards."}
                    </p>
                </div>
                <Switch
                    checked={freeCentre && gridSize % 2 === 1}
                    onCheckedChange={setFreeCentre}
                    disabled={busy || locked || gridSize % 2 === 0}
                    aria-label="Free centre square"
                />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-md bg-surface-container-highest p-4">
                <p className="text-sm font-semibold text-on-surface">
                    Points for first win
                </p>
                <input
                    type="number"
                    inputMode="numeric"
                    value={basePoints}
                    onChange={(e) => setBasePoints(Number(e.target.value))}
                    disabled={busy || locked}
                    className="w-24 rounded-sm bg-surface-container px-3 py-2 text-right font-display text-lg font-extrabold tabular-nums text-on-surface outline-none focus:ring-2 focus:ring-primary disabled:opacity-40"
                />
            </div>

            <div className="mt-5 flex gap-3">
                <Button
                    variant="filled"
                    className="flex-1"
                    onClick={save}
                    disabled={busy || locked || !enough}
                >
                    <Save /> {round ? "Save setup" : "Create bingo"}
                </Button>
                {round && (
                    <Button variant="outlined" onClick={reset} disabled={busy}>
                        <RotateCcw /> Reset
                    </Button>
                )}
            </div>
        </Card>
    );
}
