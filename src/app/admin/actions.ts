"use server";

import { getAdminClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import {
    getCfmEvent,
    getDisabledLevels,
    setDisabledLevels,
} from "@/src/lib/event";
import { MANAGEABLE_LEVELS } from "@/src/lib/utils";
import { reportError } from "@/src/lib/errors";

/** All levels the console can toggle participation for. */


export interface AdminOverview {
    disabledLevels: string[];
    totalRegistered: number;
}

/** Snapshot the admin console needs: paused levels + registration count. */
export async function getAdminOverviewAction(): Promise<AdminOverview | null> {
    if (!(await requireAdmin())) return null;

    const supabase = getAdminClient();
    const event = await getCfmEvent(supabase);
    if (!event) return { disabledLevels: [], totalRegistered: 0 };

    const { count } = await supabase
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);

    return {
        disabledLevels: getDisabledLevels(event),
        totalRegistered: count ?? 0,
    };
}

/**
 * Pause or resume a whole level. Paused levels can't log in / register, but
 * their members can still watch the public live stats.
 */
export async function setLevelDisabledAction(
    level: string,
    disabled: boolean
): Promise<{ success: boolean; disabledLevels?: string[]; error?: string }> {
    if (!(await requireAdmin()))
        return { success: false, error: "Unauthorized" };

    const digits = String(level).replace(/\D/g, "");
    if (!MANAGEABLE_LEVELS.includes(digits))
        return { success: false, error: "Unknown level." };

    try {
        const supabase = getAdminClient();
        const event = await getCfmEvent(supabase);
        const current = new Set(getDisabledLevels(event));
        if (disabled) current.add(digits);
        else current.delete(digits);

        const next = [...current];
        await setDisabledLevels(supabase, next);
        return { success: true, disabledLevels: next };
    } catch (err: unknown) {
        return {
            success: false,
            error: reportError("setLevelDisabledAction", err, "Couldn't update that level."),
        };
    }
}
