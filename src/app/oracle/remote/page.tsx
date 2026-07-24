import { redirect } from "next/navigation";
import { getSessionCookie } from "@/src/lib/auth/session";
import OracleController from "@/src/components/OracleController";

export default async function OracleControllerPage() {
    const session = await getSessionCookie();

    if (!session?.email) {
        // Route handler clears the cookie (can't do it from a page server component)
        redirect("/api/auth/logout");
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase());

    if (!adminEmails.includes(session.email.toLowerCase())) {
        redirect("/");
    }

    return <OracleController />;
}
