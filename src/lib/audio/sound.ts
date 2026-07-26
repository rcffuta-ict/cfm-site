/**
 * Game sound.
 *
 * Real audio files are the intended sound of this game — a quiz buzzer should
 * sound like a quiz buzzer. They live in `public/sounds/` (see the README
 * there) and are decoded into Web Audio buffers up front, because for the
 * buzzer and the countdown, playback latency is part of the experience.
 *
 * Every cue also has a synthesised fallback. If a file is missing, still
 * downloading, or fails to decode, the cue still fires — quieter and plainer,
 * but the game never goes silent. That means the app ships and runs before a
 * single file has been sourced.
 *
 * Two very different consumers:
 *  - the TV, running through the church PA, which should feel like a game show;
 *  - phones, which stay quiet and tactile, because 500 of them chirping at once
 *    would drown the PA it's meant to complement.
 */

export type Cue =
    | "tap"
    | "lockedIn"
    | "roundStart"
    | "tick"
    | "tickUrgent"
    | "lock"
    | "reveal"
    | "call"
    | "bingoWin"
    | "buzzerOpen"
    | "buzzed"
    | "winner"
    // ── Beyond the games ────────────────────────────────────────────────
    | "loginSuccess"
    | "loginError"
    | "join"
    /** Loops while the Oracle reels are turning — see `playLoop`. */
    | "spin"
    | "spinLand"
    | "oracleReveal";

/**
 * Extensions tried in order for each cue name. Whatever you find first — a
 * `.wav` off Freesound, an `.mp3` off Pixabay — just works; there's no need to
 * convert anything. `.mp3` is listed first only because it's the smallest, and
 * these are downloaded over the venue's connection.
 */
export const EXTENSIONS = ["mp3", "wav", "ogg", "m4a"] as const;

/**
 * Cue names are fixed so sourcing is a checklist: drop `buzzed.wav` (or .mp3,
 * or .ogg) into `public/sounds/` and it takes over from the synth on the next
 * load — no code change.
 *
 * `gain` trims each file to a sensible level relative to the others, since
 * downloaded sounds are mastered all over the place.
 */
export const CUE_FILES: Record<Cue, { file: string; gain: number }> = {
    tap: { file: "tap", gain: 0.5 },
    lockedIn: { file: "locked-in", gain: 0.7 },
    roundStart: { file: "round-start", gain: 0.9 },
    tick: { file: "tick", gain: 0.5 },
    tickUrgent: { file: "tick-urgent", gain: 0.75 },
    lock: { file: "lock", gain: 0.9 },
    reveal: { file: "reveal", gain: 0.9 },
    call: { file: "call", gain: 0.85 },
    bingoWin: { file: "bingo-win", gain: 1 },
    buzzerOpen: { file: "buzzer-open", gain: 1 },
    buzzed: { file: "buzzed", gain: 1 },
    winner: { file: "winner", gain: 1 },
    loginSuccess: { file: "login-success", gain: 0.6 },
    loginError: { file: "login-error", gain: 0.6 },
    join: { file: "join", gain: 0.7 },
    spin: { file: "spin", gain: 0.7 },
    spinLand: { file: "spin-land", gain: 1 },
    oracleReveal: { file: "oracle-reveal", gain: 1 },
};

/**
 * Where a cue can borrow another cue's recording.
 *
 * Sourcing sixteen distinct sounds is a lot of work for moments that are
 * closely related anyway — signing in and locking in an answer both just mean
 * "that worked". So a cue with no file of its own reuses a sensible neighbour's
 * before falling back to the synth, at its own volume.
 *
 * A real file always wins: drop `join.wav` in and it stops borrowing.
 */
export const CUE_ALIASES: Partial<Record<Cue, Cue>> = {
    // "You're signed in" and "your answer landed" are the same reassurance.
    loginSuccess: "lockedIn",
    // The closest thing to a "no" in the set — a short descending thud.
    loginError: "lock",
    // Joining the game deserves the bright resolving chime.
    join: "reveal",
    // The Oracle naming someone is the biggest moment of the night; it earns
    // the fanfare.
    oracleReveal: "winner",
};

// ── Synthesised fallbacks ───────────────────────────────────────────────────

interface Note {
    freq: number;
    at: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
}

const A4 = 440;
const n = (semitones: number) => A4 * Math.pow(2, semitones / 12);

const FALLBACK: Record<Cue, Note[]> = {
    tap: [{ freq: n(4), at: 0, dur: 0.05, type: "sine", gain: 0.3 }],
    lockedIn: [
        { freq: n(4), at: 0, dur: 0.07, type: "sine", gain: 0.35 },
        { freq: n(11), at: 0.06, dur: 0.12, type: "sine", gain: 0.3 },
    ],
    roundStart: [
        { freq: n(-5), at: 0, dur: 0.14, type: "triangle", gain: 0.5 },
        { freq: n(0), at: 0.11, dur: 0.14, type: "triangle", gain: 0.5 },
        { freq: n(7), at: 0.22, dur: 0.3, type: "triangle", gain: 0.55 },
    ],
    tick: [{ freq: n(12), at: 0, dur: 0.05, type: "square", gain: 0.16 }],
    tickUrgent: [{ freq: n(19), at: 0, dur: 0.06, type: "square", gain: 0.26 }],
    lock: [
        { freq: n(-2), at: 0, dur: 0.12, type: "sawtooth", gain: 0.4 },
        { freq: n(-9), at: 0.09, dur: 0.26, type: "sawtooth", gain: 0.4 },
    ],
    reveal: [
        { freq: n(0), at: 0, dur: 0.4, type: "triangle", gain: 0.42 },
        { freq: n(4), at: 0.05, dur: 0.4, type: "triangle", gain: 0.38 },
        { freq: n(7), at: 0.1, dur: 0.45, type: "triangle", gain: 0.38 },
        { freq: n(12), at: 0.15, dur: 0.5, type: "sine", gain: 0.34 },
    ],
    call: [
        { freq: n(12), at: 0, dur: 0.5, type: "sine", gain: 0.45 },
        { freq: n(19), at: 0, dur: 0.35, type: "sine", gain: 0.2 },
    ],
    bingoWin: [
        { freq: n(0), at: 0, dur: 0.14, type: "triangle", gain: 0.45 },
        { freq: n(4), at: 0.1, dur: 0.14, type: "triangle", gain: 0.45 },
        { freq: n(7), at: 0.2, dur: 0.14, type: "triangle", gain: 0.45 },
        { freq: n(12), at: 0.3, dur: 0.5, type: "triangle", gain: 0.5 },
    ],
    buzzerOpen: [
        { freq: n(7), at: 0, dur: 0.09, type: "square", gain: 0.4 },
        { freq: n(7), at: 0.13, dur: 0.09, type: "square", gain: 0.4 },
        { freq: n(19), at: 0.26, dur: 0.34, type: "square", gain: 0.45 },
    ],
    buzzed: [
        { freq: n(-12), at: 0, dur: 0.22, type: "sawtooth", gain: 0.5 },
        { freq: n(-5), at: 0.02, dur: 0.2, type: "square", gain: 0.3 },
    ],
    winner: [
        { freq: n(0), at: 0, dur: 0.12, type: "triangle", gain: 0.45 },
        { freq: n(7), at: 0.1, dur: 0.12, type: "triangle", gain: 0.45 },
        { freq: n(12), at: 0.2, dur: 0.12, type: "triangle", gain: 0.45 },
        { freq: n(16), at: 0.3, dur: 0.12, type: "triangle", gain: 0.45 },
        { freq: n(19), at: 0.4, dur: 0.6, type: "triangle", gain: 0.55 },
    ],
    loginSuccess: [
        { freq: n(0), at: 0, dur: 0.09, type: "sine", gain: 0.3 },
        { freq: n(7), at: 0.08, dur: 0.2, type: "sine", gain: 0.3 },
    ],
    loginError: [
        { freq: n(-5), at: 0, dur: 0.12, type: "sine", gain: 0.3 },
        { freq: n(-10), at: 0.1, dur: 0.22, type: "sine", gain: 0.3 },
    ],
    join: [
        { freq: n(4), at: 0, dur: 0.08, type: "triangle", gain: 0.32 },
        { freq: n(9), at: 0.07, dur: 0.08, type: "triangle", gain: 0.32 },
        { freq: n(16), at: 0.14, dur: 0.22, type: "triangle", gain: 0.36 },
    ],
    // A single reel click. Looped fast by `playLoop`, this becomes the whirr of
    // a slot machine; on its own it's just a tick.
    spin: [{ freq: n(14), at: 0, dur: 0.035, type: "square", gain: 0.14 }],
    spinLand: [
        { freq: n(-12), at: 0, dur: 0.1, type: "square", gain: 0.4 },
        { freq: n(0), at: 0.04, dur: 0.3, type: "triangle", gain: 0.4 },
    ],
    oracleReveal: [
        { freq: n(0), at: 0, dur: 0.5, type: "triangle", gain: 0.45 },
        { freq: n(7), at: 0.08, dur: 0.5, type: "triangle", gain: 0.4 },
        { freq: n(12), at: 0.16, dur: 0.55, type: "triangle", gain: 0.4 },
        { freq: n(24), at: 0.24, dur: 0.6, type: "sine", gain: 0.3 },
    ],
};

// ── Engine ──────────────────────────────────────────────────────────────────

/** Where each cue's sound actually came from — surfaced on the /sound page. */
export type CueSource =
    | { source: "file"; ext: string }
    | { source: "borrowed"; from: Cue }
    | { source: "synth" };

const globalForAudio = globalThis as typeof globalThis & {
    __cfmAudioCtx?: AudioContext;
    __cfmBuffers?: Partial<Record<Cue, AudioBuffer>>;
    __cfmSources?: Partial<Record<Cue, CueSource>>;
    __cfmPreloaded?: boolean;
};

function context(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!Ctor) return null;

    if (!globalForAudio.__cfmAudioCtx) {
        try {
            globalForAudio.__cfmAudioCtx = new Ctor();
        } catch {
            return null;
        }
    }
    return globalForAudio.__cfmAudioCtx;
}

/**
 * Fetch and decode whatever files exist. Missing files are not an error — the
 * cue simply keeps its synthesised fallback, so a half-finished `public/sounds`
 * folder is a perfectly valid state to run in.
 */
export async function preloadSounds(): Promise<{ loaded: Cue[]; missing: Cue[] }> {
    const ctx = context();
    const loaded: Cue[] = [];
    const missing: Cue[] = [];
    if (!ctx) return { loaded, missing: Object.keys(CUE_FILES) as Cue[] };

    globalForAudio.__cfmBuffers ??= {};
    globalForAudio.__cfmSources ??= {};
    const buffers = globalForAudio.__cfmBuffers;
    const sources = globalForAudio.__cfmSources;

    await Promise.all(
        (Object.keys(CUE_FILES) as Cue[]).map(async (cue) => {
            if (buffers[cue]) {
                loaded.push(cue);
                return;
            }
            for (const ext of EXTENSIONS) {
                try {
                    const res = await fetch(
                        `/sounds/${CUE_FILES[cue].file}.${ext}`,
                        { cache: "force-cache" }
                    );
                    if (!res.ok) continue;
                    const bytes = await res.arrayBuffer();
                    buffers[cue] = await ctx.decodeAudioData(bytes);
                    sources[cue] = { source: "file", ext };
                    loaded.push(cue);
                    return;
                } catch {
                    // Wrong format for this browser, or not there — try the next.
                }
            }
            missing.push(cue);
        })
    );

    // Second pass: let anything still missing borrow a neighbour's recording.
    // Runs after every direct load so it can never borrow from a cue that was
    // itself still loading.
    for (const cue of [...missing]) {
        const alias = CUE_ALIASES[cue];
        if (!alias) continue;
        const borrowed = buffers[alias];
        if (!borrowed) continue;
        buffers[cue] = borrowed;
        sources[cue] = { source: "borrowed", from: alias };
        loaded.push(cue);
        missing.splice(missing.indexOf(cue), 1);
    }

    globalForAudio.__cfmPreloaded = true;
    return { loaded, missing };
}

/** Which cues are backed by a real file right now. */
export function loadedCues(): Cue[] {
    return Object.keys(globalForAudio.__cfmBuffers ?? {}) as Cue[];
}

/** Per-cue provenance for every cue, including the ones still on the synth. */
export function cueSources(): Record<Cue, CueSource> {
    const known = globalForAudio.__cfmSources ?? {};
    const out = {} as Record<Cue, CueSource>;
    for (const cue of Object.keys(CUE_FILES) as Cue[])
        out[cue] = known[cue] ?? { source: "synth" };
    return out;
}

/**
 * Browsers refuse to start audio until the user has interacted with the page.
 * Call this from a real click or tap. It matters most on the TV, which nobody
 * touches after it's set up — hence the explicit prompt there.
 */
export async function unlockAudio(): Promise<boolean> {
    const ctx = context();
    if (!ctx) return false;
    try {
        if (ctx.state === "suspended") await ctx.resume();
        if (ctx.state === "running" && !globalForAudio.__cfmPreloaded) {
            // Decoding needs a running context, so this is the first honest
            // opportunity to load the files.
            void preloadSounds();
        }
        return ctx.state === "running";
    } catch {
        return false;
    }
}

export function audioReady(): boolean {
    return context()?.state === "running";
}

function playSynth(ctx: AudioContext, cue: Cue, masterGain: number) {
    const notes = FALLBACK[cue];
    if (!notes) return;
    try {
    const now = ctx.currentTime;

    for (const note of notes) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();

        osc.type = note.type ?? "sine";
        osc.frequency.setValueAtTime(note.freq, now + note.at);

        // Ramp to a tiny non-zero value rather than 0: exponential ramps to
        // absolute silence produce an audible click.
        const peak = (note.gain ?? 0.3) * masterGain;
        amp.gain.setValueAtTime(0.0001, now + note.at);
        amp.gain.exponentialRampToValueAtTime(
            Math.max(0.0002, peak),
            now + note.at + 0.012
        );
        amp.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur);

        osc.connect(amp);
        amp.connect(ctx.destination);
        osc.start(now + note.at);
        osc.stop(now + note.at + note.dur + 0.02);
    }
    } catch {
        /* audio is decoration; never let it throw */
    }
}

/**
 * Loop a cue until the returned function is called — for the Oracle reels,
 * which turn for a host-chosen number of seconds.
 *
 * A real `spin.mp3` loops natively through the buffer source. Without one, the
 * single-click fallback is retriggered on an interval, which is what makes a
 * slot machine sound like a slot machine anyway.
 */
export function playLoop(cue: Cue, masterGain = 1): () => void {
    try {
    const ctx = context();
    if (!ctx || ctx.state !== "running") return () => {};

    const buffer = globalForAudio.__cfmBuffers?.[cue];

    if (buffer) {
        const source = ctx.createBufferSource();
        const amp = ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        amp.gain.value = CUE_FILES[cue].gain * masterGain;
        source.connect(amp);
        amp.connect(ctx.destination);
        source.start();
        return () => {
            try {
                // Fade rather than cut, or stopping mid-waveform clicks.
                amp.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
                source.stop(ctx.currentTime + 0.2);
            } catch {
                /* already stopped */
            }
        };
    }

    const timer = setInterval(() => playSynth(ctx, cue, masterGain), 70);
    return () => clearInterval(timer);
    } catch {
        return () => {};
    }
}

/**
 * Play a cue. Silent and harmless if audio was never unlocked.
 *
 * Nothing in here is allowed to throw. Sound is decoration on top of answering
 * a question or hitting a buzzer, and a failure to make a noise must never take
 * the actual action down with it — hence the blanket catch.
 */
export function playCue(cue: Cue, masterGain = 1): void {
    try {
        const ctx = context();
        if (!ctx || ctx.state !== "running") return;

        const buffer = globalForAudio.__cfmBuffers?.[cue];

        if (buffer) {
            const source = ctx.createBufferSource();
            const amp = ctx.createGain();
            source.buffer = buffer;
            amp.gain.value = CUE_FILES[cue].gain * masterGain;
            source.connect(amp);
            amp.connect(ctx.destination);
            source.start();
            return;
        }

        playSynth(ctx, cue, masterGain);
    } catch {
        // Never let audio break the thing it was decorating.
    }
}
