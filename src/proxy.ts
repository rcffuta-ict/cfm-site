import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
    // Presence check only — the signed cookie is fully verified server-side
    // (getSessionAction). We can't import the crypto verifier into edge
    // middleware, so we just gate on the cookie existing.
    const token = request.cookies.get("cfm-session")?.value;
    const { pathname } = request.nextUrl;

    // ── Always-public pages ──────────────────────────────────────────────────
    if (
        pathname.startsWith("/oracle") ||
        pathname.startsWith("/stats") ||
        pathname.startsWith("/api/stats") ||
        pathname.startsWith("/api/auth/")
    ) {
        return NextResponse.next();
    }

    const isProtected = pathname === "/" || pathname.startsWith("/api/oracle");

    // Unauthenticated user hitting a protected route → send to login.
    // NOTE: We deliberately do NOT redirect authenticated users away from
    // /login here because the proxy cannot verify token validity. A stale/
    // expired cookie would otherwise cause an infinite loop (/ ↔ /login).
    // The login page handles the "already signed in" case client-side.
    if (!token && isProtected) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|images|fonts).*)"],
};
