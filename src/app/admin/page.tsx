import { redirect } from "next/navigation";
import { getSessionCookie } from "@/src/lib/auth/session";
import { getAdminClient } from "@/src/lib/supabase/server";
import { isAdmin } from "@/src/lib/admin";
import { getCfmEvent, getDisabledLevels } from "@/src/lib/event";
import AdminConsole from "@/src/components/AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
    const session = await getSessionCookie();
    if (!session?.pid) {
        // Route handler clears the cookie (can't set cookies from a page).
        redirect("/api/auth/logout");
    }

    const supabase = getAdminClient();
    if (!(await isAdmin(supabase, session.pid))) {
        redirect("/");
    }

    const event = await getCfmEvent(supabase);
    let totalRegistered = 0;
    if (event) {
        const { count } = await supabase
            .from("event_registrations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", event.id);
        totalRegistered = count ?? 0;
    }

    return (
        <AdminConsole
            initialOverview={{
                disabledLevels: getDisabledLevels(event),
                totalRegistered,
            }}
        />
    );
}
