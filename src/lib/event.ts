import type { SupabaseClient } from "@supabase/supabase-js";

/** The event slug that this deployment is bound to. */
export const CFM_EVENT_SLUG = process.env.CFM_EVENT_SLUG || "cfm-rcffuta";

export interface CfmEvent {
    id: string;
    title: string | null;
    date: string | null;
    is_active: boolean | null;
    config: Record<string, unknown> | null;
}

/** Levels the admin has paused (digits only, e.g. ["400"]). */
export function getDisabledLevels(event: CfmEvent | null): string[] {
    const raw = (event?.config as { disabled_levels?: unknown })?.disabled_levels;
    if (!Array.isArray(raw)) return [];
    return raw.map((l) => String(l).replace(/\D/g, "")).filter(Boolean);
}

/** Whether a given level (any format) is currently paused for participation. */
export function isLevelDisabled(event: CfmEvent | null, level: string): boolean {
    const digits = String(level).replace(/\D/g, "");
    return getDisabledLevels(event).includes(digits);
}

/**
 * Persist the paused-levels list onto the event's `config` jsonb (merging, so
 * other config keys are preserved). No schema migration needed.
 */
export async function setDisabledLevels(
    supabase: SupabaseClient,
    levels: string[]
): Promise<void> {
    const event = await getCfmEvent(supabase);
    if (!event) throw new Error("Event not found");
    const normalized = [
        ...new Set(levels.map((l) => String(l).replace(/\D/g, "")).filter(Boolean)),
    ];
    const nextConfig = { ...(event.config ?? {}), disabled_levels: normalized };
    const { error } = await supabase
        .from("events")
        .update({ config: nextConfig })
        .eq("id", event.id);
    if (error) throw new Error(error.message);
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
        .select("id, title, date, is_active, config")
        .eq("slug", CFM_EVENT_SLUG)
        .maybeSingle();
    return (data as CfmEvent) ?? null;
}

/** Whether the configured event is currently live. */
export async function isEventLive(supabase: SupabaseClient): Promise<boolean> {
    const event = await getCfmEvent(supabase);
    return !!event?.is_active;
}
