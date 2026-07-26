"use server";

import { getAdminClient } from "@/src/lib/supabase/server";
import { getFullProfile } from "@/src/lib/profile";
import { isAdmin } from "@/src/lib/admin";
import { getSessionCookie } from "@/src/lib/auth/session";
import type { SessionData } from "@/src/lib/stores/profile.store";
import { reportError } from "@/src/lib/errors";

export async function getSessionAction(): Promise<{
    success: boolean;
    data?: Omit<SessionData, "lastRefresh">;
    error?: string;
}> {
    try {
        const payload = await getSessionCookie();
        if (!payload) return { success: false, error: "No valid session." };

        const supabase = getAdminClient();
        const fullProfile = await getFullProfile(supabase, payload.pid);
        if (!fullProfile) return { success: false, error: "Profile not found." };

        // The level was authenticated by the invite token at login; keep it.
        const profile = {
            ...fullProfile,
            academics: { ...fullProfile.academics, currentLevel: payload.level },
        };
        const eventSlug = process.env.CFM_EVENT_SLUG || "cfm";
        const { data: event } = await supabase
            .from("events")
            .select("id, title, date")
            .eq("slug", eventSlug)
            .maybeSingle();

        let raffleId: number | null = null;
        if (event) {
            const { data: reg } = await supabase
                .from("event_registrations")
                .select("raffle_id")
                .eq("event_id", event.id)
                .eq("email", payload.email)
                .maybeSingle();
            raffleId = reg?.raffle_id ?? null;
        }

        const admin = await isAdmin(supabase, payload.pid);

        return {
            success: true,
            data: {
                profile,
                raffleId,
                eventTitle: event?.title ?? "Combined Family Meeting",
                eventDate: event?.date ?? "",
                isAdmin: admin,
            },
        };
    } catch (err: unknown) {
        console.error("[getSessionAction]", err);
        return {
            success: false,
            error: reportError("getSessionAction", err, "Couldn't restore your session."),
        };
    }
}
