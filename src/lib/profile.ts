import type { SupabaseClient } from "@supabase/supabase-js";
import type { FullUserProfile, ProfileUnit } from "@/src/lib/types";

/**
 * Build a full profile straight from the database.
 *
 * Replaces the old ict-lib `member.getFullProfile`. Level is derived from the
 * member's class set relative to the active tenure's session
 * (`(sessionYear - entryYear + 1) * 100`, capped at "Alumni"), with a class-set
 * `level_override` taking precedence. Unit / teams come from the active tenure's
 * unit memberships.
 */
export async function getFullProfile(
    supabase: SupabaseClient,
    profileId: string
): Promise<FullUserProfile | null> {
    const { data: raw, error } = await supabase
        .from("profiles")
        .select(
            `
            *,
            class_sets ( entry_year, family_name, level_override ),
            residential_zones ( name )
        `
        )
        .eq("id", profileId)
        .maybeSingle();

    if (error) throw error;
    if (!raw) return null;

    const { data: activeTenure } = await supabase
        .from("tenures")
        .select("id, session")
        .eq("is_active", true)
        .maybeSingle();

    let unit: ProfileUnit | null = null;
    const teams: ProfileUnit[] = [];
    let currentLevel = "N/A";

    if (activeTenure) {
        const { data: memberships } = await supabase
            .from("membership_units")
            .select("role, units ( id, name, type )")
            .eq("profile_id", profileId)
            .eq("tenure_id", activeTenure.id);

        for (const m of memberships ?? []) {
            const u = (m as any).units;
            if (!u) continue;
            const item: ProfileUnit = {
                id: u.id,
                name: u.name,
                role: (m as any).role || "Member",
            };
            if (u.type === "UNIT") unit = item;
            else teams.push(item);
        }

        currentLevel = resolveLevel(raw.class_sets, activeTenure.session);
    }

    return {
        profile: {
            id: raw.id,
            firstName: raw.first_name,
            lastName: raw.last_name,
            middleName: raw.middle_name,
            email: raw.email || "",
            phoneNumber: raw.phone_number,
            gender: raw.gender,
            dob: raw.dob,
            avatarUrl: raw.avatar_url,
        },
        location: {
            schoolAddress: raw.school_address,
            homeAddress: raw.home_address,
            residentialZone: raw.residential_zones?.name,
        },
        academics: {
            matricNumber: raw.matric_number,
            department: raw.department,
            faculty: raw.faculty,
            entryYear: raw.class_sets?.entry_year,
            family: raw.class_sets?.family_name,
            currentLevel,
        },
        roles: null,
        unit,
        teams,
    };
}

function resolveLevel(
    classSet: { entry_year?: number | null; level_override?: string | null } | null,
    session: string | null
): string {
    if (!classSet) return "N/A";
    if (classSet.level_override) return classSet.level_override;
    if (!classSet.entry_year || !session) return "N/A";

    const sessionYear = parseInt(String(session).split("/")[0], 10);
    if (Number.isNaN(sessionYear)) return "N/A";

    const levelCalc = (sessionYear - classSet.entry_year + 1) * 100;
    if (levelCalc >= 600) return "Alumni";
    if (levelCalc < 100) return "N/A";
    return `${levelCalc}L`;
}
