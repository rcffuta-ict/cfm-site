import type { OracleMember } from "@/src/lib/oracle/store";
import type { OraclePerson } from "@/src/lib/oracle/channel";

/** Digits-only level, so "300L" / "300 Level" / "300" all compare equal. */
export function levelDigits(level: string | null | undefined): string {
    return String(level ?? "").replace(/\D/g, "");
}

interface PickArgs {
    /** null = any level; otherwise digits like "300". */
    level: string | null;
    /** null = any gender; otherwise "male" | "female". */
    gender: string | null;
    /** Waiting-room ids to avoid, most recent first. */
    blocked?: number[];
}

export type PickResult =
    | {
          ok: true;
          person: OraclePerson;
          /**
           * How many waiting-room entries were actually honoured. Lower than
           * `blocked.length` means the pool was too small and the cooldown had
           * to be relaxed — the console surfaces this.
           */
          cooldownDepth: number;
          poolSize: number;
      }
    | { ok: false; error: string; status: number };

/**
 * Choose a winner from the local snapshot. Deliberately synchronous and
 * pure — no database, no I/O — because this runs in the hot path between the
 * admin tapping Roll and the TV reacting.
 */
export function pickWinner(
    members: OracleMember[],
    { level, gender, blocked = [] }: PickArgs
): PickResult {
    let candidates = members;
    if (gender) candidates = candidates.filter((m) => m.gender === gender);
    if (level) {
        const want = levelDigits(level);
        candidates = candidates.filter((m) => levelDigits(m.level) === want);
    }

    if (candidates.length === 0) {
        return {
            ok: false,
            error: "No eligible registrants for that filter.",
            status: 404,
        };
    }

    /**
     * Honour as much of the waiting room as the pool can afford, dropping the
     * oldest entries first. On a thin filter — say four 500L sisters with three
     * slots — blocking everyone would empty the pool, and falling straight back
     * to the full list could re-draw whoever came up seconds ago. Relaxing one
     * entry at a time keeps the *most recent* draws excluded for as long as
     * possible, which is the part people in the hall would actually notice.
     */
    let pool = candidates;
    let cooldownDepth = 0;
    for (let depth = blocked.length; depth >= 0; depth--) {
        const block = new Set(blocked.slice(0, depth));
        const filtered = candidates.filter((m) => !block.has(m.raffleId));
        if (filtered.length > 0) {
            pool = filtered;
            cooldownDepth = depth;
            break;
        }
    }

    const winner = pool[Math.floor(Math.random() * pool.length)];

    return {
        ok: true,
        cooldownDepth,
        poolSize: pool.length,
        person: {
            raffleId: winner.raffleId,
            firstName: winner.firstName,
            lastName: winner.lastName,
            level: winner.level,
            gender: winner.gender,
            unit: winner.unit,
            avatarUrl: winner.avatarUrl,
        },
    };
}
