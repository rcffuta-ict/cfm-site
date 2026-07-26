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
        // Games TV screen and its poll/leaderboard feeds — the TV is not signed
        // in, and the poll withholds the correct answer until the reveal.
        pathname.startsWith("/games") ||
        pathname.startsWith("/api/games/state") ||
        pathname.startsWith("/api/games/leaderboard") ||
        // The TV screen is not signed in, so its live feed has to be public —
        // same as the /oracle page it drives. Read-only, and it carries only
        // what is already projected on the wall.
        pathname.startsWith("/api/oracle/stream") ||
        pathname.startsWith("/api/auth/")
    ) {
        return NextResponse.next();
    }

    const isProtected =
        pathname === "/" ||
        pathname.startsWith("/admin") ||
        // Playing requires knowing who you are — answers are attributed to the
        // session, and the Oracle-ID gate is checked against your own number.
        pathname.startsWith("/play") ||
        pathname.startsWith("/api/games/join") ||
        pathname.startsWith("/api/games/answer") ||
        pathname.startsWith("/api/games/bingo") ||
        pathname.startsWith("/api/oracle");

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
    // `/api/games/state` is excluded outright rather than allow-listed inside
    // the handler: it's the one route hit by every phone every few seconds, and
    // middleware would only cost time to reach the same conclusion. Same for
    // the Oracle stream, which is a long-lived connection, not a page view.
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|images|fonts|api/games/state|api/oracle/stream).*)",
    ],
};
