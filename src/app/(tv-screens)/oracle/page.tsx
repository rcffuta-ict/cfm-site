"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Zap, Volume2, VolumeX } from "lucide-react";
import OracleSlotMachine from "@/src/components/OracleSlotMachine";
import { displayLevelBetter } from "@/src/lib/utils";
import { Chip } from "@/src/components/ui/chip";
import { Avatar } from "@/src/components/ui/avatar";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";
import type { OraclePerson } from "@/src/lib/oracle/channel";
import { useSound } from "@/src/hooks/useSound";
import SoundPrompt from "@/src/components/SoundPrompt";
import { CfmIcon } from "@/src/components/common/Brand";

export default function OraclePage() {
    const [raffleId, setRaffleId] = useState<number | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [spinDuration, setSpinDuration] = useState<number>(3000);
    const [person, setPerson] = useState<OraclePerson | null>(null);
    const [connected, setConnected] = useState(false);

    // This screen runs through the church PA too — the reels turning is half
    // the theatre of the draw.
    const sound = useSound(1);
    // Held in a ref because the SSE handlers are registered once and must not
    // close over a stale copy of the stop function.
    const stopSpinRef = useRef<(() => void) | null>(null);
    const soundRef = useRef(sound);
    soundRef.current = sound;

    /**
     * The Oracle feed is a plain SSE connection to the local server on the venue
     * wifi — no Supabase, no internet. A roll reaches this screen in
     * milliseconds, and a dead uplink can't stall the draw. `EventSource`
     * reconnects on its own, so restarting the laptop mid-event heals itself.
     */
    useEffect(() => {
        const source = new EventSource("/api/oracle/stream");

        const startSpin = () => {
            stopSpinRef.current?.();
            stopSpinRef.current = soundRef.current.loop("spin");
        };

        const stopSpin = () => {
            stopSpinRef.current?.();
            stopSpinRef.current = null;
        };

        const onPreparing = () => {
            setRaffleId(null);
            setPerson(null);
            setSpinning(true);
            startSpin();
            toast.loading("Oracle is choosing…", { id: "oracle" });
        };

        const onSelection = (raw: MessageEvent) => {
            const payload = JSON.parse(raw.data);
            const id = Number(payload?.raffleId);
            const duration = Number(payload?.spinDuration) || 3000;
            if (!id) return;
            setSpinDuration(duration);
            setRaffleId(id);
            setSpinning(false);
            // The reels are already turning from PREPARING; keep the loop going
            // for the full spin, then land it in time with the animation.
            startSpin();
            setTimeout(() => {
                stopSpin();
                soundRef.current.play("spinLand");
                toast.success("Oracle has decided", { id: "oracle" });
            }, duration);
        };

        const onReveal = (raw: MessageEvent) => {
            setPerson(JSON.parse(raw.data) as OraclePerson);
            soundRef.current.play("oracleReveal");
        };

        const onReset = () => {
            setRaffleId(null);
            setPerson(null);
            setSpinning(false);
            stopSpin();
            toast.dismiss("oracle");
        };

        /**
         * Sent once on connect. A TV opened late — or reloaded mid-reveal —
         * lands on whatever the room is already looking at rather than dropping
         * back to standby.
         */
        const onSync = (raw: MessageEvent) => {
            const state = JSON.parse(raw.data);
            setSpinDuration(Number(state?.spinDuration) || 3000);
            setRaffleId(state?.raffleId ?? null);
            setPerson((state?.person as OraclePerson | null) ?? null);
            setSpinning(state?.phase === "preparing");
        };

        source.addEventListener(ORACLE_EVENTS.PREPARING, onPreparing);
        source.addEventListener(ORACLE_EVENTS.SELECTION, onSelection);
        source.addEventListener(ORACLE_EVENTS.REVEAL, onReveal);
        source.addEventListener(ORACLE_EVENTS.RESET, onReset);
        source.addEventListener(ORACLE_EVENTS.SYNC, onSync);

        source.onopen = () => {
            setConnected(true);
            toast.success("Oracle is live", {
                duration: 2000,
                id: "oracle-live",
            });
        };
        source.onerror = () => setConnected(false);

        return () => {
            stopSpin();
            source.close();
        };
    }, []);

    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-[clamp(1.5rem,4vh,3.5rem)] px-6 py-12">
            {/* ── Page header ───────────────────────────────────────────
                ORACLE is the name of this screen, so it is set as type rather
                than a logo. It is deliberately held to ~6vw against the reels'
                ~15vw digits: bold enough to title the screen, never loud enough
                to compete with the draw itself, which is what the hall is
                watching. */}
            <header className="flex flex-col items-center gap-3 text-center">
                <h1 className="flex items-center gap-[0.25em] font-display text-[clamp(2.4rem,6.5vw,5.5rem)] font-extrabold uppercase leading-none tracking-[-0.02em] text-on-surface">
                    {/* <Zap
                        className="size-[0.72em] shrink-0 text-tertiary"
                        strokeWidth={2.5}
                    /> */}
                    <CfmIcon width={50} height={50} priority />
                    Oracle
                </h1>

                <p className="text-[clamp(0.85rem,1.5vw,1.35rem)] font-medium uppercase tracking-[0.32em] text-on-surface-variant">
                    Never forget · Never bias
                </p>

                {/* <button
                    type="button"
                    onClick={sound.toggle}
                    aria-label={sound.enabled ? "Mute" : "Turn on sound"}
                    className="state-layer absolute right-6 top-6 grid size-12 place-items-center rounded-full text-on-surface-variant"
                >
                    {sound.enabled ? (
                        <Volume2 className="size-6" />
                    ) : (
                        <VolumeX className="size-6" />
                    )}
                </button> */}

                <Chip
                    variant={connected ? "success" : "neutral"}
                    size="tv"
                    className="mt-1"
                >
                    <span
                        className={`h-[0.5em] w-[0.5em] rounded-full ${
                            connected
                                ? "animate-pulse-dot bg-on-success-container"
                                : "bg-on-surface-variant"
                        }`}
                    />
                    {connected ? "Live" : "Connecting…"}
                </Chip>
            </header>

            <SoundPrompt sound={sound} variant="tv" screen="Oracle" />

            <OracleSlotMachine
                value={raffleId}
                isSpinning={spinning}
                spinDuration={spinDuration}
            />

            {!raffleId && !spinning && (
                <p className="text-[clamp(1.1rem,2.4vw,2rem)] tracking-[0.01em] text-on-surface-variant">
                    Waiting for the Oracle to begin…
                </p>
            )}

            {/* ── Grand reveal ─────────────────────────────────────────── */}
            {person && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6 animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl rounded-2xl bg-surface-container-high p-10 text-center shadow-e-5 animate-in zoom-in-95 duration-300 sm:p-14">
                        <p className="flex items-center justify-center gap-3 text-[clamp(1rem,2.2vw,1.8rem)] font-semibold uppercase tracking-[0.18em] text-tertiary">
                            <Zap className="size-[1.2em] animate-bolt-strike" />
                            The Oracle has chosen
                        </p>

                        {person.avatarUrl && (
                            <div className="mt-8 flex justify-center">
                                <Avatar
                                    src={person.avatarUrl}
                                    name={`${person.firstName} ${person.lastName}`}
                                    size="tv"
                                    tone="primary"
                            />
                        </div>)}

                        <h2 className="mt-8 font-display text-[clamp(2.4rem,7.5vw,5.5rem)] font-extrabold leading-[1.05] tracking-tight text-on-surface">
                            {person.firstName} {person.lastName}
                        </h2>

                        <div className="mt-7 flex flex-wrap justify-center gap-3">
                            <Chip variant="secondary" size="tv">
                                {person.gender === "male"
                                    ? "Brother"
                                    : "Sister"}
                            </Chip>
                            <Chip variant="primary" size="tv">
                                {displayLevelBetter(person.level)}
                            </Chip>
                            {person.unit && (
                                <Chip variant="tertiary" size="tv">
                                    {person.unit}
                                </Chip>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
