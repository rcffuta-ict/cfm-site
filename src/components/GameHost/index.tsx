"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    Play,
    Lock,
    Eye,
    SkipForward,
    Square,
    Tv,
    ListChecks,
    Timer,
    ArrowLeft,
    LayoutDashboard,
} from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { Progress } from "@/src/components/ui/progress";
import { useGameState, useCountdown } from "@/src/hooks/useGameState";
import QuestionEditor from "@/src/components/GameHost/QuestionEditor";
import { cn } from "@/src/lib/utils";

interface HostRound {
    id: string;
    type: string;
    status: string;
    orderIndex: number;
    question: string | null;
}

const STATUS_VARIANT: Record<
    string,
    "neutral" | "primary" | "tertiary" | "success" | "outlined"
> = {
    pending: "outlined",
    active: "primary",
    locked: "tertiary",
    revealed: "success",
    ended: "neutral",
};

export default function GameHost() {
    const { state, clockOffset, refetch, offline } = useGameState();
    const [rounds, setRounds] = useState<HostRound[]>([]);
    const [busy, setBusy] = useState(false);

    const round = state?.round ?? null;
    const remaining = useCountdown(
        round?.status === "active" ? round.endsAt : null,
        clockOffset
    );

    async function loadRounds() {
        try {
            const res = await fetch("/api/games/host/session", {
                cache: "no-store",
            });
            if (!res.ok) return;
            const json = await res.json();
            setRounds(json.rounds ?? []);
        } catch {
            // The poll loop already surfaces connectivity trouble.
        }
    }

    useEffect(() => {
        loadRounds();
    }, []);

    async function act(action: string, roundId?: string) {
        // Ending stops the game for the whole room and can't be undone from
        // here — a new session has to be created afterwards.
        if (
            action === "end" &&
            !window.confirm(
                "End the session for everyone? The TV drops back to standby and you'll need to create a new session to play again."
            )
        )
            return;

        setBusy(true);
        try {
            const res = await fetch("/api/games/host/round", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, roundId }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "That didn't work");
                return;
            }
            refetch();
            loadRounds();
        } catch {
            toast.error("Couldn't reach the server — try again");
        } finally {
            setBusy(false);
        }
    }

    const hasSession = !!state?.session;
    const status = round?.status;

    return (
        <div className="relative min-h-[100dvh] space-y-4 py-6">
            <Ambient />

            <header className="flex items-center justify-between gap-4 rounded-xl bg-surface-container-low p-5 shadow-e-1">
                <div className="flex min-w-0 items-center gap-3.5">
                    <CfmIcon width={36} height={36} priority />
                    <div className="min-w-0">
                        <h1 className="truncate font-display text-xl font-extrabold tracking-tight text-on-surface">
                            Game host
                        </h1>
                        <p className="truncate text-xs text-on-surface-variant">
                            {state?.session?.title ?? "No live session"}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {offline && (
                        <Chip variant="error" size="sm">
                            Reconnecting…
                        </Chip>
                    )}
                    <Button asChild variant="text" size="sm">
                        <a href="/admin">
                            <ArrowLeft /> Oracle
                        </a>
                    </Button>
                    <Button asChild variant="text" size="sm">
                        <a href="/">
                            <LayoutDashboard /> Dashboard
                        </a>
                    </Button>
                </div>
            </header>

            {hasSession && (
                <div className="grid gap-4 md:grid-cols-2">
                    {/* ── Now on screen ─────────────────────────────────── */}
                    <Card variant="elevated" className="overflow-hidden">
                        <div className="h-1">{busy && <Progress thickness={4} className="rounded-none" />}</div>
                        <div className="p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-on-surface">
                                <Tv className="size-5 text-primary" /> On screen
                            </h2>

                            {round ? (
                                <>
                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                        <Chip
                                            variant={
                                                STATUS_VARIANT[round.status] ??
                                                "neutral"
                                            }
                                            size="sm"
                                        >
                                            {round.status}
                                        </Chip>
                                        <Chip variant="neutral" size="sm">
                                            Question {round.orderIndex + 1}
                                        </Chip>
                                        {round.status === "active" && (
                                            <Chip
                                                variant={
                                                    remaining !== null &&
                                                    remaining <= 5
                                                        ? "error"
                                                        : "secondary"
                                                }
                                                size="sm"
                                            >
                                                <Timer /> {remaining ?? "—"}s
                                            </Chip>
                                        )}
                                    </div>

                                    <p className="mb-5 text-sm font-semibold leading-6 text-on-surface">
                                        {state?.question?.question ??
                                            "No question on this round."}
                                    </p>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                variant="tertiary"
                                                onClick={() => act("start")}
                                                disabled={
                                                    busy || status === "active"
                                                }
                                            >
                                                <Play /> Start
                                            </Button>
                                            <Button
                                                variant="tonal"
                                                onClick={() => act("lock")}
                                                disabled={
                                                    busy || status !== "active"
                                                }
                                            >
                                                <Lock /> Lock
                                            </Button>
                                            <Button
                                                variant="tonal"
                                                onClick={() => act("reveal")}
                                                disabled={
                                                    busy ||
                                                    !(
                                                        status === "locked" ||
                                                        status === "active"
                                                    )
                                                }
                                            >
                                                <Eye /> Reveal
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                onClick={() => act("next")}
                                                disabled={busy}
                                            >
                                                <SkipForward /> Next
                                            </Button>
                                        </div>
                                        <Button
                                            variant="danger"
                                            className="w-full"
                                            onClick={() => act("end")}
                                            disabled={busy}
                                        >
                                            <Square /> End session
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-on-surface-variant">
                                    All rounds finished.
                                </p>
                            )}
                        </div>
                    </Card>

                    {/* ── Run of show ───────────────────────────────────── */}
                    <Card variant="elevated" className="p-5">
                        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-on-surface">
                            <ListChecks className="size-5 text-secondary" /> Run of
                            show
                        </h2>
                        <div className="space-y-2">
                            {rounds.map((r) => (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => act("start", r.id)}
                                    disabled={busy}
                                    className={cn(
                                        "state-layer flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors duration-200 ease-standard",
                                        r.id === round?.id
                                            ? "bg-secondary-container text-on-secondary-container"
                                            : "bg-surface-container-highest text-on-surface"
                                    )}
                                >
                                    <span className="w-6 shrink-0 text-center font-display text-sm font-extrabold">
                                        {r.orderIndex + 1}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                        {r.question ?? "(no question)"}
                                    </span>
                                    <Chip
                                        variant={
                                            STATUS_VARIANT[r.status] ?? "neutral"
                                        }
                                        size="sm"
                                    >
                                        {r.status}
                                    </Chip>
                                </button>
                            ))}
                            {rounds.length === 0 && (
                                <p className="text-sm text-on-surface-variant">
                                    No rounds loaded yet.
                                </p>
                            )}
                        </div>

                        <Button asChild variant="tonal" className="mt-5 w-full">
                            <a href="/games" target="_blank">
                                <Tv /> Open TV screen
                            </a>
                        </Button>
                    </Card>
                </div>
            )}

            {/* Authoring lives below the live controls: during the programme the
                host works at the top of this page, and only comes down here
                between rounds or while setting up. */}
            <QuestionEditor
                onChanged={() => {
                    refetch();
                    loadRounds();
                }}
            />
        </div>
    );
}
