import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { getCfmEvent } from "@/src/lib/event";
import { invalidateGameState } from "@/src/lib/games/service";
import { DEFAULT_ROUND_CONFIG } from "@/src/lib/games/types";

/**
 * Session setup: create the live session and load its trivia questions.
 *
 * A round holds exactly one question, so the host walks Start → Lock → Reveal
 * → Next once per question and the controls map onto what the hall sees.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QuestionInput {
    question: string;
    options: string[];
    correctIndex: number;
    points?: number;
    durationSeconds?: number;
}

export async function GET() {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getAdminClient();
    const event = await getCfmEvent(supabase);
    if (!event)
        return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const { data: session } = await supabase
        .from("game_sessions")
        .select("id, title, status, current_round_id")
        .eq("event_id", event.id)
        .eq("status", "live")
        .maybeSingle();

    if (!session) return NextResponse.json({ session: null, rounds: [] });

    const { data: rounds } = await supabase
        .from("game_rounds")
        .select("id, type, status, order_index, trivia_questions(question)")
        .eq("session_id", session.id)
        .order("order_index", { ascending: true });

    return NextResponse.json({
        session,
        rounds: (rounds ?? []).map((r) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            orderIndex: r.order_index,
            question:
                (r.trivia_questions as { question?: string }[] | null)?.[0]
                    ?.question ?? null,
        })),
    });
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, questions } = (await request.json()) as {
        title?: string;
        questions?: QuestionInput[];
    };

    // An empty session is legitimate — the console creates one, then the admin
    // adds questions one at a time. Bulk seeding stays supported for scripting.
    const seed = Array.isArray(questions) ? questions : [];

    for (const [i, q] of seed.entries()) {
        if (!q.question?.trim())
            return NextResponse.json(
                { error: `Question ${i + 1} has no text.` },
                { status: 400 }
            );
        if (!Array.isArray(q.options) || q.options.length < 2)
            return NextResponse.json(
                { error: `Question ${i + 1} needs at least two options.` },
                { status: 400 }
            );
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length)
            return NextResponse.json(
                { error: `Question ${i + 1} has no valid correct answer.` },
                { status: 400 }
            );
    }

    const supabase = getAdminClient();
    const event = await getCfmEvent(supabase);
    if (!event)
        return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // End any previous live session — the partial unique index allows only one.
    await supabase
        .from("game_sessions")
        .update({ status: "ended", current_round_id: null })
        .eq("event_id", event.id)
        .eq("status", "live");

    const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .insert({
            event_id: event.id,
            title: title?.trim() || "CFM Trivia",
            status: "live",
        })
        .select("id, title, status")
        .single();

    if (sessionError || !session)
        return NextResponse.json(
            { error: "Couldn't create the session." },
            { status: 500 }
        );

    if (seed.length === 0) {
        invalidateGameState();
        return NextResponse.json({ success: true, session, roundCount: 0 });
    }

    const { data: rounds, error: roundsError } = await supabase
        .from("game_rounds")
        .insert(
            seed.map((q, index) => ({
                session_id: session.id,
                type: "trivia",
                status: "pending",
                order_index: index,
                config: {
                    ...DEFAULT_ROUND_CONFIG,
                    durationSeconds:
                        q.durationSeconds ?? DEFAULT_ROUND_CONFIG.durationSeconds,
                    basePoints: q.points ?? DEFAULT_ROUND_CONFIG.basePoints,
                },
            }))
        )
        .select("id, order_index");

    if (roundsError || !rounds)
        return NextResponse.json(
            { error: "Couldn't create the rounds." },
            { status: 500 }
        );

    const roundByOrder = new Map(rounds.map((r) => [r.order_index, r.id]));

    const { error: questionsError } = await supabase
        .from("trivia_questions")
        .insert(
            seed.map((q, index) => ({
                round_id: roundByOrder.get(index),
                question: q.question.trim(),
                options: q.options,
                correct_index: q.correctIndex,
                points: q.points ?? DEFAULT_ROUND_CONFIG.basePoints,
                order_index: 0,
            }))
        );

    if (questionsError)
        return NextResponse.json(
            { error: "Couldn't save the questions." },
            { status: 500 }
        );

    // Point at the first round, but leave it pending — nothing goes live until
    // the host presses Start.
    await supabase
        .from("game_sessions")
        .update({ current_round_id: roundByOrder.get(0) ?? null })
        .eq("id", session.id);

    invalidateGameState();

    return NextResponse.json({
        success: true,
        session,
        roundCount: rounds.length,
    });
}
