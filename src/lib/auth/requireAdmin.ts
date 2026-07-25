import { getSessionCookie } from "@/src/lib/auth/session";
import { getAdminClient } from "@/src/lib/supabase/server";
import { isAdmin } from "@/src/lib/admin";
import { isCachedAdmin } from "@/src/lib/oracle/store";

/**
 * Gate a server action / route handler on the confirmed admin (holder of the
 * `ADMIN` leadership position in the active tenure). Returns the admin's
 * profile id on success, or null when the caller is not the admin.
 */
export async function requireAdmin(): Promise<{ pid: string } | null> {
    const session = await getSessionCookie();
    if (!session?.pid) return null;

    const supabase = getAdminClient();
    if (!(await isAdmin(supabase, session.pid))) return null;

    return { pid: session.pid };
}

/**
 * Same gate, but safe to call on the Oracle's hot path.
 *
 * `requireAdmin` verifies the cookie and *then* asks Supabase whether the
 * profile still holds the admin position — a network round trip. On the draw
 * path that would put the internet right back in the middle of the thing we
 * moved off it, and a slow uplink would stall the roll. So we check the
 * snapshot's cached admin list first (populated by a member refresh, which is
 * authoritative and off the hot path), and only fall back to the live check
 * when there's no cache yet — e.g. before the first refresh of the night.
 */
export async function requireOracleAdmin(): Promise<{ pid: string } | null> {
    const session = await getSessionCookie();
    if (!session?.pid) return null;

    if (await isCachedAdmin(session.pid)) return { pid: session.pid };

    return requireAdmin();
}
