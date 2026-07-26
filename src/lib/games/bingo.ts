import crypto from "crypto";

/**
 * Bingo rules, kept as pure functions so the win check is the same code
 * wherever it runs and can be reasoned about without a database.
 *
 * The trust model: a player may only mark a cell whose item has already been
 * called, and the server enforces that when the mark is written. A claim then
 * only has to prove the marks form a line — there's no way to auto-mark a card
 * into a win, because the marks could never have been written in the first
 * place.
 */

export const DEFAULT_GRID = 5;
export const MIN_GRID = 3;
export const MAX_GRID = 5;

export interface BingoConfig {
    /** Cards are gridSize × gridSize. */
    gridSize: number;
    /** Classic free square in the middle; only possible on an odd grid. */
    freeCentre: boolean;
    /** "line" = any row, column or diagonal. "full" = the whole card. */
    pattern: "line" | "full";
    /** The pool of callable items. */
    items: string[];
    /** Points for the first valid claim; later winners get proportionally less. */
    basePoints: number;
}

export const DEFAULT_BINGO_CONFIG: Omit<BingoConfig, "items"> = {
    gridSize: DEFAULT_GRID,
    freeCentre: true,
    pattern: "line",
    basePoints: 300,
};

/** A layout is pool indexes in row-major order; `null` is the free centre. */
export type CardLayout = (number | null)[];

export function centreIndex(gridSize: number): number {
    return Math.floor((gridSize * gridSize) / 2);
}

export function hasFreeCentre(config: Pick<BingoConfig, "gridSize" | "freeCentre">) {
    // An even grid has no middle square to give away.
    return config.freeCentre && config.gridSize % 2 === 1;
}

/** How many pool items a card actually consumes. */
export function cellsNeeded(config: Pick<BingoConfig, "gridSize" | "freeCentre">) {
    return config.gridSize * config.gridSize - (hasFreeCentre(config) ? 1 : 0);
}

/**
 * Fisher–Yates using crypto randomness. Cards are the one thing every member
 * compares with their neighbour, so a weak shuffle would be noticed.
 */
function shuffle<T>(input: T[]): T[] {
    const out = [...input];
    for (let i = out.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

export function generateLayout(config: BingoConfig): CardLayout {
    const need = cellsNeeded(config);
    if (config.items.length < need)
        throw new Error(
            `Need at least ${need} items for a ${config.gridSize}×${config.gridSize} card.`
        );

    const picked = shuffle(config.items.map((_, i) => i)).slice(0, need);
    const layout: CardLayout = [];
    const centre = centreIndex(config.gridSize);
    const free = hasFreeCentre(config);

    let cursor = 0;
    for (let cell = 0; cell < config.gridSize * config.gridSize; cell++) {
        if (free && cell === centre) layout.push(null);
        else layout.push(picked[cursor++]);
    }
    return layout;
}

/** Every winning cell-index set for a grid, labelled. */
export function winningLines(
    config: Pick<BingoConfig, "gridSize" | "pattern">
): { pattern: string; cells: number[] }[] {
    const n = config.gridSize;

    if (config.pattern === "full")
        return [
            {
                pattern: "full",
                cells: Array.from({ length: n * n }, (_, i) => i),
            },
        ];

    const lines: { pattern: string; cells: number[] }[] = [];

    for (let r = 0; r < n; r++)
        lines.push({
            pattern: `row-${r}`,
            cells: Array.from({ length: n }, (_, c) => r * n + c),
        });

    for (let c = 0; c < n; c++)
        lines.push({
            pattern: `col-${c}`,
            cells: Array.from({ length: n }, (_, r) => r * n + c),
        });

    lines.push({
        pattern: "diag-down",
        cells: Array.from({ length: n }, (_, i) => i * n + i),
    });
    lines.push({
        pattern: "diag-up",
        cells: Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)),
    });

    return lines;
}

/**
 * The completed line, or null. Marks are trusted here *because* the mark route
 * already refused any cell whose item hadn't been called.
 */
export function findWin(
    config: Pick<BingoConfig, "gridSize" | "pattern">,
    marked: Set<number>
): string | null {
    for (const line of winningLines(config)) {
        if (line.cells.every((cell) => marked.has(cell))) return line.pattern;
    }
    return null;
}

/** Human-readable line name for the TV. */
export function describePattern(pattern: string): string {
    if (pattern === "full") return "Full house";
    if (pattern === "diag-down" || pattern === "diag-up") return "Diagonal";
    const [kind, index] = pattern.split("-");
    const ordinal = Number(index) + 1;
    return kind === "row" ? `Row ${ordinal}` : `Column ${ordinal}`;
}

/**
 * Later winners still score, but less — the room stays interested after the
 * first shout without making tenth place worth the same as first.
 */
export function scoreWin(basePoints: number, position: number): number {
    return Math.max(
        Math.round(basePoints * 0.2),
        Math.round(basePoints / Math.sqrt(position))
    );
}

export function parseBingoConfig(raw: unknown): BingoConfig {
    const config = (raw ?? {}) as Partial<BingoConfig>;
    const gridSize = Math.min(
        MAX_GRID,
        Math.max(MIN_GRID, Number(config.gridSize) || DEFAULT_GRID)
    );
    return {
        gridSize,
        freeCentre:
            config.freeCentre === undefined ? true : config.freeCentre === true,
        pattern: config.pattern === "full" ? "full" : "line",
        items: Array.isArray(config.items) ? config.items.map(String) : [],
        basePoints:
            Number(config.basePoints) || DEFAULT_BINGO_CONFIG.basePoints,
    };
}

export function validateBingoConfig(config: BingoConfig): string | null {
    const items = config.items.map((i) => i.trim()).filter(Boolean);
    if (new Set(items.map((i) => i.toLowerCase())).size !== items.length)
        return "Every item must be different.";

    const need = cellsNeeded(config);
    if (items.length < need)
        return `A ${config.gridSize}×${config.gridSize} card needs at least ${need} items — you have ${items.length}.`;

    if (config.basePoints < 0 || config.basePoints > 10_000)
        return "Points must be between 0 and 10000.";

    return null;
}
