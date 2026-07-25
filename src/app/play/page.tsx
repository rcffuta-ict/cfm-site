import { redirect } from "next/navigation";
import { getSessionCookie } from "@/src/lib/auth/session";
import PlayScreen from "@/src/components/PlayScreen";

/**
 * The game lives on its own page rather than inside the dashboard: during a
 * round this is the only thing a member should be looking at, and a full screen
 * of nothing but the question is far easier to use in a dark, loud hall.
 */
export const dynamic = "force-dynamic";

export default async function PlayPage() {
    const session = await getSessionCookie();
    if (!session?.pid) redirect("/login");

    return <PlayScreen />;
}
