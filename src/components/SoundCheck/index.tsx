"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Volume2,
    VolumeX,
    ArrowLeft,
    Play,
    RotateCcw,
    Tv,
    Smartphone,
    Zap,
    CircleCheck,
    CircleAlert,
} from "lucide-react";
import { Ambient } from "@/src/components/common/Ambient";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { cn } from "@/src/lib/utils";
import {
    preloadSounds,
    playCue,
    cueSources,
    type Cue,
    type CueSource,
} from "@/src/lib/audio/sound";
import { useSound } from "@/src/hooks/useSound";

/** Grouped by where each cue is heard, because that's how levels get set. */
const GROUPS: {
    title: string;
    icon: React.ReactNode;
    blurb: string;
    cues: { cue: Cue; label: string; when: string }[];
}[] = [
    {
        title: "On the TV",
        icon: <Tv className="size-5 text-primary" />,
        blurb: "These go through the church PA. Set your desk level against these.",
        cues: [
            { cue: "roundStart", label: "Question appears", when: "Host presses Start" },
            { cue: "tick", label: "Countdown", when: "Last 10 seconds" },
            { cue: "tickUrgent", label: "Countdown, urgent", when: "Last 5 seconds" },
            { cue: "lock", label: "Answers close", when: "Time's up, or host locks" },
            { cue: "reveal", label: "Correct answer", when: "Host presses Reveal" },
            { cue: "call", label: "Bingo call", when: "Each item called" },
            { cue: "bingoWin", label: "Bingo!", when: "Someone completes a line" },
            { cue: "buzzerOpen", label: "Buzzers open", when: "Host opens the buzzer" },
            { cue: "buzzed", label: "Buzz", when: "First finger in" },
            { cue: "winner", label: "Fanfare", when: "Final standings" },
        ],
    },
    {
        title: "On the Oracle screen",
        icon: <Zap className="size-5 text-tertiary" />,
        blurb: "The draw. Also through the PA — its own screen, its own sound switch.",
        cues: [
            { cue: "spin", label: "Reels turning", when: "Loops during the spin" },
            { cue: "spinLand", label: "Reels land", when: "The number settles" },
            { cue: "oracleReveal", label: "Winner revealed", when: "The name appears" },
        ],
    },
    {
        title: "On phones",
        icon: <Smartphone className="size-5 text-secondary" />,
        blurb: "Deliberately small and dry — 500 phones shouldn't fight the PA.",
        cues: [
            { cue: "tap", label: "Tap", when: "Any answer or square" },
            { cue: "lockedIn", label: "Answer locked in", when: "Submission accepted" },
            { cue: "join", label: "Joined the game", when: "Oracle ID accepted" },
            { cue: "loginSuccess", label: "Signed in", when: "Login succeeded" },
            { cue: "loginError", label: "Sign-in failed", when: "Login rejected" },
        ],
    },
];

function sourceLabel(s: CueSource): { text: string; ok: boolean } {
    if (s.source === "file") return { text: `.${s.ext}`, ok: true };
    if (s.source === "borrowed") return { text: `borrows ${s.from}`, ok: true };
    return { text: "fallback tone", ok: false };
}

/**
 * Somewhere to prove the sound works and set levels before the hall fills up.
 *
 * Silence has three different causes — the browser blocking audio, a missing
 * file, or the volume simply being down — and from the back of a room they look
 * identical. This separates them, and lets whoever is on the desk hear each cue
 * on demand instead of waiting for it to happen naturally.
 */
export default function SoundCheck() {
    // Same permission model as everywhere else — this page grants it, it never
    // works around it.
    const sound = useSound(1);
    const [sources, setSources] = useState<Record<Cue, CueSource> | null>(null);
    const [busy, setBusy] = useState(false);
    const [playing, setPlaying] = useState<Cue | null>(null);

    const load = useCallback(async () => {
        setBusy(true);
        await sound.grant();
        await preloadSounds();
        setSources(cueSources());
        setBusy(false);
    }, [sound]);

    useEffect(() => {
        if (!sound.enabled) return;
        preloadSounds().then(() => setSources(cueSources()));
    }, [sound.enabled]);

    function preview(cue: Cue) {
        setPlaying(cue);
        playCue(cue, 1);
        setTimeout(() => setPlaying((c) => (c === cue ? null : c)), 700);
    }

    /** Walk every TV cue in order, so the desk can ride the fader once. */
    async function playAll() {
        setBusy(true);
        for (const group of GROUPS) {
            for (const { cue } of group.cues) {
                preview(cue);
                await new Promise((r) => setTimeout(r, 900));
            }
        }
        setBusy(false);
    }

    const all = sources ? Object.values(sources) : [];
    const withFile = all.filter((s) => s.source === "file").length;
    const borrowed = all.filter((s) => s.source === "borrowed").length;
    const synth = all.filter((s) => s.source === "synth").length;

    return (
        <div className="relative min-h-[100dvh] py-6">
            <Ambient />

            <header className="mb-5 flex items-center justify-between gap-3">
                <h1 className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight text-on-surface">
                    <Volume2 className="size-5 text-primary" /> Sound check
                </h1>
                <Button asChild variant="text" size="sm">
                    <a href="/">
                        <ArrowLeft /> Dashboard
                    </a>
                </Button>
            </header>

            <main className="space-y-4">
                {/* ── The gate ─────────────────────────────────────────── */}
                {!sound.enabled ? (
                    <Card variant="elevated" className="p-8 text-center">
                        <VolumeX className="mx-auto mb-3 size-8 text-on-surface-variant" />
                        <p className="text-base font-bold text-on-surface">
                            Sound is switched off
                        </p>
                        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-on-surface-variant">
                            Browsers block audio until you tap the page. This turns it
                            on for this screen.
                        </p>
                        <Button
                            variant="tertiary"
                            size="xl"
                            className="mt-5 w-full"
                            onClick={load}
                            disabled={busy}
                        >
                            <Volume2 /> {busy ? "Turning on…" : "Yes, turn on sound"}
                        </Button>
                    </Card>
                ) : (
                    <Card
                        variant="elevated"
                        className="bg-success-container p-5 text-on-success-container"
                    >
                        <p className="flex items-center gap-2 text-base font-bold">
                            <CircleCheck className="size-5" /> Sound is on
                        </p>
                        <p className="mt-1.5 text-sm leading-6">
                            {withFile} cue{withFile === 1 ? "" : "s"} from your own
                            files
                            {borrowed > 0 && `, ${borrowed} borrowing another`}
                            {synth > 0 && `, ${synth} on fallback tones`}.
                        </p>
                        <Button
                            variant="outlined"
                            className="mt-4 w-full"
                            onClick={playAll}
                            disabled={busy}
                        >
                            <Play /> {busy ? "Playing…" : "Play everything in order"}
                        </Button>
                    </Card>
                )}

                {/* ── Per-cue ──────────────────────────────────────────── */}
                {sound.enabled &&
                    GROUPS.map((group) => (
                        <Card key={group.title} variant="elevated" className="p-5">
                            <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                                {group.icon}
                                {group.title}
                            </h2>
                            <p className="mb-4 mt-1 text-xs leading-5 text-on-surface-variant">
                                {group.blurb}
                            </p>

                            <div className="space-y-2">
                                {group.cues.map(({ cue, label, when }) => {
                                    const s = sources?.[cue];
                                    const tag = s ? sourceLabel(s) : null;
                                    return (
                                        <button
                                            key={cue}
                                            type="button"
                                            onClick={() => preview(cue)}
                                            className={cn(
                                                "state-layer flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors duration-150",
                                                playing === cue
                                                    ? "bg-primary text-on-primary"
                                                    : "bg-surface-container-highest text-on-surface"
                                            )}
                                        >
                                            <Play className="size-4 shrink-0" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold">
                                                    {label}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "block text-xs",
                                                        playing === cue
                                                            ? "opacity-90"
                                                            : "text-on-surface-variant"
                                                    )}
                                                >
                                                    {when}
                                                </span>
                                            </span>
                                            {tag && (
                                                <Chip
                                                    variant={tag.ok ? "neutral" : "error"}
                                                    size="sm"
                                                >
                                                    {tag.text}
                                                </Chip>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    ))}

                {/* ── When it still won't play ─────────────────────────── */}
                <Card variant="elevated" className="p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-on-surface">
                        <CircleAlert className="size-4 text-tertiary" /> If you still
                        hear nothing
                    </h2>
                    <ul className="space-y-2.5 text-sm leading-6 text-on-surface-variant">
                        <li>
                            <strong className="text-on-surface">On an iPhone,</strong>{" "}
                            the physical silent switch mutes this. It's the most common
                            cause by far.
                        </li>
                        <li>
                            <strong className="text-on-surface">On the TV,</strong> each
                            screen has its own switch —{" "}
                            <code className="rounded bg-surface-container-highest px-1 py-0.5 text-xs">
                                /games
                            </code>{" "}
                            and{" "}
                            <code className="rounded bg-surface-container-highest px-1 py-0.5 text-xs">
                                /oracle
                            </code>{" "}
                            are separate pages. Turning one on does nothing for the
                            other.
                        </li>
                        <li>
                            <strong className="text-on-surface">
                                &ldquo;Fallback tone&rdquo;
                            </strong>{" "}
                            above means no audio file was found for that cue. It still
                            makes a sound, just a plain one.
                        </li>
                        <li>
                            <strong className="text-on-surface">Sound never blocks</strong>{" "}
                            anything. If it fails, answers and buzzes still go through
                            normally.
                        </li>
                    </ul>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                    <Button variant="tonal" onClick={load} disabled={busy}>
                        <RotateCcw /> Reload sounds
                    </Button>
                    <Button asChild variant="outlined">
                        <a href="/network">
                            <ArrowLeft /> Connection
                        </a>
                    </Button>
                </div>
            </main>
        </div>
    );
}
