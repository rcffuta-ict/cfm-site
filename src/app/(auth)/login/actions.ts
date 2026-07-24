"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { getAdminClient, broadcastOracleEvent } from "@/src/lib/supabase/server";
import { resolveLevelFromClassSet } from "@/src/lib/level";
import { setSessionCookie } from "@/src/lib/auth/session";

const RAFFLE_BASE = parseInt(process.env.RAFFLE_ID_BASE || "42700", 10);

async function generateRaffleId(eventId: string): Promise<number> {
    const supabase = getAdminClient();
    const { data: existing } = await supabase
        .from("event_registrations")
        .select("raffle_id")
        .eq("event_id", eventId)
        .not("raffle_id", "is", null);

    const taken = new Set((existing || []).map((r: any) => r.raffle_id as number));
    let base = RAFFLE_BASE;

    for (let attempt = 0; attempt < 500; attempt++) {
        const jitter = Math.floor(Math.random() * 100);
        const id = base + jitter;
        if (!taken.has(id)) return id;
        const bandCount = [...taken].filter(
            (x) => Math.floor(x / 100) === Math.floor(base / 100)
        ).length;
        if (bandCount >= 80) base += 100;
    }
    throw new Error("Could not generate unique raffle ID");
}

/** Look up a profile by email (contains "@") or by phone number. */
async function findProfileByIdentifier(
    supabase: SupabaseClient,
    identifier: string
): Promise<{ id: string; email: string | null } | null> {
    if (identifier.includes("@")) {
        const { data } = await supabase
            .from("profiles")
            .select("id, email")
            .ilike("email", identifier)
            .maybeSingle();
        return data ?? null;
    }

    const cleaned = identifier.replace(/\D/g, "").slice(-10);
    if (!cleaned) return null;
    const { data } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("phone_number", `%${cleaned}`)
        .maybeSingle();
    return data ?? null;
}

type LevelInvite = {
    id: string;
    class_set_id: string;
    use_count: number;
    max_uses: number | null;
};

/** Validate a level invite token; returns the invite or an error message. */
async function validateLevelToken(
    supabase: SupabaseClient,
    token: string
): Promise<{ invite?: LevelInvite; error?: string }> {
    const { data: invite } = await supabase
        .from("registration_invites")
        .select(
            "id, class_set_id, purpose, is_active, revoked_at, expires_at, use_count, max_uses"
        )
        .eq("token", token)
        .maybeSingle();

    if (!invite) return { error: "Invalid level token. Check with your level rep." };
    if (invite.purpose !== "level")
        return { error: "This token is not a level token." };
    if (!invite.is_active || invite.revoked_at)
        return { error: "This level token is no longer active." };
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
        return { error: "This level token has expired." };
    if (invite.max_uses != null && invite.use_count >= invite.max_uses)
        return { error: "This level token has reached its usage limit." };
    if (!invite.class_set_id)
        return { error: "This token is not linked to a level. Contact your level rep." };

    return {
        invite: {
            id: invite.id,
            class_set_id: invite.class_set_id,
            use_count: invite.use_count,
            max_uses: invite.max_uses,
        },
    };
}

export async function loginAction(formData: FormData) {
    const identifier = (formData.get("identifier") as string)?.trim();
    const token = (formData.get("token") as string)?.trim();

    if (!identifier || !token)
        return { success: false, error: "Please enter your email/phone and level token." };

    try {
        const supabase = getAdminClient();

        // Step 1: Identify the member by email/phone.
        const match = await findProfileByIdentifier(supabase, identifier);
        if (!match)
            return {
                success: false,
                error: "No member found with that email or phone number.",
            };

        // Step 2: Validate the level invite token.
        const { invite, error: tokenError } = await validateLevelToken(supabase, token);
        if (!invite) return { success: false, error: tokenError };

        // Step 3: Resolve the level the token authenticates.
        const level = await resolveLevelFromClassSet(supabase, invite.class_set_id);
        if (level === "N/A")
            return {
                success: false,
                error: "Could not determine the level for this token. Contact ICT.",
            };

        // Step 4: Full profile via ict-lib (name, unit, etc.), with the
        // token-authenticated level taking precedence over any stored level.
        const rcf = RcfIctClient.fromEnv();
        const fullProfile = await rcf.member.getFullProfile(match.id);
        if (!fullProfile)
            return { success: false, error: "Profile not found. Contact admin." };

        const profileWithLevel = {
            ...fullProfile,
            academics: { ...fullProfile.academics, currentLevel: level },
        };
        const email = fullProfile.profile.email || match.email || "";

        // Step 5: Auto-register for the CFM event.
        const eventSlug = process.env.CFM_EVENT_SLUG || "cfm";
        const { data: event } = await supabase
            .from("events")
            .select("id, title, date")
            .eq("slug", eventSlug)
            .maybeSingle();

        if (!event)
            return { success: false, error: "Event not found. Contact admin." };

        const { data: existing } = await supabase
            .from("event_registrations")
            .select("id, raffle_id")
            .eq("event_id", event.id)
            .eq("email", email)
            .maybeSingle();

        let raffleId: number | null = existing?.raffle_id ?? null;

        if (!existing) {
            raffleId = await generateRaffleId(event.id);
            const { error: insertError } = await supabase
                .from("event_registrations")
                .insert({
                    event_id: event.id,
                    first_name: fullProfile.profile.firstName,
                    last_name: fullProfile.profile.lastName,
                    email,
                    phone_number: fullProfile.profile.phoneNumber ?? "",
                    level,
                    gender: fullProfile.profile.gender ?? "",
                    raffle_id: raffleId,
                    is_rcf_member: true,
                });
            if (insertError) {
                console.error("[loginAction] Event Registration Insert Error:", insertError);
                return {
                    success: false,
                    error: insertError.message || "Failed to save registration.",
                };
            }

            // Record the token use (best-effort — don't block login on this).
            await supabase
                .from("registration_invites")
                .update({ use_count: invite.use_count + 1 })
                .eq("id", invite.id);
            await supabase.from("invite_events").insert({
                invite_id: invite.id,
                action: "register",
                profile_id: match.id,
                actor_name: `${fullProfile.profile.firstName} ${fullProfile.profile.lastName}`.trim(),
                actor_email: email,
            });

            broadcastOracleEvent("stats:update", {}).catch(() => {});
        }

        // Step 6: Persist a lightweight signed session cookie.
        await setSessionCookie({ pid: match.id, email, level });

        return {
            success: true,
            data: {
                profile: profileWithLevel,
                raffleId,
                eventTitle: event.title ?? "Combined Family Meeting",
                eventDate: event.date ?? "",
            },
        };
    } catch (error: any) {
        console.error("[loginAction]", error);
        return {
            success: false,
            error: error?.message || "Login failed. Please try again.",
        };
    }
}
