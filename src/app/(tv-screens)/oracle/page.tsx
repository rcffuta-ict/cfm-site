"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PartyPopper } from "lucide-react";
import OracleSlotMachine from "@/src/components/OracleSlotMachine";
import { displayLevelBetter } from "@/src/lib/utils";
import { Badge } from "@/src/components/ui/badge";
import { Avatar } from "@/src/components/ui/avatar";
import { createBrowserClient } from "@/src/lib/supabase/client";
import { ORACLE_CHANNEL, ORACLE_EVENTS } from "@/src/lib/oracle/channel";
import type { OraclePerson } from "@/src/lib/oracle/channel";

export default function OraclePage() {
    const [raffleId, setRaffleId] = useState<number | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [spinDuration, setSpinDuration] = useState<number>(3000);
    const [person, setPerson] = useState<OraclePerson | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const supabase = createBrowserClient();
        const channel = supabase
            .channel(ORACLE_CHANNEL)
            .on("broadcast", { event: ORACLE_EVENTS.PREPARING }, () => {
                setRaffleId(null);
                setPerson(null);
                setSpinning(true);
                toast.loading("Oracle is choosing…", { id: "oracle" });
            })
            .on("broadcast", { event: ORACLE_EVENTS.SELECTION }, ({ payload }) => {
                const id = Number(payload?.raffleId);
                const duration = Number(payload?.spinDuration) || 3000;
                if (!id) return;
                setSpinDuration(duration);
                setRaffleId(id);
                setSpinning(false);
                setTimeout(() => {
                    toast.success("Oracle has decided!", { id: "oracle" });
                }, duration);
            })
            .on("broadcast", { event: ORACLE_EVENTS.REVEAL }, ({ payload }) => {
                setPerson(payload as OraclePerson);
            })
            .on("broadcast", { event: ORACLE_EVENTS.RESET }, () => {
                setRaffleId(null);
                setPerson(null);
                setSpinning(false);
                toast.dismiss("oracle");
            })
            .subscribe((status) => {
                setConnected(status === "SUBSCRIBED");
                if (status === "SUBSCRIBED") {
                    toast.success("Oracle is live!", {
                        duration: 2000,
                        id: "oracle-live",
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-10 px-6 py-16">
            {/* Header */}
            <div className="flex flex-col items-center text-center">
                <p className="text-[clamp(0.8rem,1.6vw,1.4rem)] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                    RCF FUTA
                </p>
                <h1 className="mt-2 text-[clamp(4rem,14vw,12rem)] font-black leading-none tracking-tight text-gradient">
                    ORACLE
                </h1>
                <p className="mt-2 text-[clamp(1.1rem,3vw,2.4rem)] text-muted-foreground">
                    Never Forget. Never Bias.
                </p>
                <span
                    className={`mt-5 inline-flex items-center gap-2 rounded-full border px-5 py-2 text-[clamp(0.75rem,1.4vw,1.1rem)] font-semibold uppercase tracking-wider ${
                        connected
                            ? "border-brand-mint/40 text-brand-mint"
                            : "border-border text-muted-foreground"
                    }`}
                >
                    <span
                        className={`size-2.5 rounded-full ${connected ? "bg-brand-mint animate-pulse-dot shadow-[0_0_10px_rgba(46,222,130,0.9)]" : "bg-brand-amber"}`}
                    />
                    {connected ? "Connected" : "Connecting…"}
                </span>
            </div>

            {/* Slot machine */}
            <OracleSlotMachine
                value={raffleId}
                isSpinning={spinning}
                spinDuration={spinDuration}
            />

            {/* Standby */}
            {!raffleId && !spinning && (
                <p className="animate-pulse text-[clamp(1.1rem,2.6vw,2rem)] text-muted-foreground">
                    Waiting for the Oracle to activate…
                </p>
            )}

            {/* Grand reveal overlay */}
            {person && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="relative w-full max-w-3xl overflow-hidden rounded-[2.5rem] border border-border bg-card/90 p-10 text-center shadow-glow backdrop-blur-2xl animate-in zoom-in-90 duration-300 sm:p-16">
                        <div className="pointer-events-none absolute -inset-10 opacity-30 blur-3xl ring-conic" />
                        <div className="relative">
                            <p className="flex items-center justify-center gap-2 text-[clamp(1.1rem,2.6vw,2rem)] font-semibold text-accent">
                                <PartyPopper className="size-[1.2em]" />{" "}
                                Congratulations!
                            </p>
                            <div className="mt-7 flex justify-center">
                                <Avatar
                                    src={person.avatarUrl}
                                    name={`${person.firstName} ${person.lastName}`}
                                    size="tv"
                                    ring
                                />
                            </div>
                            <h2 className="mt-7 text-[clamp(2.4rem,8vw,6rem)] font-black leading-tight tracking-tight text-gradient">
                                {person.firstName} {person.lastName}
                            </h2>
                            <div className="mt-6 flex flex-wrap justify-center gap-3 text-[clamp(0.9rem,1.8vw,1.4rem)]">
                                <Badge variant="brand" className="px-5 py-2">
                                    {person.gender === "male"
                                        ? "Brother"
                                        : "Sister"}
                                </Badge>
                                <Badge variant="accent" className="px-5 py-2">
                                    {displayLevelBetter(person.level)}
                                </Badge>
                                {person.unit && (
                                    <Badge variant="mint" className="px-5 py-2">
                                        {person.unit}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
