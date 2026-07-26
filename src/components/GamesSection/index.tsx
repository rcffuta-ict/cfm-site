"use client";

import { useEffect, useState } from "react";
import { Gamepad2, ChevronRight, Grid3x3, Brain, Zap } from "lucide-react";
import { Chip } from "@/src/components/ui/chip";
import { cn } from "@/src/lib/utils";

interface CatalogGame {
    type: "trivia" | "bingo" | "buzzer";
    name: string;
    blurb: string;
    live: boolean;
    total: number;
    done: number;
}

const ICONS = {
    trivia: Brain,
    bingo: Grid3x3,
    buzzer: Zap,
} as const;

/**
 * The evening's line-up on the dashboard.
 *
 * Every game opens the same `/play` surface, which switches itself to whatever
 * the host has running — so this is a bill of what's on, not a set of separate
 * destinations. Games the host hasn't set up simply don't appear; there's no
 * value in showing a member a locked door.
 */
export default function GamesSection() {
    const [games, setGames] = useState<CatalogGame[]>([]);
    const [hasSession, setHasSession] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let alive = true;

        async function load() {
            try {
                const res = await fetch("/api/games/catalog", { cache: "no-store" });
                if (!res.ok || !alive) return;
                const json = await res.json();
                setGames(json.games ?? []);
                setHasSession(!!json.hasSession);
            } catch {
                // Nothing to show is the right fallback here.
            } finally {
                if (alive) setLoaded(true);
            }
        }

        load();
        // Slow refresh: this is a line-up, not live state. The play screen
        // handles anything time-critical.
        const id = setInterval(load, 30_000);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, []);

    if (!loaded) return null;

    return (
        <section className="rounded-xl bg-surface-container-low p-5 shadow-e-1">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                    <Gamepad2 className="size-5 text-tertiary" /> Games
                </h2>
                {games.some((g) => g.live) && (
                    <Chip variant="primary" size="sm">
                        <span className="size-1.5 animate-pulse-dot rounded-full bg-on-primary-container" />
                        Live now
                    </Chip>
                )}
            </div>

            {!hasSession || games.length === 0 ? (
                <p className="text-sm leading-6 text-on-surface-variant">
                    Nothing running yet. The games open up during the programme —
                    check back when the host announces them.
                </p>
            ) : (
                <div className="space-y-2.5">
                    {games.map((game) => {
                        const Icon = ICONS[game.type] ?? Gamepad2;
                        return (
                            <a
                                key={game.type}
                                href="/play"
                                className={cn(
                                    "state-layer flex items-center gap-3.5 rounded-md p-4 transition-colors duration-200 ease-standard",
                                    game.live
                                        ? "bg-tertiary text-on-tertiary"
                                        : "bg-surface-container-highest text-on-surface"
                                )}
                            >
                                <Icon className="size-5 shrink-0" />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                        <span className="font-display text-base font-extrabold leading-tight">
                                            {game.name}
                                        </span>
                                        {game.live && (
                                            <span className="rounded-sm bg-black/20 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em]">
                                                Live
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className={cn(
                                            "block text-sm",
                                            game.live
                                                ? "opacity-90"
                                                : "text-on-surface-variant"
                                        )}
                                    >
                                        {game.blurb}
                                    </span>
                                </span>
                                <ChevronRight className="size-5 shrink-0" />
                            </a>
                        );
                    })}
                </div>
            )}

            <a
                href="/play"
                className="state-layer mt-4 flex items-center justify-center gap-2 rounded-md border border-outline p-3 text-sm font-semibold text-primary"
            >
                Open the game screen
                <ChevronRight className="size-4" />
            </a>
        </section>
    );
}
