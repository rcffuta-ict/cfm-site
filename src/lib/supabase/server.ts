import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { STATS_CHANNEL } from "@/src/lib/stats/channel";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const noPersist = {
    auth: { persistSession: false, autoRefreshToken: false },
} as const;

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Service-role client — full access, server-only. Never expose to the browser.
 */
export const getAdminClient = (): SupabaseClient => {
    if (!url || !serviceRoleKey) {
        throw new Error(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
        );
    }
    if (!adminClient) {
        adminClient = createClient(url, serviceRoleKey, noPersist);
    }
    return adminClient;
};

/** Anon-key client (RLS-enforced), for non-privileged server reads. */
export const getClient = (): SupabaseClient => {
    if (!url || !anonKey) {
        throw new Error(
            "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables."
        );
    }
    if (!anonClient) {
        anonClient = createClient(url, anonKey, noPersist);
    }
    return anonClient;
};

/**
 * Broadcast to a Supabase Realtime channel from the server.
 *
 * Used by the parts of the app that genuinely span instances — live stats
 * (triggered by member logins) and the games control plane (which spans 500
 * phones). The Oracle deliberately does *not* use this: it moved to an
 * in-process bus (`src/lib/oracle/bus.ts`) so the draw never waits on the
 * network.
 *
 * Note this opens and tears down a channel per call. That's fine for
 * occasional, best-effort nudges where a poll loop is the real guarantee; it
 * was not fine on the draw path, where the subscribe handshake was the bulk of
 * the delay.
 */
export async function broadcastEvents(
    channelName: string,
    events: { event: string; payload?: Record<string, unknown> }[]
) {
    const supabase = getAdminClient();
    const channel = supabase.channel(channelName);

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Broadcast timeout")), 5000);
        channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                clearTimeout(timer);
                resolve();
            }
            if (status === "CHANNEL_ERROR") {
                clearTimeout(timer);
                reject(new Error("Channel error"));
            }
        });
    });

    for (const { event, payload } of events) {
        await channel.send({ type: "broadcast", event, payload: payload ?? {} });
    }
    await supabase.removeChannel(channel);
}

/** Convenience wrapper for a single stats broadcast event. */
export async function broadcastStatsEvent(
    event: string,
    payload: Record<string, unknown> = {}
) {
    return broadcastEvents(STATS_CHANNEL, [{ event, payload }]);
}
