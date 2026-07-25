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

export interface GameState {
    session: { id: string; title: string; status: SessionStatus } | null;
    round: PublicRound | null;
    question: PublicQuestion | null;
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
    points: number;
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
