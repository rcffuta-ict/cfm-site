"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import type { ConnectionReading } from "@/src/lib/games/connection";

/**
 * Tells a member when their connection — not their reflexes — is the problem.
 *
 * Came out of the beta: people on a weak signal lost buzzer races and assumed
 * they were slow. Silence is the worst outcome here, but so is nagging, so the
 * warning fires once per sustained bad patch and stays quiet until things
 * recover and go wrong again.
 */

/** Don't warn on a single slow poll — wait for it to look like a pattern. */
const CONSECUTIVE_BEFORE_WARNING = 2;
/** Never warn more often than this, however bad it gets. */
const COOLDOWN_MS = 90_000;

export default function ConnectionWatch({
    connection,
}: {
    connection: ConnectionReading;
}) {
    const badRunRef = useRef(0);
    const lastWarnedRef = useRef(0);
    const warnedRef = useRef(false);

    useEffect(() => {
        const bad = connection.grade === "poor" || connection.grade === "offline";

        if (!bad) {
            badRunRef.current = 0;
            // Only celebrate a recovery if we actually complained first.
            if (warnedRef.current) {
                warnedRef.current = false;
                toast.success("Connection's back", {
                    id: "connection",
                    duration: 2500,
                });
            }
            return;
        }

        badRunRef.current += 1;
        if (badRunRef.current < CONSECUTIVE_BEFORE_WARNING) return;
        if (Date.now() - lastWarnedRef.current < COOLDOWN_MS) return;

        lastWarnedRef.current = Date.now();
        warnedRef.current = true;

        toast(
            connection.grade === "offline"
                ? "You're offline — answers won't send until this clears."
                : "Your connection is weak. Try moving somewhere with better signal.",
            {
                id: "connection",
                icon: "📶",
                duration: 7000,
            }
        );
    }, [connection.grade]);

    return null;
}
