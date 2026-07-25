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
    RefreshCw,
    Hourglass,
    Minus,
    Plus,
    AlertTriangle,
    LayoutDashboard,
    Gamepad2,
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

/**
 * A roll must land on the TV within five seconds, every time. Locally that's a
 * few milliseconds — but if something is wrong we want the admin to *know*
 * rather than stare at a spinner, so the request is aborted well short of the
 * budget and surfaced as a retryable error.
 */
const ROLL_TIMEOUT_MS = 4000;

/** Nudge the admin to re-sync once the snapshot is older than this. */
const STALE_AFTER_MS = 10 * 60 * 1000;

const MAX_SLOTS = 10;

const LEVELS = ["100", "200", "300", "400", "500", "All"];
const GENDERS = [
    { label: "Brothers", value: "male" },
    { label: "Sisters", value: "female" },
    { label: "Both", value: "Both" },
];
const SPIN_TIMES = [1, 3, 5, 10];

/** Mirrors the reveal payload, so what the console previews is what the TV shows. */
type PickedPerson = OraclePerson;

interface OracleMembersState {
    count: number;
    /** Epoch ms of the last member sync; 0 when never synced. */
    syncedAt: number;
}

interface WaitingState {
    slots: number;
    /** Recently drawn raffle ids, most recent first. */
    queue: number[];
}

interface RelaxedState {
    honoured: number;
    requested: number;
}

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

/** "just now" / "4 min ago" — enough precision for a snapshot age. */
function timeAgo(epochMs: number): string {
    if (!epochMs) return "never";
    const mins = Math.floor((Date.now() - epochMs) / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`;
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
    const [overview, setOverview] = useState<AdminOverview>(initialOverview);
    const [isPending, startTransition] = useTransition();
    const [togglingLevel, setTogglingLevel] = useState<string | null>(null);

    // Local Oracle state — snapshot freshness and the waiting room. Served from
    // the laptop's memory, so this stays responsive with no uplink.
    const [members, setMembers] = useState<OracleMembersState>({
        count: 0,
        syncedAt: 0,
    });
    const [waiting, setWaiting] = useState<WaitingState>({ slots: 3, queue: [] });
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastRollMs, setLastRollMs] = useState<number | null>(null);
    const [relaxed, setRelaxed] = useState<RelaxedState | null>(null);

    const isStale =
        members.syncedAt > 0 && Date.now() - members.syncedAt > STALE_AFTER_MS;
    const hasMembers = members.count > 0;

    async function refreshOverview() {
        const data = await getAdminOverviewAction();
        if (data) setOverview(data);
    }

    async function refreshOracleState() {
        try {
            const res = await fetch("/api/oracle/state", { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            setMembers(json.members);
            setWaiting(json.waiting);
        } catch {
            // Local call — a failure here means the server is down, which the
            // roll button will surface far more usefully than a toast would.
        }
    }

    useEffect(() => {
        refreshOracleState();
        const id = setInterval(refreshOverview, 20_000);
        // Re-render so the "synced N min ago" label ages without a fetch.
        const tick = setInterval(() => setMembers((m) => ({ ...m })), 30_000);
        return () => {
            clearInterval(id);
            clearInterval(tick);
        };
    }, []);

    function handleRefreshMembers() {
        setIsSyncing(true);
        const toastId = toast.loading("Syncing members…");
        fetch("/api/oracle/members/refresh", { method: "POST" })
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok || !json.success) {
                    toast.error(json.error || "Sync failed", { id: toastId });
                    return;
                }
                setMembers({ count: json.count, syncedAt: json.syncedAt });
                toast.success(`${json.count} members loaded`, { id: toastId });
            })
            .catch(() => toast.error("Couldn't reach Supabase", { id: toastId }))
            .finally(() => setIsSyncing(false));
    }

    function updateWaiting(body: Record<string, unknown>, message: string) {
        fetch("/api/oracle/waiting", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok || !json.success) {
                    toast.error(json.error || "Failed to update");
                    return;
                }
                setWaiting(json.waiting);
                toast.success(message);
            })
            .catch(() => toast.error("Failed to update"));
    }

    function handleRoll() {
        startTransition(async () => {
            const toastId = toast.loading("Oracle is choosing…");

            // Never let a roll hang. If the local server doesn't answer inside
            // the budget, fail loudly so the admin can retry rather than
            // wondering whether the TV is about to catch up.
            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), ROLL_TIMEOUT_MS);
            const startedAt = performance.now();

            try {
                const res = await fetch("/api/oracle/pick", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        level: level === "All" ? null : level,
                        gender: gender === "Both" ? null : gender,
                        spinTime,
                    }),
                    signal: abort.signal,
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    toast.error(json.error || "Failed to pick winner", {
                        id: toastId,
                    });
                    return;
                }

                setLastRollMs(Math.round(performance.now() - startedAt));
                toast.success(`Oracle picked #${json.data.raffleId}`, {
                    id: toastId,
                });
                setPicked(json.data);
                setWaiting(json.waiting);
                setRelaxed(json.cooldownRelaxed);
                if (json.cooldownRelaxed) {
                    toast(
                        `Pool too small — cooldown relaxed to ${json.cooldownRelaxed.honoured}`,
                        { icon: "⚠️" }
                    );
                }
            } catch (err) {
                const timedOut = (err as Error)?.name === "AbortError";
                toast.error(
                    timedOut
                        ? "Oracle didn't respond — check the laptop, then retry"
                        : "Couldn't reach the Oracle — tap Roll to retry",
                    { id: toastId }
                );
            } finally {
                clearTimeout(timer);
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
            <header className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl bg-surface-container-low p-5 shadow-e-1">
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
                <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-2.5 rounded-md bg-secondary-container px-4 py-2 text-on-secondary-container">
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
                    <Button asChild variant="text">
                        <a href="/">
                            <LayoutDashboard /> Dashboard
                        </a>
                    </Button>
                </div>
            </header>

            {/* ── Member snapshot ──────────────────────────────────────────
                The Oracle draws from this local copy, never from Supabase, so
                the draw can't be slowed or stalled by the venue's uplink. The
                trade is that it goes stale as people register at the door —
                hence the age, shown plainly and flagged once it matters. */}
            <Card variant="elevated" className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <Users className="size-5 shrink-0 text-primary" />
                        <div>
                            <h2 className="text-base font-bold text-on-surface">
                                {members.count} member
                                {members.count === 1 ? "" : "s"} loaded
                            </h2>
                            <p
                                className={cn(
                                    "text-xs",
                                    isStale
                                        ? "font-semibold text-error"
                                        : "text-on-surface-variant"
                                )}
                            >
                                {members.syncedAt
                                    ? `Synced ${timeAgo(members.syncedAt)}`
                                    : "Not synced yet — sync before the draws"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {isStale && (
                            <Chip variant="error" size="sm">
                                <AlertTriangle /> Stale
                            </Chip>
                        )}
                        {lastRollMs !== null && (
                            <Chip variant="success" size="sm">
                                Last roll {lastRollMs}ms
                            </Chip>
                        )}
                        <Button
                            variant="tonal"
                            onClick={handleRefreshMembers}
                            disabled={isSyncing || isPending}
                        >
                            <RefreshCw
                                className={cn(isSyncing && "animate-spin")}
                            />
                            {isSyncing ? "Syncing…" : "Refresh members"}
                        </Button>
                    </div>
                </div>
            </Card>

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
                                disabled={isPending || !hasMembers}
                            >
                                <Dices />
                                {isPending
                                    ? "Choosing…"
                                    : hasMembers
                                      ? "Roll the Oracle"
                                      : "Sync members first"}
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

                {/* ── Waiting room ─────────────────────────────────────────
                    A drawn id sits out the next N draws, so the same person
                    can't keep surfacing. Kept on the server rather than in this
                    tab, so refreshing the console — or picking up a second
                    phone — doesn't silently reset it. */}
                <Card variant="elevated" className="p-5">
                    <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                        <Hourglass className="size-5 text-tertiary" />
                        Waiting room
                    </h2>
                    <p className="mb-5 mt-1 text-sm leading-6 text-on-surface-variant">
                        Recently drawn numbers sit out the next{" "}
                        <strong>{waiting.slots}</strong>{" "}
                        {waiting.slots === 1 ? "draw" : "draws"}.
                        {waiting.slots === 0 && " Cooldown is off — repeats allowed."}
                    </p>

                    <div className="mb-5 flex items-center justify-between gap-4 rounded-md bg-surface-container-highest p-4">
                        <span className="text-sm font-semibold text-on-surface">
                            Cooldown slots
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outlined"
                                size="icon"
                                aria-label="Fewer slots"
                                disabled={waiting.slots <= 0}
                                onClick={() =>
                                    updateWaiting(
                                        { action: "slots", slots: waiting.slots - 1 },
                                        `Cooldown set to ${waiting.slots - 1}`
                                    )
                                }
                            >
                                <Minus />
                            </Button>
                            <span className="w-8 text-center font-display text-xl font-extrabold text-on-surface">
                                {waiting.slots}
                            </span>
                            <Button
                                variant="outlined"
                                size="icon"
                                aria-label="More slots"
                                disabled={waiting.slots >= MAX_SLOTS}
                                onClick={() =>
                                    updateWaiting(
                                        { action: "slots", slots: waiting.slots + 1 },
                                        `Cooldown set to ${waiting.slots + 1}`
                                    )
                                }
                            >
                                <Plus />
                            </Button>
                        </div>
                    </div>

                    {relaxed && (
                        <div className="mb-5 flex items-start gap-3 rounded-md bg-error-container/40 p-4 text-sm text-on-surface">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error" />
                            <span>
                                That filter has too few people to honour{" "}
                                {relaxed.requested} slots — the last draw only
                                held back {relaxed.honoured}.
                            </span>
                        </div>
                    )}

                    <div className="min-h-[3.5rem]">
                        {waiting.queue.length === 0 ? (
                            <p className="text-sm text-on-surface-variant">
                                Nobody is cooling down yet.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {waiting.queue.map((id, index) => (
                                    <Chip
                                        key={id}
                                        variant={
                                            index < waiting.slots
                                                ? "tertiary"
                                                : "outlined"
                                        }
                                        size="sm"
                                    >
                                        #{id}
                                    </Chip>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button
                        variant="outlined"
                        className="mt-5 w-full"
                        disabled={waiting.queue.length === 0}
                        onClick={() =>
                            updateWaiting({ action: "clear" }, "Waiting room cleared")
                        }
                    >
                        <RotateCcw /> Clear waiting room
                    </Button>
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
                        <Button asChild variant="outlined" className="col-span-2">
                            <a href="/admin/games">
                                <Gamepad2 /> Game host
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
