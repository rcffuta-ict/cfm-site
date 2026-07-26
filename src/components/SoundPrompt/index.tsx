"use client";

import { useState } from "react";
import { Volume2, VolumeX, CircleCheck } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { preloadSounds, playCue, cueSources } from "@/src/lib/audio/sound";
import type { UseSound } from "@/src/hooks/useSound";

/**
 * The one place anything is granted permission to make a noise.
 *
 * Nothing in the app plays a sound until somebody has answered this, on every
 * screen — phones and the TVs alike. Two sizes of the same question, because a
 * phone in someone's hand and a projected screen at the front of a hall need
 * very different treatment, but the rule behind them is identical.
 *
 * The TV variant plays a sound the instant it's granted: the operator is at a
 * laptop wired into a PA whose state they can't see, and hearing the chime is
 * the only proof the chain works. Setup is the moment to find that out.
 */
export default function SoundPrompt({
    sound,
    variant = "phone",
    screen,
}: {
    sound: UseSound;
    variant?: "phone" | "tv";
    /** Which screen is being armed — the TVs have separate switches. */
    screen?: string;
}) {
    const [busy, setBusy] = useState(false);
    const [confirmed, setConfirmed] = useState<string | null>(null);

    if (!sound.needsPermission && !confirmed) return null;

    async function grant() {
        setBusy(true);
        await sound.grant();

        if (variant === "tv") {
            const { loaded, missing } = await preloadSounds();
            playCue("reveal", 1);
            const files = Object.values(cueSources()).filter(
                (s) => s.source === "file"
            ).length;
            setConfirmed(
                missing.length === 0
                    ? `${loaded.length} sounds ready (${files} from your own files).`
                    : `${loaded.length} ready, ${missing.length} on fallback tones.`
            );
        }
        setBusy(false);
    }

    // ── TV ──────────────────────────────────────────────────────────────
    if (variant === "tv") {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/92 p-10 text-center backdrop-blur-sm">
                {confirmed ? (
                    <>
                        <CircleCheck className="size-[clamp(3rem,8vw,6rem)] text-success" />
                        <div className="space-y-3">
                            <p className="font-display text-[clamp(1.6rem,4.5vw,3rem)] font-extrabold leading-tight text-on-surface">
                                Sound is on for the {screen} screen
                            </p>
                            <p className="text-[clamp(0.95rem,2vw,1.5rem)] text-on-surface-variant">
                                {confirmed} You should have just heard a chime — set
                                the level on the desk now.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setConfirmed(null)}
                            className="state-layer rounded-full bg-tertiary px-[clamp(1.5rem,4vw,3rem)] py-[clamp(0.7rem,2vh,1.2rem)] font-display text-[clamp(1rem,2.4vw,1.8rem)] font-extrabold text-on-tertiary"
                        >
                            Start the show
                        </button>
                        <button
                            type="button"
                            onClick={() => playCue("reveal", 1)}
                            className="text-[clamp(0.85rem,1.6vw,1.2rem)] text-on-surface-variant underline underline-offset-4"
                        >
                            Play it again
                        </button>
                    </>
                ) : (
                    <>
                        <Volume2 className="size-[clamp(3rem,8vw,6rem)] text-tertiary" />
                        <div className="space-y-3">
                            <p className="font-display text-[clamp(1.8rem,5vw,3.5rem)] font-extrabold leading-tight tracking-tight text-on-surface">
                                Turn on sound for the {screen} screen?
                            </p>
                            <p className="mx-auto max-w-3xl text-[clamp(0.95rem,2vw,1.5rem)] leading-relaxed text-on-surface-variant">
                                Do this on the laptop now, while you can still set the
                                level. Each screen has its own switch.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <button
                                type="button"
                                onClick={grant}
                                disabled={busy}
                                className="state-layer rounded-full bg-tertiary px-[clamp(2rem,6vw,4.5rem)] py-[clamp(0.9rem,2.5vh,1.6rem)] font-display text-[clamp(1.1rem,3vw,2.2rem)] font-extrabold text-on-tertiary disabled:opacity-60"
                            >
                                {busy ? "Turning on…" : "Yes, turn on sound"}
                            </button>
                            <button
                                type="button"
                                onClick={sound.decline}
                                disabled={busy}
                                className="state-layer rounded-full border border-outline px-[clamp(1.5rem,4vw,3rem)] py-[clamp(0.8rem,2.2vh,1.4rem)] text-[clamp(0.9rem,2vw,1.5rem)] font-semibold text-on-surface-variant"
                            >
                                Run silent
                            </button>
                        </div>
                    </>
                )}
            </div>
        );
    }

    // ── Phone ───────────────────────────────────────────────────────────
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sound-prompt-title"
            className={cn(
                "fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center",
                "bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            )}
        >
            <div className="w-full max-w-sm rounded-xl bg-surface-container-high p-6 text-center shadow-e-5 animate-in slide-in-from-bottom-4 duration-300">
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-tertiary text-on-tertiary">
                    <Volume2 className="size-7" />
                </span>

                <h2
                    id="sound-prompt-title"
                    className="font-display text-xl font-extrabold text-on-surface"
                >
                    Turn on game sounds?
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-on-surface-variant">
                    Small taps and confirmations, so you know your answer landed.
                    You can change this any time with the speaker button.
                </p>

                <div className="mt-6 space-y-2.5">
                    <button
                        type="button"
                        onClick={grant}
                        disabled={busy}
                        className="state-layer flex h-14 w-full items-center justify-center gap-2 rounded-full bg-tertiary font-display text-base font-extrabold text-on-tertiary disabled:opacity-60"
                    >
                        <Volume2 className="size-5" /> Yes, turn on sound
                    </button>
                    <button
                        type="button"
                        onClick={sound.decline}
                        disabled={busy}
                        className="state-layer flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-on-surface-variant"
                    >
                        <VolumeX className="size-4" /> Play without sound
                    </button>
                </div>

                <p className="mt-4 text-xs leading-5 text-on-surface-variant">
                    On iPhone, the silent switch mutes this regardless.
                </p>
            </div>
        </div>
    );
}
