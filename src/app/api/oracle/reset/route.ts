import { NextResponse } from "next/server";
import { broadcastOracleEvent } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";

export async function POST() {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await broadcastOracleEvent(ORACLE_EVENTS.RESET);
    return NextResponse.json({ success: true });
}
