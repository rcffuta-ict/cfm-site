import { NextRequest, NextResponse } from "next/server";
import { requireOracleAdmin } from "@/src/lib/auth/requireAdmin";
import { setSlots, clearWaitingRoom, getWaitingRoom } from "@/src/lib/oracle/store";

/**
 * Waiting-room controls: how many draws a drawn id sits out, and a way to empty
 * the queue. Local file write only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    if (!(await requireOracleAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, slots } = await request.json();

    let waiting = await getWaitingRoom();
    if (action === "clear") waiting = await clearWaitingRoom();
    else if (action === "slots") waiting = await setSlots(Number(slots));
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    return NextResponse.json({ success: true, waiting });
}
