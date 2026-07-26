import { NextRequest, NextResponse } from "next/server";

/**
 * A deliberately tiny endpoint for measuring a phone's connection.
 *
 * No database, no auth, no work of any kind — so the round trip measures the
 * network and nothing else. If this is slow, the game will be slow, and that's
 * exactly what we want to be able to tell people.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    // Optional payload padding, so the same endpoint can measure throughput as
    // well as latency. Capped, because this is public.
    const bytes = Math.min(
        200_000,
        Math.max(0, Number(request.nextUrl.searchParams.get("bytes")) || 0)
    );

    return NextResponse.json(
        { t: Date.now(), pad: bytes > 0 ? "x".repeat(bytes) : undefined },
        {
            headers: {
                // Must never be cached, or every measurement after the first
                // would report a nonexistent zero-latency connection.
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "CDN-Cache-Control": "no-store",
            },
        }
    );
}
