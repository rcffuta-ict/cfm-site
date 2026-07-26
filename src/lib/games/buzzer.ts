/**
 * Buzzer rules.
 *
 * The ordering itself lives in Postgres (`buzzer_press`, docs/buzzer-schema.sql)
 * because it's a race, not a calculation — see §5 of docs/game-plan.md. What's
 * here is everything around it: configuration, scoring, and presentation.
 */

export interface BuzzerConfig {
    /** How many places score. Beyond this, a press is recorded but worth 0. */
    scoringPlaces: number;
    /** Points for first place; later places score proportionally less. */
    basePoints: number;
}

export const DEFAULT_BUZZER_CONFIG: BuzzerConfig = {
    scoringPlaces: 3,
    basePoints: 200,
};

export function parseBuzzerConfig(raw: unknown): BuzzerConfig {
    const config = (raw ?? {}) as Partial<BuzzerConfig>;
    return {
        scoringPlaces: Math.max(
            1,
            Math.min(10, Number(config.scoringPlaces) || DEFAULT_BUZZER_CONFIG.scoringPlaces)
        ),
        basePoints:
            config.basePoints === undefined
                ? DEFAULT_BUZZER_CONFIG.basePoints
                : Math.max(0, Math.min(10_000, Number(config.basePoints))),
    };
}

/**
 * First place takes the full amount, and each place after keeps a decreasing
 * share. Outside the scoring places a press still counts as taking part but
 * earns nothing — otherwise a room of 500 all score for pressing late.
 */
export function scorePress(config: BuzzerConfig, position: number): number {
    if (position > config.scoringPlaces) return 0;
    return Math.round(config.basePoints / position);
}

/** "1st", "2nd", "3rd" … for the TV and the phone. */
export function ordinal(n: number): string {
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
    switch (n % 10) {
        case 1:
            return `${n}st`;
        case 2:
            return `${n}nd`;
        case 3:
            return `${n}rd`;
        default:
            return `${n}th`;
    }
}

/**
 * Reaction times are shown to the hall, so they need to read instantly:
 * milliseconds under a second, seconds to one decimal after that.
 */
export function formatReaction(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export function validatePrompts(prompts: string[]): string | null {
    const cleaned = prompts.map((p) => p.trim()).filter(Boolean);
    if (cleaned.length === 0) return "Add at least one prompt.";
    if (cleaned.some((p) => p.length > 500))
        return "Prompts must be under 500 characters.";
    return null;
}
