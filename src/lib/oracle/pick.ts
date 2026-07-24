import type { SupabaseClient } from "@supabase/supabase-js";
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
    /** Raffle ids to avoid re-picking (recent winners). */
    exclude?: number[];
}

/**
 * Pick a random eligible registrant straight from the database. No in-memory
 * sync step — any server instance can serve a pick, so it works on every
 * deployment topology.
 */
export async function pickWinner(
    supabase: SupabaseClient,
    eventId: string,
    { level, gender, exclude = [] }: PickArgs
): Promise<
    | { ok: true; person: OraclePerson }
    | { ok: false; error: string; status: number }
> {
    let query = supabase
        .from("event_registrations")
        .select("raffle_id, first_name, last_name, level, gender, email")
        .eq("event_id", eventId)
        .not("raffle_id", "is", null);

    if (gender) query = query.eq("gender", gender);

    const { data, error } = await query;
    if (error) {
        return { ok: false, error: "Failed to load registrants.", status: 500 };
    }

    let candidates = data ?? [];
    if (level) {
        const want = levelDigits(level);
        candidates = candidates.filter((r) => levelDigits(r.level) === want);
    }

    if (candidates.length === 0) {
        return {
            ok: false,
            error: "No eligible registrants for that filter.",
            status: 404,
        };
    }

    // Avoid recent repeats when we still have fresh candidates.
    const excludeSet = new Set(exclude);
    const fresh = candidates.filter((r) => !excludeSet.has(r.raffle_id));
    const pool = fresh.length > 0 ? fresh : candidates;

    const winner = pool[Math.floor(Math.random() * pool.length)];

    // Enrich only the winner with their unit name (for the reveal card).
    let unit: string | null = null;
    if (winner.email) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", winner.email)
            .maybeSingle();
        if (profile?.id) {
            const { data: membership } = await supabase
                .from("membership_units")
                .select("units(name)")
                .eq("profile_id", profile.id)
                .maybeSingle();
            unit = (membership?.units as { name?: string } | null)?.name ?? null;
        }
    }

    return {
        ok: true,
        person: {
            raffleId: winner.raffle_id,
            firstName: winner.first_name,
            lastName: winner.last_name,
            level: winner.level,
            gender: winner.gender,
            unit,
        },
    };
}
