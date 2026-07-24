import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
 * Broadcast an event to the oracle Supabase Realtime channel from the server.
 * Uses the admin client (service role) so it can always publish.
 */
export async function broadcastOracleEvent(
    event: string,
    payload: Record<string, unknown>
) {
    const supabase = getAdminClient();
    const channel = supabase.channel("oracle-channel");

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

    await channel.send({ type: "broadcast", event, payload });
    await supabase.removeChannel(channel);
}
