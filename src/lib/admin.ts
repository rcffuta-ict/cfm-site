import type { SupabaseClient } from "@supabase/supabase-js";

/** Position slug whose holder is treated as the app admin. */
export const ADMIN_POSITION_SLUG = "ict-coord";

/**
 * The admin is the leader holding the leadership position with slug
 * `ict-coord` in the active tenure.
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
        .eq("position.slug", ADMIN_POSITION_SLUG)
        .maybeSingle();

    return !!data;
}
