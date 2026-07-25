"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Sparkles, Hourglass } from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import GamePanel from "@/src/components/GamePanel";

/**
 * Two states: the Oracle-ID gate, then the game itself.
 *
 * Membership is checked against the server (`/api/games/join`) rather than
 * localStorage, so a member who refreshes, switches phone, or runs out of
 * battery mid-programme comes straight back into the game.
 */
export default function PlayScreen() {
    const [checking, setChecking] = useState(true);
    const [joined, setJoined] = useState(false);
    const [hasSession, setHasSession] = useState(false);
    const [sessionTitle, setSessionTitle] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function refreshJoinState() {
        try {
            const res = await fetch("/api/games/join", { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            setJoined(!!json.joined);
            setHasSession(!!json.hasSession);
            setSessionTitle(json.sessionTitle ?? null);
        } catch {
            // Leave the gate up; the join attempt will surface the real error.
        } finally {
            setChecking(false);
        }
    }

    useEffect(() => {
        refreshJoinState();
        // Members often open this before the host has started anything.
        const id = setInterval(() => {
            if (!joined) refreshJoinState();
        }, 10_000);
        return () => clearInterval(id);
    }, [joined]);

    async function join() {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/games/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setError(json.error || "Couldn't join");
                return;
            }
            setJoined(true);
            toast.success("You're in!");
        } catch {
            setError("No connection — try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="relative min-h-[100dvh] px-4 py-6">
            <Ambient />

            <header className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <CfmIcon width={32} height={32} priority />
                    <div>
                        <h1 className="font-display text-lg font-extrabold leading-tight tracking-tight text-on-surface">
                            {sessionTitle ?? "CFM Games"}
                        </h1>
                        <p className="text-xs text-on-surface-variant">
                            {joined ? "You're in the game" : "Enter to play"}
                        </p>
                    </div>
                </div>
                <Button asChild variant="text" size="sm">
                    <a href="/">
                        <ArrowLeft /> Dashboard
                    </a>
                </Button>
            </header>

            {checking && (
                <Card variant="elevated" className="p-5">
                    <Progress thickness={4} />
                </Card>
            )}

            {/* ── No game running yet ──────────────────────────────────── */}
            {!checking && !hasSession && (
                <Card variant="elevated" className="p-8 text-center">
                    <Hourglass className="mx-auto mb-3 size-7 text-on-surface-variant" />
                    <p className="text-base font-bold text-on-surface">
                        The game hasn&apos;t started yet
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-on-surface-variant">
                        Keep this page open — it&apos;ll let you in as soon as the
                        host opens the first round.
                    </p>
                </Card>
            )}

            {/* ── Oracle ID gate ───────────────────────────────────────── */}
            {!checking && hasSession && !joined && (
                <Card variant="elevated" className="p-6">
                    <div className="text-center">
                        <Sparkles className="mx-auto mb-3 size-7 text-tertiary" />
                        <h2 className="font-display text-xl font-extrabold text-on-surface">
                            Enter your Oracle ID
                        </h2>
                        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-on-surface-variant">
                            It&apos;s the number on your dashboard — the same one the
                            Oracle draws from.
                        </p>
                    </div>

                    <input
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value.replace(/\D/g, ""));
                            setError(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && code && !submitting) join();
                        }}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label="Your Oracle ID"
                        placeholder="0000"
                        disabled={submitting}
                        className="mt-6 w-full rounded-md bg-surface-container-highest px-4 py-5 text-center font-display text-4xl font-extrabold tracking-[0.2em] text-on-surface caret-primary outline-none placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary disabled:opacity-40"
                    />

                    {error && (
                        <p className="mt-3 text-center text-sm font-semibold text-error">
                            {error}
                        </p>
                    )}

                    <Button
                        variant="tertiary"
                        size="xl"
                        className="mt-5 w-full"
                        onClick={join}
                        disabled={submitting || !code}
                    >
                        {submitting ? "Checking…" : "Join the game"}
                    </Button>
                </Card>
            )}

            {/* ── In the game ──────────────────────────────────────────── */}
            {!checking && joined && <GamePanel />}
        </div>
    );
}
