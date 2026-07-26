/** Shared game vocabulary — imported by routes, the TV screen and phones. */

export type RoundType = "trivia" | "buzzer" | "bingo";

export type RoundStatus =
    | "pending"
    | "active"
    | "locked"
    | "revealed"
    | "ended";

export type SessionStatus = "draft" | "live" | "ended";

export interface RoundConfig {
    /** How long the round runs once started. */
    durationSeconds: number;
    /** Awarded for a correct answer, before any speed bonus. */
    basePoints: number;
    /** Extra points for answering instantly, decaying to 0 at the buzzer. */
    speedBonus: number;
}

export const DEFAULT_ROUND_CONFIG: RoundConfig = {
    durationSeconds: 20,
    basePoints: 100,
    speedBonus: 50,
};

export interface PublicQuestion {
    id: string;
    question: string;
    options: string[];
    points: number;
    orderIndex: number;
}

export interface PublicRound {
    id: string;
    type: RoundType;
    status: RoundStatus;
    orderIndex: number;
    /** Epoch ms, or null before the round starts. */
    startsAt: number | null;
    endsAt: number | null;
    config: RoundConfig;
}

/** What the TV and phones need to render a bingo round. */
export interface PublicBingo {
    gridSize: number;
    freeCentre: boolean;
    pattern: "line" | "full";
    /** The full pool, so a card's indexes can be resolved to words. */
    items: string[];
    /** Pool indexes already announced, most recent first. */
    called: number[];
    /** Winners so far, in the order they claimed. */
    winners: { name: string; pattern: string; position: number }[];
}

/** What the TV and phones need to render a buzzer round. */
export interface PublicBuzzer {
    promptId: string | null;
    promptText: string | null;
    /** Whether the host has opened it — a closed prompt shows but can't be hit. */
    open: boolean;
    scoringPlaces: number;
    /** Presses so far, fastest first. */
    presses: {
        name: string;
        position: number;
        reactionMs: number | null;
        points: number;
    }[];
    /** Where this prompt sits in the round, for the "3 of 8" label. */
    index: number;
    total: number;
}

export interface GameState {
    session: { id: string; title: string; status: SessionStatus } | null;
    /**
     * Whether on-screen assistance is switched on (`GAME_HELPERS=1`).
     *
     * Off by default, deliberately. The helpers — highlighting squares whose
     * item has been called, listing what's already been called — make bingo
     * markedly easier and take the attention off the caller and the big screen.
     * They're useful while rehearsing or for a smaller, gentler room; they are
     * not how the game is meant to be played.
     */
    helpers: boolean;
    round: PublicRound | null;
    question: PublicQuestion | null;
    bingo: PublicBingo | null;
    buzzer: PublicBuzzer | null;
    /**
     * Only ever populated once the round is revealed — while a round is live
     * this is null, so the answer can't be read out of the poll response.
     */
    correctIndex: number | null;
    /**
     * Server clock, epoch ms. Clients hold `offset = serverNow - Date.now()`
     * and derive `remaining = endsAt - (Date.now() + offset)`, so a phone with
     * a wrong system clock still counts down correctly.
     */
    serverNow: number;
    /** Changes whenever anything above changes; drives the ETag. */
    version: string;
}

export interface LeaderboardEntry {
    profileId: string;
    name: string;
    level: string | null;
    avatarUrl: string | null;
    /** Per-game breakdown, so the board shows where someone earned it. */
    trivia: number;
    bingo: number;
    buzzer: number;
    /** The sum of the three — what the board is sorted by. */
    points: number;
    /** Trivia questions answered correctly. */
    correct: number;
}

/**
 * Correct answers are worth more the faster they land. Linear decay from the
 * full bonus at the moment the round opens to zero at the buzzer.
 */
export function scoreAnswer(
    config: RoundConfig,
    basePoints: number,
    answeredAt: number,
    startsAt: number | null,
    endsAt: number | null
): number {
    if (!startsAt || !endsAt || endsAt <= startsAt) return basePoints;
    const elapsed = answeredAt - startsAt;
    const window = endsAt - startsAt;
    const remaining = Math.max(0, Math.min(1, 1 - elapsed / window));
    return basePoints + Math.round(config.speedBonus * remaining);
}
