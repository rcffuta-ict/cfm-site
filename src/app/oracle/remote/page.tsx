import { redirect } from "next/navigation";
import { getSessionCookie } from "@/src/lib/auth/session";
import { getAdminClient } from "@/src/lib/supabase/server";
import { isAdmin } from "@/src/lib/admin";
import OracleController from "@/src/components/OracleController";

export default async function OracleControllerPage() {
    const session = await getSessionCookie();

    if (!session?.pid) {
        // Route handler clears the cookie (can't do it from a page server component)
        redirect("/api/auth/logout");
    }

    const supabase = getAdminClient();
    if (!(await isAdmin(supabase, session.pid))) {
        redirect("/");
    }

    return <OracleController />;
}
