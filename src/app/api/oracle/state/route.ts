import { NextResponse } from "next/server";
import { requireOracleAdmin } from "@/src/lib/auth/requireAdmin";
import { getSnapshot, getWaitingRoom } from "@/src/lib/oracle/store";

/**
 * Local Oracle state for the console: how fresh the member snapshot is, and
 * what's currently sitting in the waiting room. Reads memory only, so the
 * console stays responsive even with no uplink.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    if (!(await requireOracleAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [snapshot, waiting] = await Promise.all([
        getSnapshot(),
        getWaitingRoom(),
    ]);

    return NextResponse.json({
        members: { count: snapshot.members.length, syncedAt: snapshot.syncedAt },
        waiting: { slots: waiting.slots, queue: waiting.queue },
    });
}
