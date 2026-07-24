import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, broadcastOracleEvents } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { getCfmEvent } from "@/src/lib/event";
import { pickWinner } from "@/src/lib/oracle/pick";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { level, gender, spinTime, exclude } = await request.json();

    const supabase = getAdminClient();
    const event = await getCfmEvent(supabase);
    if (!event)
        return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const result = await pickWinner(supabase, event.id, {
        level: level ?? null,
        gender: gender ?? null,
        exclude: Array.isArray(exclude) ? exclude : [],
    });

    if (!result.ok)
        return NextResponse.json({ error: result.error }, { status: result.status });

    const spinDuration = spinTime ? Number(spinTime) * 1000 : 3000;

    // Clear the screen, then start the slot machine — broadcast to every device.
    await broadcastOracleEvents([
        { event: ORACLE_EVENTS.PREPARING },
        {
            event: ORACLE_EVENTS.SELECTION,
            payload: { raffleId: result.person.raffleId, spinDuration },
        },
    ]);

    return NextResponse.json({ success: true, data: result.person });
}
