import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the academic level for a class set.
 *
 * Mirrors the level calculation in getFullProfile:
 *   level = (activeSessionYear - entryYear + 1) * 100
 * with `level_override` on the class set taking precedence (used for
 * foundation / non-standard sets).
 *
 * Returns a display string like "300L", "Alumni", or "N/A".
 */
export async function resolveLevelFromClassSet(
    supabase: SupabaseClient,
    classSetId: string
): Promise<string> {
    const { data: cs } = await supabase
        .from("class_sets")
        .select("entry_year, level_override")
        .eq("id", classSetId)
        .maybeSingle();

    if (!cs) return "N/A";
    if (cs.level_override) return cs.level_override as string;
    if (!cs.entry_year) return "N/A";

    const { data: tenure } = await supabase
        .from("tenures")
        .select("session")
        .eq("is_active", true)
        .maybeSingle();

    if (!tenure?.session) return "N/A";

    const sessionYear = parseInt(String(tenure.session).split("/")[0], 10);
    if (Number.isNaN(sessionYear)) return "N/A";

    const levelCalc = (sessionYear - (cs.entry_year as number) + 1) * 100;
    if (levelCalc >= 600) return "Alumni";
    if (levelCalc < 100) return "N/A";
    return `${levelCalc}L`;
}
