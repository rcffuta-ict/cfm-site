"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    BarChart3,
    Settings,
    LogOut,
    CalendarDays,
    ChevronRight,
    Zap,
    Info,
    Signal,
} from "lucide-react";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";
import { Chip } from "@/src/components/ui/chip";
import { Avatar } from "@/src/components/ui/avatar";
import GamesSection from "@/src/components/GamesSection";
import { displayLevelBetter } from "@/src/lib/utils";

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
    const level = profile.academics?.currentLevel ?? "?";
    const unit = profile.unit?.name ?? profile.teams?.[0]?.name ?? null;
    const raffleStr = raffleId ? String(raffleId) : "—————";
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
            className={`relative min-h-[100dvh] pb-14 transition-opacity duration-500 ease-standard ${
                visible ? "opacity-100" : "opacity-0"
            }`}
        >
            <Ambient />

            {/* ── Material top app bar ──────────────────────────────────── */}
            <header className="sticky top-0 z-20 -mx-4 mb-2 flex h-16 items-center justify-between gap-3 bg-surface px-4 sm:-mx-6 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <CfmIcon width={30} height={30} priority />
                    <span className="truncate font-display text-lg font-bold tracking-tight text-on-surface">
                        Combined Family Meeting
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {isAdmin && (
                        <Button
                            asChild
                            variant="text"
                            size="icon"
                            aria-label="Admin console"
                        >
                            <a href="/admin">
                                <Settings />
                            </a>
                        </Button>
                    )}
                    <Button
                        variant="text"
                        size="icon"
                        onClick={handleLogout}
                        aria-label="Sign out"
                    >
                        <LogOut />
                    </Button>
                </div>
            </header>

            <main className="space-y-4">
                {/* ── Who you are ──────────────────────────────────────── */}
                <section className="rounded-xl bg-surface-container-low p-5 shadow-e-1">
                    <div className="flex items-center gap-4">
                        <Avatar
                            src={profile.profile.avatarUrl}
                            name={fullName}
                            size="md"
                        />
                        <div className="min-w-0">
                            <p className="truncate text-base font-bold text-on-surface">
                                {fullName}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                <Chip variant="secondary" size="sm">
                                    {displayLevelBetter(level)}
                                </Chip>
                                {unit && (
                                    <Chip variant="tertiary" size="sm">
                                        {unit}
                                    </Chip>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── The event ────────────────────────────────────────── */}
                <section className="rounded-xl border border-outline-variant p-5">
                    <div className="flex items-start gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tertiary-container text-on-tertiary-container">
                            <CalendarDays className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                                You&apos;re registered for
                            </p>
                            <p className="mt-1 font-display text-lg font-bold leading-6 text-on-surface">
                                {eventTitle || "Combined Family Meeting"}
                            </p>
                            {formattedDate && (
                                <p className="mt-0.5 text-sm text-on-surface-variant">
                                    {formattedDate}
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── Oracle ID: the reason members open this app ───────── */}
                <section className="overflow-hidden rounded-xl bg-primary-container shadow-e-1">
                    <div className="px-6 pt-6 text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-primary-container/80">
                            Your Oracle ID
                        </p>
                    </div>

                    <div className="flex justify-center gap-1.5 px-4 py-5 sm:gap-2.5">
                        {raffleStr.split("").map((digit, i) => (
                            <span
                                key={i}
                                className="flex h-16 w-11 items-center justify-center rounded-md bg-surface-container-lowest font-display text-3xl font-extrabold text-on-surface sm:h-20 sm:w-14 sm:text-4xl"
                            >
                                {digit}
                            </span>
                        ))}
                    </div>

                    <p className="px-6 pb-6 text-center text-sm leading-6 text-on-primary-container/90">
                        The Oracle draws from everyone registered. Keep an eye
                        on the big screen.
                    </p>
                </section>

                {/* ── Games: the evening's line-up ─────────────────────────
                    A bill of what's on, not the games themselves. Playing
                    happens on /play, which switches itself to whatever the host
                    has running. */}
                <GamesSection />

                {/* ── Where to look next ───────────────────────────────── */}
                <nav className="overflow-hidden rounded-xl bg-surface-container-low shadow-e-1">
                    <DashboardLink
                        href="/oracle"
                        icon={<Zap className="size-5" />}
                        title="Oracle screen"
                        subtitle="Watch the live draw"
                    />
                    <div className="mx-5 h-px bg-outline-variant" />
                    <DashboardLink
                        href="/stats"
                        icon={<BarChart3 className="size-5" />}
                        title="Live stats"
                        subtitle="Registration scoreboard"
                    />
                    <div className="mx-5 h-px bg-outline-variant" />
                    <DashboardLink
                        href="/network"
                        icon={<Signal className="size-5" />}
                        title="Check your connection"
                        subtitle="See if your signal is good enough to compete"
                    />
                    <div className="mx-5 h-px bg-outline-variant" />
                    <DashboardLink
                        href="/about"
                        icon={<Info className="size-5" />}
                        title="About this event"
                        subtitle="Details and how the games work"
                    />
                </nav>
            </main>
        </div>
    );
}

/** Material list item with a leading tonal icon and a trailing chevron. */
function DashboardLink({
    href,
    icon,
    title,
    subtitle,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}) {
    return (
        <a
            href={href}
            className="state-layer flex items-center gap-4 px-5 py-4 text-on-surface"
        >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-on-surface-variant">
                    {subtitle}
                </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-on-surface-variant" />
        </a>
    );
}
