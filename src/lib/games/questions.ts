import { DEFAULT_ROUND_CONFIG } from "@/src/lib/games/types";

/**
 * Authoring-side shapes and validation for trivia questions.
 *
 * A question *is* a round (see service.ts), so the round id is the handle the
 * admin UI works with throughout — editing, reordering, disabling and deleting
 * all key off it.
 */

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export interface QuestionInput {
    question: string;
    options: string[];
    correctIndex: number;
    points?: number;
    durationSeconds?: number;
}

/** What the admin console renders per row. */
export interface HostQuestion {
    roundId: string;
    orderIndex: number;
    status: string;
    disabled: boolean;
    question: string;
    options: string[];
    correctIndex: number;
    points: number;
    durationSeconds: number;
    /** How many people have answered — drives the "can't edit / warn on delete" rules. */
    answerCount: number;
}

/**
 * `disabled` lives in the round's `config` jsonb rather than its own column, so
 * turning a question off needs no migration — the same trick
 * `events.config.disabled_levels` already uses for paused levels. The round
 * list is small enough that filtering in JS costs nothing.
 */
export function isDisabled(config: unknown): boolean {
    return (config as { disabled?: unknown } | null)?.disabled === true;
}

export function validateQuestion(input: QuestionInput): string | null {
    if (!input.question?.trim()) return "Question text is required.";

    if (!Array.isArray(input.options)) return "Options must be a list.";

    const options = input.options.map((o) => String(o ?? "").trim());
    if (options.length < MIN_OPTIONS)
        return `Add at least ${MIN_OPTIONS} options.`;
    if (options.length > MAX_OPTIONS)
        return `No more than ${MAX_OPTIONS} options.`;
    if (options.some((o) => !o)) return "Every option needs text.";

    // Duplicates make the reveal ambiguous on the big screen.
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length)
        return "Options must be different from each other.";

    if (
        typeof input.correctIndex !== "number" ||
        input.correctIndex < 0 ||
        input.correctIndex >= options.length
    )
        return "Choose which option is correct.";

    if (input.points !== undefined && (input.points < 0 || input.points > 10_000))
        return "Points must be between 0 and 10000.";

    if (
        input.durationSeconds !== undefined &&
        (input.durationSeconds < 5 || input.durationSeconds > 300)
    )
        return "Duration must be between 5 and 300 seconds.";

    return null;
}

export function buildRoundConfig(
    input: Pick<QuestionInput, "points" | "durationSeconds">,
    disabled = false
) {
    return {
        ...DEFAULT_ROUND_CONFIG,
        durationSeconds:
            input.durationSeconds ?? DEFAULT_ROUND_CONFIG.durationSeconds,
        basePoints: input.points ?? DEFAULT_ROUND_CONFIG.basePoints,
        disabled,
    };
}
