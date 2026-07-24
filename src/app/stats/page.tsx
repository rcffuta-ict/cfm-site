"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy, Crown, Flame } from "lucide-react";
import { createBrowserClient } from "@/src/lib/supabase/client";
import { ORACLE_CHANNEL, ORACLE_EVENTS } from "@/src/lib/oracle/channel";
import { IctLogo } from "@/src/components/common/IctLogo";
import { CfmIcon } from "@/src/components/common/Brand";
import { Ambient } from "@/src/components/common/Ambient";

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
const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

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
            .channel(ORACLE_CHANNEL)
            .on("broadcast", { event: ORACLE_EVENTS.STATS_UPDATE }, fetchStats)
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
        <div className="relative flex min-h-[100dvh] flex-col px-5 py-8 sm:px-10">
            <Ambient />

            {/* Header */}
            <header className="relative mb-8 text-center">
                <div className="absolute right-0 top-0 opacity-70">
                    <IctLogo variant="white" width={80} />
                </div>
                <CfmIcon width={56} height={56} className="mx-auto" priority />
                <h1 className="mt-3 text-[clamp(1.8rem,4vw,3.2rem)] font-black tracking-tight">
                    {stats?.eventTitle || "Combined Family Meeting"}
                </h1>
                <p className="text-muted-foreground">
                    Live Registration Scoreboard
                </p>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-destructive">
                    <span className="size-2 animate-pulse-dot rounded-full bg-destructive" />
                    Live
                </span>
            </header>

            {isLoading ? (
                <div className="grid flex-1 gap-5 lg:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-40 animate-pulse rounded-3xl border border-border bg-card/40"
                            style={{ animationDelay: `${i * 0.1}s` }}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid flex-1 gap-5 lg:grid-cols-2">
                    {/* Leaderboard */}
                    <section className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-xl lg:row-span-2">
                        <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                            <Trophy className="size-5 text-brand-amber" /> Level
                            Leaderboard
                        </h2>
                        <div className="space-y-3">
                            {sortedLevels.map(({ level, count }, i) => {
                                const pct = total
                                    ? Math.round((count / total) * 100)
                                    : 0;
                                const leader = i === 0;
                                return (
                                    <div
                                        key={level}
                                        className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors animate-in fade-in slide-in-from-left-2 ${
                                            leader
                                                ? "border-brand-amber/40 bg-brand-amber/[0.08]"
                                                : "border-border bg-white/[0.02]"
                                        }`}
                                        style={{ animationDelay: `${i * 0.08}s` }}
                                    >
                                        <div className="text-2xl">
                                            {MEDALS[i] ?? "·"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 font-bold">
                                                {LEVEL_LABELS[level] ?? level}
                                                {leader && (
                                                    <Crown className="size-4 text-brand-amber" />
                                                )}
                                            </div>
                                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                                                <div
                                                    className="h-full rounded-full bg-brand-gradient transition-all duration-700"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black">
                                                <AnimatedNumber value={count} />
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {pct}%
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Total */}
                    <section className="flex flex-col items-center justify-center rounded-3xl border border-border bg-brand-gradient bg-[length:200%_200%] p-[1px] animate-gradient-shift">
                        <div className="flex h-full w-full flex-col items-center justify-center rounded-[calc(1.5rem-1px)] bg-background/85 p-8 text-center backdrop-blur-xl">
                            <div className="text-[clamp(3rem,7vw,5rem)] font-black leading-none text-gradient">
                                <AnimatedNumber value={total} />
                            </div>
                            <div className="mt-2 text-lg font-semibold">
                                Members Registered 🎉
                            </div>
                            {leadingLevel && leadingLevel.count > 0 && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                    <Flame className="size-4 text-brand-pink" />
                                    <span>
                                        <strong className="text-foreground">
                                            {LEVEL_LABELS[leadingLevel.level]}
                                        </strong>{" "}
                                        is leading with {leadingLevel.count}!
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Gender */}
                    <section className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-xl">
                        <h2 className="mb-5 text-xl font-bold">
                            Gender Breakdown
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <div className="text-3xl">👨</div>
                                <div className="text-sm text-muted-foreground">
                                    Brothers
                                </div>
                                <div className="text-2xl font-black text-secondary">
                                    <AnimatedNumber value={brothers} />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {brotherPct}%
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex h-4 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-full bg-secondary transition-all duration-700"
                                        style={{ width: `${brotherPct}%` }}
                                    />
                                    <div
                                        className="h-full bg-brand-pink transition-all duration-700"
                                        style={{ width: `${sisterPct}%` }}
                                    />
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl">👩</div>
                                <div className="text-sm text-muted-foreground">
                                    Sisters
                                </div>
                                <div className="text-2xl font-black text-brand-pink">
                                    <AnimatedNumber value={sisters} />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {sisterPct}%
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {lastUpdated && (
                <p className="mt-6 text-center text-xs text-muted-foreground">
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
