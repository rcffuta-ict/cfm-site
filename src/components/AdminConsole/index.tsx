"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import {
    Dices,
    Eye,
    RotateCcw,
    Tv,
    BarChart3,
    SlidersHorizontal,
    Check,
    Users,
} from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { CfmIcon } from "@/src/components/common/Brand";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { Switch } from "@/src/components/ui/switch";
import { Avatar } from "@/src/components/ui/avatar";
import { Progress } from "@/src/components/ui/progress";
import { cn, MANAGEABLE_LEVELS } from "@/src/lib/utils";
import type { OraclePerson } from "@/src/lib/oracle/channel";
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

/**
 * Material 3 filter chip: an outlined container that fills with the secondary
 * container colour and grows a leading checkmark when selected.
 */
function FilterChip({
    selected,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            className={cn(
                "state-layer inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[0.8125rem] font-medium",
                "transition-colors duration-200 ease-standard",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                "disabled:pointer-events-none disabled:opacity-40",
                selected
                    ? "bg-secondary-container text-on-secondary-container"
                    : "border border-outline text-on-surface-variant"
            )}
            {...props}
        >
            {selected && <Check className="size-4 shrink-0" />}
            {children}
        </button>
    );
}

function FieldGroup({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                {label}
            </p>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
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
                toast.success(`Oracle picked #${json.data.raffleId}`, {
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
        toast("Oracle reset");
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
        <div className="relative min-h-[100dvh] space-y-4 py-6">
            <Ambient />

            {/* ── Header ───────────────────────────────────────────────── */}
            <header className="flex items-center justify-between gap-4 rounded-xl bg-surface-container-low p-5 shadow-e-1">
                <div className="flex min-w-0 items-center gap-3.5">
                    <CfmIcon width={36} height={36} priority />
                    <div className="min-w-0">
                        <h1 className="truncate font-display text-xl font-extrabold tracking-tight text-on-surface">
                            Oracle console
                        </h1>
                        <p className="text-xs text-on-surface-variant">
                            Admin control centre
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5 rounded-md bg-secondary-container px-4 py-2 text-on-secondary-container">
                    <Users className="size-4" />
                    <div>
                        <div className="font-display text-xl font-extrabold leading-none">
                            {overview.totalRegistered}
                        </div>
                        <div className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] opacity-80">
                            registered
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                {/* ── Draw controls ────────────────────────────────────── */}
                <Card variant="elevated" className="overflow-hidden">
                    <div className="h-1">
                        {isPending && (
                            <Progress thickness={4} className="rounded-none" />
                        )}
                    </div>
                    <div className="p-5">
                        <h2 className="mb-5 flex items-center gap-2 text-base font-bold text-on-surface">
                            <Dices className="size-5 text-primary" /> Draw
                            controls
                        </h2>

                        <div className="space-y-5">
                            <FieldGroup label="Level">
                                {LEVELS.map((l) => (
                                    <FilterChip
                                        key={l}
                                        selected={level === l}
                                        onClick={() => setLevel(l)}
                                        disabled={isPending}
                                    >
                                        {l}
                                    </FilterChip>
                                ))}
                            </FieldGroup>

                            <FieldGroup label="Gender">
                                {GENDERS.map((g) => (
                                    <FilterChip
                                        key={g.value}
                                        selected={gender === g.value}
                                        onClick={() => setGender(g.value)}
                                        disabled={isPending}
                                    >
                                        {g.label}
                                    </FilterChip>
                                ))}
                            </FieldGroup>

                            <FieldGroup label="Spin duration">
                                {SPIN_TIMES.map((t) => (
                                    <FilterChip
                                        key={t}
                                        selected={spinTime === t}
                                        onClick={() => setSpinTime(t)}
                                        disabled={isPending}
                                    >
                                        {t}s
                                    </FilterChip>
                                ))}
                            </FieldGroup>
                        </div>

                        <div className="mt-6 space-y-3">
                            {/* The bolt-yellow is reserved for this one action. */}
                            <Button
                                variant="tertiary"
                                size="xl"
                                className="w-full"
                                onClick={handleRoll}
                                disabled={isPending}
                            >
                                <Dices />
                                {isPending ? "Choosing…" : "Roll the Oracle"}
                            </Button>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="tonal"
                                    onClick={handleShowPerson}
                                    disabled={!picked || isPending}
                                >
                                    <Eye /> Reveal
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={handleReset}
                                    disabled={isPending}
                                >
                                    <RotateCcw /> Reset
                                </Button>
                            </div>
                        </div>

                        {picked && (
                            <div className="mt-5 flex items-center gap-4 rounded-md bg-surface-container-highest p-4 animate-in fade-in zoom-in-95 duration-200">
                                <Avatar
                                    src={picked.avatarUrl}
                                    name={`${picked.firstName} ${picked.lastName}`}
                                    size="sm"
                                />
                                <div className="min-w-0">
                                    <div className="font-display text-lg font-extrabold leading-tight text-primary">
                                        #{picked.raffleId}
                                    </div>
                                    <div className="truncate text-sm font-semibold text-on-surface">
                                        {picked.firstName} {picked.lastName}
                                    </div>
                                    <div className="truncate text-xs text-on-surface-variant">
                                        {picked.level}
                                        {picked.unit && ` · ${picked.unit}`} ·{" "}
                                        {picked.gender === "male"
                                            ? "Brother"
                                            : "Sister"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* ── Level participation ──────────────────────────────── */}
                <Card variant="elevated" className="p-5">
                    <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                        <SlidersHorizontal className="size-5 text-secondary" />
                        Level participation
                    </h2>
                    <p className="mb-5 mt-1 text-sm leading-6 text-on-surface-variant">
                        Paused levels can&apos;t log in or register — but their
                        members can still watch the live stats.
                    </p>

                    <div className="space-y-2">
                        {MANAGEABLE_LEVELS.map((lvl) => {
                            const disabled =
                                overview.disabledLevels.includes(lvl);
                            const busy = togglingLevel === lvl;
                            return (
                                <div
                                    key={lvl}
                                    className={cn(
                                        "flex items-center justify-between gap-4 rounded-md p-4 transition-colors duration-200 ease-standard",
                                        disabled
                                            ? "bg-error-container/40"
                                            : "bg-surface-container-highest"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-on-surface">
                                            {lvl} Level
                                        </span>
                                        <Chip
                                            variant={
                                                disabled ? "error" : "success"
                                            }
                                            size="sm"
                                        >
                                            {busy
                                                ? "…"
                                                : disabled
                                                  ? "Paused"
                                                  : "Active"}
                                        </Chip>
                                    </div>
                                    <Switch
                                        checked={!disabled}
                                        onCheckedChange={() => toggleLevel(lvl)}
                                        disabled={busy}
                                        aria-label={`${lvl} Level participation`}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <Button asChild variant="tonal">
                            <a href="/oracle" target="_blank">
                                <Tv /> Oracle screen
                            </a>
                        </Button>
                        <Button asChild variant="tonal">
                            <a href="/stats" target="_blank">
                                <BarChart3 /> Live stats
                            </a>
                        </Button>
                    </div>
                </Card>
            </div>

            {/* <div className="flex justify-center pt-2">
                <IctLogo asLink width={78} height={28} />
            </div> */}
        </div>
    );
}
