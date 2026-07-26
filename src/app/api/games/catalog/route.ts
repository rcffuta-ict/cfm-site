import { NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getCfmEvent } from "@/src/lib/event";

/**
 * What's on the bill tonight.
 *
 * Deliberately separate from `/api/games/state`: that endpoint is polled by
 * every phone every few seconds and should stay as small as possible, whereas
 * this is read once when the dashboard opens. Public, because it lists nothing
 * a member couldn't see by walking into the room.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATALOG = [
    {
        type: "trivia",
        name: "Trivia",
        blurb: "Answer fastest, score highest.",
    },
    {
        type: "bingo",
        name: "Bingo",
        blurb: "Mark your card as items are called.",
    },
    {
        type: "buzzer",
        name: "Buzzer",
        blurb: "First finger in wins the question.",
    },
] as const;

export async function GET() {
    const supabase = getAdminClient();
    const event = await getCfmEvent(supabase);
    if (!event) return NextResponse.json({ games: [], hasSession: false });

    const { data: session } = await supabase
        .from("game_sessions")
        .select("id, title, current_round_id")
        .eq("event_id", event.id)
        .eq("status", "live")
        .maybeSingle();

    if (!session)
        return NextResponse.json({ games: [], hasSession: false });

    const { data: rounds } = await supabase
        .from("game_rounds")
        .select("id, type, status, config")
        .eq("session_id", session.id)
        .order("order_index", { ascending: true });

    const all = rounds ?? [];

    const games = CATALOG.map((game) => {
        // Disabled rounds are hidden from members entirely — from their side
        // a switched-off question simply isn't part of the evening.
        const mine = all.filter(
            (r) =>
                r.type === game.type &&
                (r.config as { disabled?: boolean } | null)?.disabled !== true
        );

        const current = mine.find((r) => r.id === session.current_round_id);
        const live = current?.status === "active" || current?.status === "locked";

        return {
            ...game,
            available: mine.length > 0,
            live,
            total: mine.length,
            done: mine.filter((r) => r.status === "ended" || r.status === "revealed")
                .length,
        };
    }).filter((g) => g.available);

    return NextResponse.json({
        games,
        hasSession: true,
        sessionTitle: session.title,
    });
}
