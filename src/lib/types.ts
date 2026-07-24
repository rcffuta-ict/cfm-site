/**
 * Local profile model — previously provided by @rcffuta/ict-lib.
 * The app now reads the Supabase database directly, so we own this shape.
 * Keep it in sync with `getFullProfile` in `src/lib/profile.ts`.
 */

export interface ProfileUnit {
    id: string;
    name: string;
    role: string;
}

export interface ProfileRole {
    title: string;
    scope: string;
    contextName?: string;
}

export interface FullUserProfile {
    profile: {
        id: string;
        firstName: string;
        lastName: string;
        middleName?: string | null;
        email: string;
        phoneNumber?: string | null;
        gender?: string | null;
        dob?: string | null;
        avatarUrl?: string | null;
    };
    location: {
        schoolAddress?: string | null;
        homeAddress?: string | null;
        residentialZone?: string | null;
    };
    academics: {
        matricNumber?: string | null;
        department?: string | null;
        faculty?: string | null;
        entryYear?: number | null;
        family?: string | null;
        /** e.g. "300L", "Alumni", "N/A" */
        currentLevel: string;
    };
    roles: ProfileRole[] | null;
    unit: ProfileUnit | null;
    teams: ProfileUnit[];
}
