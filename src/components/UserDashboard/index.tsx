"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Ticket, Tv, BarChart3, Settings, LogOut, Zap } from "lucide-react";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";

export default function UserDashboard() {
    const router = useRouter();
    const session = useProfileStore((state) => state.session);
    const clearSession = useProfileStore((state) => state.clearSession);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        clearSession();
        router.push("/login");
        router.refresh();
    }

    if (!session) return null;

    const { profile, raffleId, eventTitle, eventDate, isAdmin } = session;
    const firstName = profile.profile.firstName;
    const lastName = profile.profile.lastName;
    const fullName = `${firstName} ${lastName}`;
    const initials =
        `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
    const level = profile.academics?.currentLevel ?? "?";
    const unit = profile.unit?.name ?? profile.teams?.[0]?.name ?? null;
    const raffleStr = raffleId ? String(raffleId) : "——";
    const formattedDate = eventDate
        ? new Date(eventDate).toLocaleDateString("en-NG", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : "";

    return (
        <div
            className={`relative min-h-[100dvh] pb-16 transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        >
            <Ambient />

            {/* Header */}
            <header className="sticky top-0 z-20 flex items-center justify-between py-4">
                <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 backdrop-blur-md">
                    <CfmIcon width={34} height={34} priority />
                    <span className="text-sm font-bold tracking-tight">CFM</span>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <Button
                            asChild
                            variant="glass"
                            size="sm"
                            className="rounded-full"
                        >
                            <a href="/admin">
                                <Settings /> Admin
                            </a>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={handleLogout}
                    >
                        <LogOut /> Sign Out
                    </Button>
                </div>
            </header>

            <main className="space-y-6 pt-2">
                {/* Event banner */}
                <div className="relative overflow-hidden rounded-3xl border border-border bg-brand-gradient bg-[length:200%_200%] p-[1px] animate-gradient-shift">
                    <div className="rounded-[calc(1.5rem-1px)] bg-background/85 px-6 py-5 text-center backdrop-blur-xl">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            You&apos;re registered for
                        </p>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
                            {eventTitle || "Combined Family Meeting"}
                        </h1>
                        {formattedDate && (
                            <p className="mt-1 text-sm text-accent">
                                {formattedDate}
                            </p>
                        )}
                    </div>
                </div>

                {/* Player card */}
                <div className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute -inset-1 rounded-2xl bg-brand-gradient opacity-60 blur" />
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-background text-xl font-extrabold">
                                {initials}
                            </div>
                        </div>
                        <div>
                            <p className="text-lg font-bold">{fullName}</p>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                                <Badge variant="brand">
                                    <Zap className="size-3" /> {level} Level
                                </Badge>
                                {unit && <Badge variant="accent">{unit}</Badge>}
                            </div>
                        </div>
                    </div>
                    <p className="mt-4 rounded-2xl border border-border bg-white/[0.03] p-4 text-sm leading-relaxed text-muted-foreground">
                        🏆 <strong className="text-foreground">You&apos;re in
                        the running!</strong> The Oracle picks from everyone
                        registered — keep your eyes on the screen fr fr.
                    </p>
                </div>

                {/* Oracle ID ticket */}
                <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-6 text-center backdrop-blur-xl">
                    <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-pink/20 blur-2xl" />
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Ticket className="size-4 text-accent" /> Your Oracle ID
                    </div>
                    <div className="mt-4 flex justify-center gap-2">
                        {raffleStr.split("").map((digit, i) => (
                            <span
                                key={i}
                                className="flex h-16 w-12 items-center justify-center rounded-xl border border-border bg-background text-3xl font-black text-gradient animate-in fade-in slide-in-from-bottom-2"
                                style={{ animationDelay: `${i * 0.07}s` }}
                            >
                                {digit}
                            </span>
                        ))}
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                        May the odds be ever in your favour 🙏
                    </p>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-2 gap-4">
                    <a
                        href="/oracle"
                        className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-primary/50"
                    >
                        <Tv className="size-6 text-primary transition-transform group-hover:scale-110" />
                        <div>
                            <p className="font-bold">Oracle Screen</p>
                            <p className="text-xs text-muted-foreground">
                                Watch live picks
                            </p>
                        </div>
                    </a>
                    <a
                        href="/stats"
                        className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-accent/50"
                    >
                        <BarChart3 className="size-6 text-accent transition-transform group-hover:scale-110" />
                        <div>
                            <p className="font-bold">Live Stats</p>
                            <p className="text-xs text-muted-foreground">
                                See the scoreboard
                            </p>
                        </div>
                    </a>
                </div>
            </main>
        </div>
    );
}
