import { redirect } from "next/navigation";
import { getSessionCookie } from "@/src/lib/auth/session";
import { getAdminClient } from "@/src/lib/supabase/server";
import { isAdmin } from "@/src/lib/admin";
import GameHost from "@/src/components/GameHost";

/**
 * Nested under /admin rather than a separate /host route so it reuses the same
 * admin gate and chrome the Oracle console already has.
 */
export const dynamic = "force-dynamic";

export default async function GameHostPage() {
    const session = await getSessionCookie();
    if (!session?.pid) {
        redirect("/api/auth/logout");
    }

    const supabase = getAdminClient();
    if (!(await isAdmin(supabase, session.pid))) {
        redirect("/");
    }

    return <GameHost />;
}
