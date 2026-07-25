import { NextResponse } from "next/server";
import { requireOracleAdmin } from "@/src/lib/auth/requireAdmin";
import { publishOracle } from "@/src/lib/oracle/bus";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
    if (!(await requireOracleAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    publishOracle([{ event: ORACLE_EVENTS.RESET, payload: {} }]);
    return NextResponse.json({ success: true });
}
