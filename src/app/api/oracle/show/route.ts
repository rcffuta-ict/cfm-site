import { NextRequest, NextResponse } from "next/server";
import { requireOracleAdmin } from "@/src/lib/auth/requireAdmin";
import { publishOracle } from "@/src/lib/oracle/bus";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    if (!(await requireOracleAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { person } = await request.json();
    publishOracle([{ event: ORACLE_EVENTS.REVEAL, payload: person }]);
    return NextResponse.json({ success: true });
}
