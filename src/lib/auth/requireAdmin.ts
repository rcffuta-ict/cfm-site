import { getSessionCookie } from "@/src/lib/auth/session";
import { getAdminClient } from "@/src/lib/supabase/server";
import { isAdmin } from "@/src/lib/admin";

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
