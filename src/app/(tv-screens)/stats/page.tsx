"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy, Crown, Flame } from "lucide-react";
import { createBrowserClient } from "@/src/lib/supabase/client";
import { STATS_CHANNEL, STATS_EVENTS } from "@/src/lib/stats/channel";
import { CfmLogo } from "@/src/components/common/Brand";
import { Chip } from "@/src/components/ui/chip";
import { Progress } from "@/src/components/ui/progress";

interface LevelCount {
    level: string;
    count: number;
}
interface StatsData {
    total: number;
    levels: LevelCount[];
    eventTitle: string;
    brothers: number;
    sisters: number;
}

const LEVEL_LABELS: Record<string, string> = {
    "100": "100 Level",
    "200": "200 Level",
    "300": "300 Level",
    "400": "400 Level",
    "500": "500 Level",
};

function AnimatedNumber({ value }: { value: number }) {
    const [display, setDisplay] = useState(0);
    const prevRef = useRef(0);
    useEffect(() => {
        const start = prevRef.current;
        const diff = value - start;
        if (diff === 0) return;
        const duration = 900;
        const startTime = Date.now();
        const step = () => {
            const p = Math.min((Date.now() - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(start + diff * eased));
            if (p < 1) requestAnimationFrame(step);
            else prevRef.current = value;
        };
        requestAnimationFrame(step);
    }, [value]);
    return <>{display}</>;
}

export default function StatsPage() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    async function fetchStats() {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (res.ok) {
            setStats(await res.json());
            setLastUpdated(new Date());
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchStats();
        intervalRef.current = setInterval(fetchStats, 15_000);
        const supabase = createBrowserClient();
        const channel = supabase
            .channel(STATS_CHANNEL)
            .on("broadcast", { event: STATS_EVENTS.UPDATE }, fetchStats)
            .subscribe();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            supabase.removeChannel(channel);
        };
    }, []);

    const sortedLevels = stats
        ? [...stats.levels].sort((a, b) => b.count - a.count)
        : [];
    const leadingLevel = sortedLevels[0];
    const total = stats?.total ?? 0;
    const brothers = stats?.brothers ?? 0;
    const sisters = stats?.sisters ?? 0;
    const brotherPct = total ? Math.round((brothers / total) * 100) : 50;
    const sisterPct = total ? Math.round((sisters / total) * 100) : 50;

    return (
        <div className="relative flex min-h-[100dvh] flex-col px-6 py-8 sm:px-10">
            {/* ── Header ───────────────────────────────────────────────── */}
            <header className="mb-7 flex flex-col items-center gap-4 text-center">
                <CfmLogo
                    width={220}
                    height={110}
                    priority
                    className="w-[clamp(100px,10vw,380px)]"
                />
                <div className="flex items-center gap-3">
                    <Chip variant="error" size="lg">
                        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-on-error-container" />
                        Live
                    </Chip>
                    <Chip variant="neutral" size="lg">
                        Registration scoreboard
                    </Chip>
                </div>
            </header>

            {isLoading ? (
                <div className="grid flex-1 gap-4 lg:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-40 animate-pulse rounded-xl bg-surface-container-low"
                            style={{ animationDelay: `${i * 0.1}s` }}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid flex-1 gap-4 lg:grid-cols-2">
                    {/* ── Level leaderboard ────────────────────────────── */}
                    <section className="rounded-xl bg-surface-container-low p-6 shadow-e-1 lg:row-span-2">
                        <h2 className="mb-5 flex items-center gap-2.5 text-[clamp(1.1rem,1.7vw,1.6rem)] font-bold text-on-surface">
                            <Trophy className="size-[1.1em] text-tertiary" />
                            Level leaderboard
                        </h2>

                        <div className="space-y-2.5">
                            {sortedLevels.map(({ level, count }, i) => {
                                const pct = total
                                    ? Math.round((count / total) * 100)
                                    : 0;
                                const leader = i === 0;
                                return (
                                    <div
                                        key={level}
                                        className={`flex items-center gap-4 rounded-md p-4 animate-in fade-in slide-in-from-left-2 ${
                                            leader
                                                ? "bg-tertiary-container"
                                                : "bg-surface-container-highest"
                                        }`}
                                        style={{ animationDelay: `${i * 0.08}s` }}
                                    >
                                        <div
                                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base font-extrabold ${
                                                leader
                                                    ? "bg-on-tertiary-container text-tertiary-container"
                                                    : "bg-surface-container text-on-surface-variant"
                                            }`}
                                        >
                                            {i + 1}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div
                                                className={`flex items-center gap-1.5 text-[clamp(0.95rem,1.3vw,1.25rem)] font-bold ${
                                                    leader
                                                        ? "text-on-tertiary-container"
                                                        : "text-on-surface"
                                                }`}
                                            >
                                                {LEVEL_LABELS[level] ?? level}
                                                {leader && (
                                                    <Crown className="size-[1em]" />
                                                )}
                                            </div>
                                            <Progress
                                                value={pct}
                                                className="mt-2"
                                                indicatorClassName={
                                                    leader
                                                        ? "bg-on-tertiary-container"
                                                        : "bg-primary"
                                                }
                                            />
                                        </div>

                                        <div className="text-right">
                                            <div
                                                className={`font-display text-[clamp(1.1rem,1.7vw,1.7rem)] font-extrabold leading-none ${
                                                    leader
                                                        ? "text-on-tertiary-container"
                                                        : "text-on-surface"
                                                }`}
                                            >
                                                <AnimatedNumber value={count} />
                                            </div>
                                            <div
                                                className={`text-xs ${
                                                    leader
                                                        ? "text-on-tertiary-container/80"
                                                        : "text-on-surface-variant"
                                                }`}
                                            >
                                                {pct}%
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ── Total registered ─────────────────────────────── */}
                    <section className="flex flex-col items-center justify-center rounded-xl bg-primary-container p-8 text-center shadow-e-1">
                        <div className="font-display text-[clamp(3.5rem,9vw,7rem)] font-extrabold leading-none text-on-primary-container">
                            <AnimatedNumber value={total} />
                        </div>
                        <div className="mt-2 text-[clamp(1rem,1.6vw,1.5rem)] font-semibold text-on-primary-container">
                            Members registered
                        </div>
                        {leadingLevel && leadingLevel.count > 0 && (
                            <div className="mt-4 flex items-center gap-2 rounded-full bg-on-primary-container/15 px-4 py-2 text-[clamp(0.8rem,1.2vw,1.05rem)] text-on-primary-container">
                                <Flame className="size-[1.1em]" />
                                <span>
                                    {LEVEL_LABELS[leadingLevel.level]} leads with{" "}
                                    {leadingLevel.count}
                                </span>
                            </div>
                        )}
                    </section>

                    {/* ── Gender split ─────────────────────────────────── */}
                    <section className="rounded-xl bg-surface-container-low p-6 shadow-e-1">
                        <h2 className="mb-5 text-[clamp(1.1rem,1.7vw,1.6rem)] font-bold text-on-surface">
                            Brothers &amp; sisters
                        </h2>

                        <div className="flex items-center gap-5">
                            <div className="text-center">
                                <div className="font-display text-[clamp(1.4rem,2.4vw,2.2rem)] font-extrabold leading-none text-secondary">
                                    <AnimatedNumber value={brothers} />
                                </div>
                                <div className="mt-1 text-xs text-on-surface-variant">
                                    Brothers · {brotherPct}%
                                </div>
                            </div>

                            <div className="flex h-4 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
                                <div
                                    className="h-full bg-secondary transition-[width] duration-700 ease-standard"
                                    style={{ width: `${brotherPct}%` }}
                                />
                                <div
                                    className="h-full bg-primary transition-[width] duration-700 ease-standard"
                                    style={{ width: `${sisterPct}%` }}
                                />
                            </div>

                            <div className="text-center">
                                <div className="font-display text-[clamp(1.4rem,2.4vw,2.2rem)] font-extrabold leading-none text-primary">
                                    <AnimatedNumber value={sisters} />
                                </div>
                                <div className="mt-1 text-xs text-on-surface-variant">
                                    Sisters · {sisterPct}%
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {lastUpdated && (
                <p className="mt-6 text-center text-xs tracking-[0.03em] text-on-surface-variant">
                    Updated{" "}
                    {lastUpdated.toLocaleTimeString("en-NG", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                    })}
                </p>
            )}
        </div>
    );
}
