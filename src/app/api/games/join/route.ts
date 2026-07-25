import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getSessionCookie } from "@/src/lib/auth/session";
import { getCfmEvent } from "@/src/lib/event";
import { loadGameState } from "@/src/lib/games/service";

/**
 * Joining the game with your Oracle ID.
 *
 * The code is a deliberate entry ritual, not a security boundary — the member
 * is already signed in, and every answer is attributed to the session cookie
 * regardless of what's typed here. What it does do is confirm the person
 * holding the phone knows their own number, and give joining a moment of
 * ceremony that matches the Oracle draw.
 *
 * Membership is recorded in `game_participants` rather than the browser, so
 * joining survives a refresh, a dead battery, or a switch to another phone.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in member's raffle id for the configured event, if they have one. */
async function ownRaffleId(
    supabase: ReturnType<typeof getAdminClient>,
    email: string
): Promise<number | null> {
    const event = await getCfmEvent(supabase);
    if (!event) return null;
    const { data } = await supabase
        .from("event_registrations")
        .select("raffle_id")
        .eq("event_id", event.id)
        .eq("email", email)
        .maybeSingle();
    return data?.raffle_id ?? null;
}

export async function GET() {
    const session = await getSessionCookie();
    if (!session?.pid)
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.session)
        return NextResponse.json({ joined: false, hasSession: false });

    const { data: participant } = await supabase
        .from("game_participants")
        .select("id")
        .eq("session_id", state.session.id)
        .eq("profile_id", session.pid)
        .maybeSingle();

    return NextResponse.json({
        joined: !!participant,
        hasSession: true,
        sessionTitle: state.session.title,
    });
}

export async function POST(request: NextRequest) {
    const session = await getSessionCookie();
    if (!session?.pid)
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { code } = await request.json();
    const entered = String(code ?? "").replace(/\D/g, "");
    if (!entered)
        return NextResponse.json(
            { error: "Enter your Oracle ID." },
            { status: 400 }
        );

    const supabase = getAdminClient();

    const raffleId = await ownRaffleId(supabase, session.email);
    if (raffleId === null)
        return NextResponse.json(
            { error: "You don't have an Oracle ID yet — register for the event first." },
            { status: 409 }
        );

    if (Number(entered) !== raffleId)
        return NextResponse.json(
            { error: "That's not your Oracle ID. Check your dashboard." },
            { status: 403 }
        );

    const state = await loadGameState(supabase);
    if (!state.session)
        return NextResponse.json(
            { error: "The game hasn't started yet. Hang tight." },
            { status: 409 }
        );

    const { error } = await supabase.from("game_participants").upsert(
        { session_id: state.session.id, profile_id: session.pid },
        { onConflict: "session_id,profile_id", ignoreDuplicates: true }
    );

    if (error)
        return NextResponse.json({ error: "Couldn't join — try again." }, { status: 500 });

    return NextResponse.json({ success: true, joined: true, raffleId });
}
