import { NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { getCfmEvent } from "@/src/lib/event";
import { getSnapshot, saveSnapshot, type OracleMember } from "@/src/lib/oracle/store";

/**
 * Pull every eligible registrant into the local snapshot the Oracle draws from.
 *
 * This is the *only* Oracle route that talks to Supabase, and it's deliberately
 * off the hot path — the admin presses Refresh before the draws start, and from
 * then on the network can disappear entirely.
 *
 * Note it enriches everyone up front (unit + avatar), where the old code looked
 * those up for the winner only, after picking. Two extra queries per draw
 * becomes two bulk queries per refresh: less total work, and none of it during
 * the moment the hall is watching.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supabase `.in()` filters go in the URL, so batch to keep it under limits. */
const CHUNK = 100;

function chunked<T>(values: T[], size = CHUNK): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
    return out;
}

export async function POST() {
    // The authoritative check — this route is allowed to be slow.
    const admin = await requireAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getAdminClient();
    const event = await getCfmEvent(supabase);
    if (!event)
        return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const { data: registrations, error } = await supabase
        .from("event_registrations")
        .select("raffle_id, first_name, last_name, level, gender, email")
        .eq("event_id", event.id)
        .not("raffle_id", "is", null);

    if (error)
        return NextResponse.json(
            { error: "Failed to load registrants." },
            { status: 500 }
        );

    const rows = registrations ?? [];

    // ── Enrich: email → profile (avatar + id), then profile id → unit name ──
    const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))] as string[];

    const avatarByEmail = new Map<string, string | null>();
    const profileIdByEmail = new Map<string, string>();

    for (const batch of chunked(emails)) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email, avatar_url")
            .in("email", batch);
        for (const p of profiles ?? []) {
            if (!p.email) continue;
            avatarByEmail.set(p.email, p.avatar_url ?? null);
            if (p.id) profileIdByEmail.set(p.email, p.id);
        }
    }

    const unitByProfileId = new Map<string, string>();
    for (const batch of chunked([...profileIdByEmail.values()])) {
        const { data: memberships } = await supabase
            .from("membership_units")
            .select("profile_id, units(name)")
            .in("profile_id", batch);
        for (const m of memberships ?? []) {
            const name = (m.units as { name?: string } | null)?.name;
            if (m.profile_id && name) unitByProfileId.set(m.profile_id, name);
        }
    }

    const members: OracleMember[] = rows.map((r) => {
        const profileId = r.email ? profileIdByEmail.get(r.email) : undefined;
        return {
            raffleId: r.raffle_id,
            firstName: r.first_name,
            lastName: r.last_name,
            level: r.level,
            gender: r.gender,
            unit: profileId ? (unitByProfileId.get(profileId) ?? null) : null,
            avatarUrl: r.email ? (avatarByEmail.get(r.email) ?? null) : null,
        };
    });

    // Remember this admin so the draw path can authorise them without the
    // network. Additive, so a second admin device stays authorised too.
    const previous = await getSnapshot();
    const adminPids = [...new Set([...previous.adminPids, admin.pid])];

    const syncedAt = Date.now();
    await saveSnapshot({ eventId: event.id, syncedAt, members, adminPids });

    return NextResponse.json({
        success: true,
        count: members.length,
        syncedAt,
    });
}
