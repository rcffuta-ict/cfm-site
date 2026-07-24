import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/src/lib/auth/session";

// POST /api/auth/logout — called by the client logout button
export async function POST() {
    return clearAndRedirect();
}

// GET /api/auth/logout — used by server components to clear bad/expired sessions
export async function GET() {
    return clearAndRedirect();
}

async function clearAndRedirect() {
    await clearSessionCookie();

    return NextResponse.redirect(
        new URL(
            "/login",
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        )
    );
}
