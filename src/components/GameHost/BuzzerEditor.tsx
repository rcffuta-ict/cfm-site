"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    Zap,
    Save,
    RotateCcw,
    Play,
    Square,
    ChevronLeft,
    ChevronRight,
    Trophy,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { cn } from "@/src/lib/utils";
import { formatReaction } from "@/src/lib/games/buzzer";
import { useGameState } from "@/src/hooks/useGameState";

interface HostPrompt {
    id: string;
    text: string;
    orderIndex: number;
    open: boolean;
    presses: number;
}

interface BuzzerRound {
    id: string;
    status: string;
    isCurrent: boolean;
    config: { scoringPlaces: number; basePoints: number };
    prompts: HostPrompt[];
}

export default function BuzzerEditor({ onChanged }: { onChanged?: () => void }) {
    const { state, refetch } = useGameState();
    const [round, setRound] = useState<BuzzerRound | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [promptsText, setPromptsText] = useState("");
    const [scoringPlaces, setScoringPlaces] = useState(3);
    const [basePoints, setBasePoints] = useState(200);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/games/host/buzzer", { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            setRound(json.round);
            if (json.round) {
                setScoringPlaces(json.round.config.scoringPlaces);
                setBasePoints(json.round.config.basePoints);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const live = state?.buzzer ?? null;
    const isLiveRound = state?.round?.type === "buzzer" && state.round.status === "active";

    async function save() {
        const prompts = promptsText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        if (prompts.length === 0) {
            toast.error("Add at least one prompt");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/buzzer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompts, scoringPlaces, basePoints }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't save");
                return;
            }
            toast.success(
                json.keptCount > 0
                    ? `Added ${json.addedCount} · kept ${json.keptCount} already played`
                    : `${json.addedCount} prompts ready`
            );
            setPromptsText("");
            load();
            refetch();
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    async function control(action: string, promptId?: string) {
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/buzzer/control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, promptId }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "That didn't work");
                return;
            }
            load();
            refetch();
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
            toast.success("Buzzer round is live");
            load();
            refetch();
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    async function resetAll() {
        if (
            !window.confirm(
                "Clear every prompt and press so the buzzer can start over?"
            )
        )
            return;
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/buzzer", { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't reset");
                return;
            }
            toast.success("Buzzer reset");
            load();
            refetch();
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    if (loading)
        return (
            <Card variant="elevated" className="p-5">
                <p className="text-sm text-on-surface-variant">Loading buzzer…</p>
            </Card>
        );

    return (
        <div className="space-y-4">
            {/* ── Live control ─────────────────────────────────────────── */}
            {round && (
                <Card variant="elevated" className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-base font-bold text-on-surface">
                            <Zap className="size-5 text-tertiary" /> Running the buzzer
                        </h3>
                        <Chip
                            variant={live?.open ? "primary" : "outlined"}
                            size="sm"
                        >
                            {live?.open ? "Open" : "Closed"}
                        </Chip>
                    </div>

                    {!isLiveRound ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-on-surface-variant">
                                The buzzer round isn&apos;t live yet.
                            </p>
                            <Button
                                variant="tertiary"
                                onClick={startRound}
                                disabled={busy || round.prompts.length === 0}
                            >
                                <Play /> Start buzzer
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 rounded-md bg-surface-container-highest p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                                    {live && live.total > 0
                                        ? `Prompt ${live.index + 1} of ${live.total}`
                                        : "No prompt"}
                                </p>
                                <p className="mt-1 font-display text-lg font-extrabold leading-tight text-on-surface">
                                    {live?.promptText ?? "—"}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="tertiary"
                                    onClick={() => control("open")}
                                    disabled={busy}
                                >
                                    <Zap /> {live?.open ? "Re-open" : "Open buzzer"}
                                </Button>
                                <Button
                                    variant="tonal"
                                    onClick={() => control("close")}
                                    disabled={busy || !live?.open}
                                >
                                    <Square /> Close
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => control("prev")}
                                    disabled={busy || (live?.index ?? 0) <= 0}
                                >
                                    <ChevronLeft /> Previous
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => control("next")}
                                    disabled={
                                        busy ||
                                        !live ||
                                        live.index >= live.total - 1
                                    }
                                >
                                    Next <ChevronRight />
                                </Button>
                            </div>

                            <Button
                                variant="text"
                                className="mt-3 w-full"
                                onClick={() => control("reset")}
                                disabled={busy}
                            >
                                <RotateCcw /> Clear this prompt&apos;s presses
                            </Button>

                            {/* ── The race result ──────────────────────── */}
                            {live && live.presses.length > 0 && (
                                <div className="mt-5">
                                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                                        <Trophy className="size-3.5" /> Fastest fingers
                                    </p>
                                    <div className="space-y-1.5">
                                        {live.presses.map((p) => (
                                            <div
                                                key={p.position}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-sm px-3 py-2",
                                                    p.position <= live.scoringPlaces
                                                        ? "bg-success-container text-on-success-container"
                                                        : "bg-surface-container-highest text-on-surface"
                                                )}
                                            >
                                                <span className="w-5 shrink-0 font-display text-sm font-extrabold">
                                                    {p.position}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                                    {p.name}
                                                </span>
                                                <span className="shrink-0 font-mono text-xs tabular-nums opacity-80">
                                                    {formatReaction(p.reactionMs)}
                                                </span>
                                                {p.points > 0 && (
                                                    <span className="shrink-0 text-xs font-bold">
                                                        +{p.points}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </Card>
            )}

            {/* ── Prompts ──────────────────────────────────────────────── */}
            <Card variant="elevated" className="p-5">
                <h3 className="mb-1 text-base font-bold text-on-surface">
                    {round ? "Add prompts" : "Create the buzzer"}
                </h3>
                <p className="mb-4 text-xs leading-5 text-on-surface-variant">
                    One prompt per line. Prompts that have already been buzzed on
                    are kept; the rest are replaced.
                </p>

                <textarea
                    value={promptsText}
                    onChange={(e) => setPromptsText(e.target.value)}
                    disabled={busy}
                    rows={6}
                    placeholder={
                        "Who wrote the book of Acts?\nName the first RCF FUTA chaplain\nSing the first line of the anthem"
                    }
                    className="w-full rounded-t-xs bg-surface-container-highest p-4 font-mono text-sm text-on-surface caret-primary outline-none transition-colors duration-200 placeholder:text-on-surface-variant/50 hover:bg-surface-container-high focus:ring-2 focus:ring-primary disabled:opacity-40"
                />

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-surface-container-highest p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            Places that score
                        </p>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={10}
                            value={scoringPlaces}
                            onChange={(e) => setScoringPlaces(Number(e.target.value))}
                            disabled={busy}
                            className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-on-surface outline-none"
                        />
                    </div>
                    <div className="rounded-md bg-surface-container-highest p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            Points for 1st
                        </p>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={basePoints}
                            onChange={(e) => setBasePoints(Number(e.target.value))}
                            disabled={busy}
                            className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-on-surface outline-none"
                        />
                    </div>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                    2nd gets half, 3rd a third, and so on. Past {scoringPlaces} place
                    {scoringPlaces === 1 ? "" : "s"}, a press still counts but scores
                    nothing.
                </p>

                <div className="mt-5 flex gap-3">
                    <Button
                        variant="filled"
                        className="flex-1"
                        onClick={save}
                        disabled={busy}
                    >
                        <Save /> {round ? "Save prompts" : "Create buzzer"}
                    </Button>
                    {round && (
                        <Button variant="outlined" onClick={resetAll} disabled={busy}>
                            <RotateCcw /> Reset
                        </Button>
                    )}
                </div>
            </Card>

            {/* ── The list ─────────────────────────────────────────────── */}
            {round && round.prompts.length > 0 && (
                <Card variant="elevated" className="p-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        {round.prompts.length} prompt
                        {round.prompts.length === 1 ? "" : "s"}
                    </p>
                    <div className="space-y-2">
                        {round.prompts.map((p, i) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => control("open", p.id)}
                                disabled={busy || !isLiveRound}
                                className={cn(
                                    "state-layer flex w-full items-center gap-3 rounded-md p-3 text-left",
                                    p.id === live?.promptId
                                        ? "bg-secondary-container text-on-secondary-container"
                                        : "bg-surface-container-highest text-on-surface"
                                )}
                            >
                                <span className="w-5 shrink-0 text-center font-display text-sm font-extrabold">
                                    {i + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {p.text}
                                </span>
                                {p.presses > 0 && (
                                    <Chip variant="tertiary" size="sm">
                                        {p.presses}
                                    </Chip>
                                )}
                            </button>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
