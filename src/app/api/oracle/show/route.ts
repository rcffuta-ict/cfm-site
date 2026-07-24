import { NextRequest, NextResponse } from "next/server";
import { broadcastOracleEvent } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { person } = await request.json();
    await broadcastOracleEvent(ORACLE_EVENTS.REVEAL, person);
    return NextResponse.json({ success: true });
}
