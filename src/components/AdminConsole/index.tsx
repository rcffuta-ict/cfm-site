"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Dices, Eye, RotateCcw, Tv, BarChart3, SlidersHorizontal } from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { IctLogo } from "@/src/components/common/IctLogo";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Switch } from "@/src/components/ui/switch";
import { Avatar } from "@/src/components/ui/avatar";
import type { OraclePerson } from "@/src/lib/oracle/channel";
import { cn, MANAGEABLE_LEVELS } from "@/src/lib/utils";
import {
    getAdminOverviewAction,
    setLevelDisabledAction,
    type AdminOverview,
} from "@/src/app/admin/actions";

const LEVELS = ["100", "200", "300", "400", "500", "All"];
const GENDERS = [
    { label: "Brothers", value: "male" },
    { label: "Sisters", value: "female" },
    { label: "Both", value: "Both" },
];
const SPIN_TIMES = [1, 3, 5, 10];

/** Mirrors the reveal payload, so what the console previews is what the TV shows. */
type PickedPerson = OraclePerson;

function Pill({
    active,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
    return (
        <button
            className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50",
                active
                    ? "border-transparent bg-brand-gradient text-white shadow-glow-sm"
                    : "border-border bg-white/[0.03] text-muted-foreground hover:text-foreground"
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export default function AdminConsole({
    initialOverview,
}: {
    initialOverview: AdminOverview;
}) {
    const [level, setLevel] = useState("All");
    const [gender, setGender] = useState("Both");
    const [spinTime, setSpinTime] = useState(3);
    const [picked, setPicked] = useState<PickedPerson | null>(null);
    const [history, setHistory] = useState<number[]>([]);
    const [overview, setOverview] = useState<AdminOverview>(initialOverview);
    const [isPending, startTransition] = useTransition();
    const [togglingLevel, setTogglingLevel] = useState<string | null>(null);

    async function refreshOverview() {
        const data = await getAdminOverviewAction();
        if (data) setOverview(data);
    }

    useEffect(() => {
        const id = setInterval(refreshOverview, 20_000);
        return () => clearInterval(id);
    }, []);

    function handleRoll() {
        startTransition(async () => {
            const toastId = toast.loading("Oracle is choosing…");
            try {
                const res = await fetch("/api/oracle/pick", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        level: level === "All" ? null : level,
                        gender: gender === "Both" ? null : gender,
                        spinTime,
                        exclude: history,
                    }),
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    toast.error(json.error || "Failed to pick winner", {
                        id: toastId,
                    });
                    return;
                }
                toast.success(`Oracle picked #${json.data.raffleId}!`, {
                    id: toastId,
                });
                setPicked(json.data);
                setHistory((h) => [json.data.raffleId, ...h].slice(0, 3));
            } catch {
                toast.error("Network error", { id: toastId });
            }
        });
    }

    function handleShowPerson() {
        if (!picked) return;
        fetch("/api/oracle/show", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person: picked }),
        });
        toast.success("Revealing on screen…");
    }

    function handleReset() {
        setPicked(null);
        fetch("/api/oracle/reset", { method: "POST" });
        toast("Oracle reset.", { icon: "🔄" });
    }

    function toggleLevel(lvl: string) {
        const isDisabled = overview.disabledLevels.includes(lvl);
        setTogglingLevel(lvl);
        setOverview((o) => ({
            ...o,
            disabledLevels: isDisabled
                ? o.disabledLevels.filter((l) => l !== lvl)
                : [...o.disabledLevels, lvl],
        }));
        setLevelDisabledAction(lvl, !isDisabled)
            .then((res) => {
                if (!res.success) {
                    toast.error(res.error || "Failed to update level");
                    refreshOverview();
                } else {
                    toast.success(
                        isDisabled
                            ? `${lvl} Level resumed`
                            : `${lvl} Level paused`
                    );
                    if (res.disabledLevels)
                        setOverview((o) => ({
                            ...o,
                            disabledLevels: res.disabledLevels!,
                        }));
                }
            })
            .finally(() => setTogglingLevel(null));
    }

    return (
        <div className="relative min-h-[100dvh] space-y-6 py-8">
            <Ambient />

            {/* Topbar */}
            <Card className="flex items-center justify-between gap-4 p-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">
                        <span className="text-gradient">Oracle</span> Console
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Admin control center
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-black leading-none text-gradient">
                        {overview.totalRegistered}
                    </div>
                    <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                        registered
                    </div>
                </div>
            </Card>

            <div className="grid gap-5 md:grid-cols-2">
                {/* Draw controls */}
                <Card className="p-6">
                    <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
                        <Dices className="size-5 text-primary" /> Draw Controls
                    </h2>

                    <div className="space-y-5">
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Level
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {LEVELS.map((l) => (
                                    <Pill
                                        key={l}
                                        active={level === l}
                                        onClick={() => setLevel(l)}
                                        disabled={isPending}
                                    >
                                        {l}
                                    </Pill>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Gender
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {GENDERS.map((g) => (
                                    <Pill
                                        key={g.value}
                                        active={gender === g.value}
                                        onClick={() => setGender(g.value)}
                                        disabled={isPending}
                                    >
                                        {g.label}
                                    </Pill>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Spin Duration
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {SPIN_TIMES.map((t) => (
                                    <Pill
                                        key={t}
                                        active={spinTime === t}
                                        onClick={() => setSpinTime(t)}
                                        disabled={isPending}
                                    >
                                        {t}s
                                    </Pill>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <Button
                            variant="brand"
                            size="lg"
                            className="w-full"
                            onClick={handleRoll}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            ) : (
                                <>
                                    <Dices /> Roll It
                                </>
                            )}
                        </Button>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="glass"
                                onClick={handleShowPerson}
                                disabled={!picked || isPending}
                            >
                                <Eye /> Reveal
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={isPending}
                            >
                                <RotateCcw /> Reset
                            </Button>
                        </div>
                    </div>

                    {picked && (
                        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border bg-white/[0.03] p-4 animate-in zoom-in-95">
                            <Avatar
                                src={picked.avatarUrl}
                                name={`${picked.firstName} ${picked.lastName}`}
                                size="sm"
                                className="h-14 w-14 rounded-2xl text-base"
                            />
                            <div className="min-w-0 text-left">
                                <div className="text-xl font-black text-gradient">
                                    #{picked.raffleId}
                                </div>
                                <div className="truncate font-bold">
                                    {picked.firstName} {picked.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {picked.level} Level
                                    {picked.unit && ` · ${picked.unit}`} ·{" "}
                                    {picked.gender === "male"
                                        ? "Brother"
                                        : "Sister"}
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Level participation */}
                <Card className="p-6">
                    <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
                        <SlidersHorizontal className="size-5 text-accent" /> Level
                        Participation
                    </h2>
                    <p className="mb-5 text-sm text-muted-foreground">
                        Paused levels can&apos;t log in or register — but their
                        members can still watch the live stats.
                    </p>

                    <div className="space-y-2.5">
                        {MANAGEABLE_LEVELS.map((lvl) => {
                            const disabled =
                                overview.disabledLevels.includes(lvl);
                            const busy = togglingLevel === lvl;
                            return (
                                <div
                                    key={lvl}
                                    className={cn(
                                        "flex items-center justify-between rounded-2xl border p-4 transition-colors",
                                        disabled
                                            ? "border-destructive/40 bg-destructive/[0.06]"
                                            : "border-border bg-white/[0.02]"
                                    )}
                                >
                                    <div>
                                        <p className="font-bold">{lvl} Level</p>
                                        <Badge
                                            variant={
                                                disabled
                                                    ? "destructive"
                                                    : "mint"
                                            }
                                            className="mt-1"
                                        >
                                            {busy
                                                ? "…"
                                                : disabled
                                                  ? "Paused"
                                                  : "Active"}
                                        </Badge>
                                    </div>
                                    <Switch
                                        checked={!disabled}
                                        onCheckedChange={() => toggleLevel(lvl)}
                                        disabled={busy}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <Button asChild variant="glass">
                            <a href="/oracle" target="_blank">
                                <Tv /> Oracle Screen
                            </a>
                        </Button>
                        <Button asChild variant="glass">
                            <a href="/stats" target="_blank">
                                <BarChart3 /> Live Stats
                            </a>
                        </Button>
                    </div>
                </Card>
            </div>

            <div className="flex justify-center opacity-50">
                <IctLogo variant="white" width={70} />
            </div>
        </div>
    );
}
