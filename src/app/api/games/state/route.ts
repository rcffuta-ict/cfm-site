import { NextRequest, NextResponse } from "next/server";
import { getGameState } from "@/src/lib/games/service";

/**
 * The poll endpoint every phone and the games TV hit every few seconds.
 *
 * Public on purpose: the TV isn't signed in, and nothing here is private —
 * the correct answer is withheld until the round is revealed (see
 * `loadGameState`). Reads come from a ~1s in-process cache, and unchanged
 * state answers `304` so the common case sends no body at all.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const state = await getGameState();
    const etag = `W/"${state.version}"`;

    // Most polls happen between round transitions, so most of them are this.
    if (request.headers.get("if-none-match") === etag) {
        return new NextResponse(null, {
            status: 304,
            headers: { ETag: etag, "Cache-Control": "no-store" },
        });
    }

    return NextResponse.json(state, {
        headers: { ETag: etag, "Cache-Control": "no-store" },
    });
}
