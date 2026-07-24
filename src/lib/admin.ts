import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The leadership position slug whose holder is the app admin, from the `ADMIN`
 * env var (defaults to "ict-coord"). Change it in env and the holder of that
 * position (in the active tenure) becomes admin — everything else is resolved
 * at runtime.
 */
export function getAdminPositionSlug(): string {
    return (process.env.ADMIN || "ict-coord").trim().toLowerCase();
}

/**
 * A profile is admin if it holds the configured admin leadership position
 * (slug = `ADMIN`) in the active tenure.
 */
export async function isAdmin(
    supabase: SupabaseClient,
    profileId: string
): Promise<boolean> {
    if (!profileId) return false;

    const { data: tenure } = await supabase
        .from("tenures")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();
    if (!tenure) return false;

    const { data } = await supabase
        .from("leadership")
        .select("id, position:leadership_positions!inner(slug)")
        .eq("profile_id", profileId)
        .eq("tenure_id", tenure.id)
        .eq("position.slug", getAdminPositionSlug())
        .maybeSingle();

    return !!data;
}
