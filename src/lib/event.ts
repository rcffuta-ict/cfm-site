import type { SupabaseClient } from "@supabase/supabase-js";

/** The event slug that this deployment is bound to. */
export const CFM_EVENT_SLUG = process.env.CFM_EVENT_SLUG || "cfm-rcffuta";

export interface CfmEvent {
    id: string;
    title: string | null;
    date: string | null;
    is_active: boolean | null;
}

/**
 * The single event this app is configured for (by `CFM_EVENT_SLUG`).
 * Its `is_active` flag is the app's live / not-live switch — flip it in the
 * `events` table to turn the app on or off.
 */
export async function getCfmEvent(
    supabase: SupabaseClient
): Promise<CfmEvent | null> {
    const { data } = await supabase
        .from("events")
        .select("id, title, date, is_active")
        .eq("slug", CFM_EVENT_SLUG)
        .maybeSingle();
    return (data as CfmEvent) ?? null;
}

/** Whether the configured event is currently live. */
export async function isEventLive(supabase: SupabaseClient): Promise<boolean> {
    const event = await getCfmEvent(supabase);
    return !!event?.is_active;
}
