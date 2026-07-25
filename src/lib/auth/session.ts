import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Lightweight, self-contained session for CFM.
 *
 * We no longer use Supabase Auth. After a member proves who they are
 * (email/phone that matches a profile) and which level they belong to
 * (a valid level invite token), we issue a signed, httpOnly cookie that
 * holds just enough to rehydrate the dashboard on later visits. The cookie
 * is HMAC-signed with the service-role key so it cannot be forged client-side.
 */

const COOKIE_NAME = "cfm-session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
    /** profiles.id */
    pid: string;
    email: string;
    /** token-authenticated level, e.g. "300L" */
    level: string;
    /** issued-at (unix seconds) */
    iat: number;
}

/**
 * The Oracle laptop runs a production build but serves it over plain HTTP on
 * the venue LAN (`http://192.168.x.x:3000`). Browsers silently discard a
 * `secure` cookie on a non-HTTPS origin, so the admin could never log in there
 * — the session would appear to succeed and then vanish. `ORACLE_LOCAL=1` opts
 * that one instance out. It must never be set on the public cloud build.
 */
function useSecureCookie(): boolean {
    if (process.env.ORACLE_LOCAL === "1") return false;
    return process.env.NODE_ENV === "production";
}

function secret(): string {
    return (
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        "cfm-dev-secret"
    );
}

function sign(data: string): string {
    return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

function encode(payload: SessionPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${sign(body)}`;
}

function decode(token: string): SessionPayload | null {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;

    const expected = sign(body);
    const given = Buffer.from(sig);
    const want = Buffer.from(expected);
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(body, "base64url").toString()
        ) as SessionPayload;
        if (
            !payload.iat ||
            Date.now() / 1000 - payload.iat > MAX_AGE_SECONDS
        ) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

export async function setSessionCookie(
    payload: Omit<SessionPayload, "iat">
): Promise<void> {
    const cookieStore = await cookies();
    const value = encode({ ...payload, iat: Math.floor(Date.now() / 1000) });
    cookieStore.set(COOKIE_NAME, value, {
        path: "/",
        httpOnly: true,
        secure: useSecureCookie(),
        sameSite: "lax",
        maxAge: MAX_AGE_SECONDS,
    });
}

export async function getSessionCookie(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return null;
    return decode(raw);
}

export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}
