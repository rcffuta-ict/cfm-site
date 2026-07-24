"use server";

import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getSessionCookie } from "@/src/lib/auth/session";
import type { SessionData } from "@/src/lib/stores/profile.store";

export async function getSessionAction(): Promise<{
    success: boolean;
    data?: Omit<SessionData, "lastRefresh">;
    error?: string;
}> {
    try {
        const payload = await getSessionCookie();
        if (!payload) return { success: false, error: "No valid session." };

        const rcf = RcfIctClient.fromEnv();
        const fullProfile = await rcf.member.getFullProfile(payload.pid);
        if (!fullProfile) return { success: false, error: "Profile not found." };

        // The level was authenticated by the invite token at login; keep it.
        const profile = {
            ...fullProfile,
            academics: { ...fullProfile.academics, currentLevel: payload.level },
        };

        const supabase = getAdminClient();
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

        return {
            success: true,
            data: {
                profile,
                raffleId,
                eventTitle: event?.title ?? "Combined Family Meeting",
                eventDate: event?.date ?? "",
            },
        };
    } catch (err: any) {
        console.error("[getSessionAction]", err);
        return { success: false, error: err?.message || "Failed to restore session." };
    }
}
