"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    playCue,
    unlockAudio,
    audioReady,
    preloadSounds,
    playLoop,
    type Cue,
} from "@/src/lib/audio/sound";
import type { GameState } from "@/src/lib/games/types";

const STORAGE_KEY = "cfm-sound";

export interface UseSound {
    /** Preference: does this person want sound at all. */
    enabled: boolean;
    /** Whether the browser has actually let us start audio yet. */
    ready: boolean;
    toggle: () => void;
    enable: () => Promise<void>;
    play: (cue: Cue) => void;
    /** Start a looping cue; call the result to stop it. */
    loop: (cue: Cue) => () => void;
}

/**
 * Sound preference plus the browser's autoplay gate, which are different things
 * and both have to be true before anything is audible.
 */
export function useSound(defaultOn: boolean, volume = 1): UseSound {
    const [enabled, setEnabled] = useState(defaultOn);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved !== null) setEnabled(saved === "1");
        } catch {
            // Private mode or blocked storage — the default stands.
        }
        setReady(audioReady());
    }, []);

    const enable = useCallback(async () => {
        const ok = await unlockAudio();
        setReady(ok);
        // Decoding needs a running context, so files load once the gate opens.
        if (ok) void preloadSounds();
    }, []);

    const toggle = useCallback(() => {
        setEnabled((was) => {
            const next = !was;
            try {
                localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
            } catch {
                /* ignore */
            }
            // Turning it on is itself a user gesture, so it's the right moment
            // to satisfy the autoplay gate.
            if (next) unlockAudio().then(setReady);
            return next;
        });
    }, []);

    const play = useCallback(
        (cue: Cue) => {
            if (!enabled) return;
            playCue(cue, volume);
        },
        [enabled, volume]
    );

    const loop = useCallback(
        (cue: Cue) => {
            if (!enabled) return () => {};
            return playLoop(cue, volume);
        },
        [enabled, volume]
    );

    return { enabled, ready, toggle, enable, play, loop };
}

/**
 * Turns game state changes into cues.
 *
 * Everything is driven off transitions held in refs rather than the render
 * cycle, so a re-render never replays a sound — the difference between a game
 * show and a stuck doorbell.
 */
export function useGameSounds(
    state: GameState | null,
    play: (cue: Cue) => void,
    options: { tv: boolean; remaining?: number | null }
) {
    const { tv, remaining } = options;

    const roundRef = useRef<string | null>(null);
    const statusRef = useRef<string | null>(null);
    const calledRef = useRef<number>(0);
    const bingoWinsRef = useRef<number>(0);
    const buzzerOpenRef = useRef<boolean>(false);
    const pressCountRef = useRef<number>(0);
    const lastTickRef = useRef<number | null>(null);

    // ── Round transitions ───────────────────────────────────────────────
    useEffect(() => {
        const round = state?.round ?? null;
        if (!round) {
            roundRef.current = null;
            statusRef.current = null;
            return;
        }

        const changedRound = round.id !== roundRef.current;
        const changedStatus = round.status !== statusRef.current;

        // A fresh mount shouldn't fire cues for state that was already true.
        const firstSight = roundRef.current === null;
        roundRef.current = round.id;
        statusRef.current = round.status;

        if (firstSight || !(changedRound || changedStatus)) return;
        if (!tv) return; // phones stay quiet on transitions; the PA carries them

        if (round.status === "active" && round.type === "trivia") play("roundStart");
        if (round.status === "locked") play("lock");
        if (round.status === "revealed") play("reveal");
    }, [state?.round?.id, state?.round?.status, state?.round?.type, tv, play]);

    // ── Countdown ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!tv || remaining === null || remaining === undefined) {
            lastTickRef.current = null;
            return;
        }
        if (state?.round?.status !== "active") return;
        if (remaining === lastTickRef.current) return;

        const previous = lastTickRef.current;
        lastTickRef.current = remaining;

        // Only tick down the closing seconds, and never on first sight.
        if (previous === null) return;
        if (remaining > 0 && remaining <= 5) play("tickUrgent");
        else if (remaining > 5 && remaining <= 10) play("tick");
    }, [remaining, state?.round?.status, tv, play]);

    // ── Bingo ───────────────────────────────────────────────────────────
    useEffect(() => {
        const bingo = state?.bingo;
        if (!bingo) {
            calledRef.current = 0;
            bingoWinsRef.current = 0;
            return;
        }

        const firstSight = calledRef.current === 0 && bingo.called.length > 1;
        if (tv && !firstSight && bingo.called.length > calledRef.current)
            play("call");
        calledRef.current = bingo.called.length;

        if (bingo.winners.length > bingoWinsRef.current && bingoWinsRef.current > 0)
            play("bingoWin");
        else if (bingo.winners.length > 0 && bingoWinsRef.current === 0 && tv)
            play("bingoWin");
        bingoWinsRef.current = bingo.winners.length;
    }, [state?.bingo?.called.length, state?.bingo?.winners.length, tv, play]);

    // ── Buzzer ──────────────────────────────────────────────────────────
    useEffect(() => {
        const buzzer = state?.buzzer;
        if (!buzzer) {
            buzzerOpenRef.current = false;
            pressCountRef.current = 0;
            return;
        }

        if (buzzer.open && !buzzerOpenRef.current) play("buzzerOpen");
        buzzerOpenRef.current = buzzer.open;

        // Only the first press gets a sting on the TV — after that it's noise.
        if (tv && buzzer.presses.length === 1 && pressCountRef.current === 0)
            play("buzzed");
        pressCountRef.current = buzzer.presses.length;
    }, [state?.buzzer?.open, state?.buzzer?.presses.length, tv, play]);
}
