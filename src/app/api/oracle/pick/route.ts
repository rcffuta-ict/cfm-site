import { NextRequest, NextResponse } from "next/server";
import { requireOracleAdmin } from "@/src/lib/auth/requireAdmin";
import { pickWinner } from "@/src/lib/oracle/pick";
import { getSnapshot, getBlockedIds, recordDraw } from "@/src/lib/oracle/store";
import { publishOracle } from "@/src/lib/oracle/bus";
import { ORACLE_EVENTS } from "@/src/lib/oracle/channel";

/**
 * Roll the Oracle.
 *
 * The whole point of this handler is that it does no network I/O: the admin's
 * phone and the TV are both on the venue LAN, the member list is already in
 * memory, and the command reaches the screen over an in-process bus. The only
 * disk touch is a small JSON write for the waiting room, which happens *after*
 * the screen has already been told.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const startedAt = Date.now();

    if (!(await requireOracleAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // `exclude` is deliberately ignored if a client still sends it — the
    // waiting room is server-owned now, so it can't be bypassed or lost on a
    // console refresh.
    const { level, gender, spinTime } = await request.json();

    const snapshot = await getSnapshot();
    if (snapshot.members.length === 0)
        return NextResponse.json(
            { error: "No members loaded — press Refresh members first." },
            { status: 409 }
        );

    const blocked = await getBlockedIds();
    const result = pickWinner(snapshot.members, {
        level: level ?? null,
        gender: gender ?? null,
        blocked,
    });

    if (!result.ok)
        return NextResponse.json({ error: result.error }, { status: result.status });

    const spinDuration = spinTime ? Number(spinTime) * 1000 : 3000;

    // Tell the screens first — this is the latency that matters. Persisting the
    // waiting room can wait the microsecond until after.
    publishOracle([
        { event: ORACLE_EVENTS.PREPARING, payload: {} },
        {
            event: ORACLE_EVENTS.SELECTION,
            payload: { raffleId: result.person.raffleId, spinDuration },
        },
    ]);

    const waiting = await recordDraw(result.person.raffleId);

    return NextResponse.json({
        success: true,
        data: result.person,
        waiting: { slots: waiting.slots, queue: waiting.queue },
        /** Set when the pool was too small to honour the full waiting room. */
        cooldownRelaxed:
            result.cooldownDepth < blocked.length
                ? { honoured: result.cooldownDepth, requested: blocked.length }
                : null,
        poolSize: result.poolSize,
        /** Server-side handling time, so the console can prove it stays fast. */
        serverMs: Date.now() - startedAt,
    });
}
