import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { getCfmEvent } from "@/src/lib/event";
import { invalidateGameState } from "@/src/lib/games/service";
import {
    buildRoundConfig,
    isDisabled,
    validateQuestion,
    DEFAULT_DURATION_SECONDS,
    MAX_DURATION_SECONDS,
    type HostQuestion,
    type QuestionInput,
} from "@/src/lib/games/questions";
import { DEFAULT_ROUND_CONFIG } from "@/src/lib/games/types";

/**
 * Question authoring for the live session: list, create, reorder.
 * A question is a round, so the round id is the handle throughout.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The live session for the configured event, or null. */
async function liveSession(supabase: ReturnType<typeof getAdminClient>) {
    const event = await getCfmEvent(supabase);
    if (!event) return null;
    const { data } = await supabase
        .from("game_sessions")
        .select("id, title, status, current_round_id")
        .eq("event_id", event.id)
        .eq("status", "live")
        .maybeSingle();
    return data ?? null;
}

export async function GET() {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getAdminClient();
    const session = await liveSession(supabase);
    if (!session) return NextResponse.json({ session: null, questions: [] });

    const { data: rounds } = await supabase
        .from("game_rounds")
        .select(
            "id, status, order_index, config, trivia_questions(id, question, options, correct_index, points)"
        )
        .eq("session_id", session.id)
        .eq("type", "trivia")
        .order("order_index", { ascending: true });

    const roundIds = (rounds ?? []).map((r) => r.id);

    // Counted in JS rather than a grouped query — the round list is tens of
    // rows, and it keeps this to a single round trip.
    const answerCounts = new Map<string, number>();
    if (roundIds.length > 0) {
        const { data: answers } = await supabase
            .from("trivia_answers")
            .select("round_id")
            .in("round_id", roundIds);
        for (const a of answers ?? [])
            answerCounts.set(a.round_id, (answerCounts.get(a.round_id) ?? 0) + 1);
    }

    const questions: HostQuestion[] = (rounds ?? []).map((r) => {
        const q = (r.trivia_questions as unknown[] | null)?.[0] as
            | {
                  id: string;
                  question: string;
                  options: string[];
                  correct_index: number;
                  points: number;
              }
            | undefined;
        const config = (r.config ?? {}) as Record<string, unknown>;
        return {
            roundId: r.id,
            orderIndex: r.order_index,
            status: r.status,
            disabled: isDisabled(config),
            question: q?.question ?? "",
            options: q?.options ?? [],
            correctIndex: q?.correct_index ?? 0,
            points: Number(config.basePoints) || q?.points || DEFAULT_ROUND_CONFIG.basePoints,
            durationSeconds: Math.min(
                Number(config.durationSeconds) || DEFAULT_DURATION_SECONDS,
                MAX_DURATION_SECONDS
            ),
            answerCount: answerCounts.get(r.id) ?? 0,
        };
    });

    return NextResponse.json({ session, questions });
}

export async function POST(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const input = (await request.json()) as QuestionInput;
    const invalid = validateQuestion(input);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const supabase = getAdminClient();
    const session = await liveSession(supabase);
    if (!session)
        return NextResponse.json(
            { error: "No live session — create one first." },
            { status: 409 }
        );

    // Append to the end of the run of show.
    const { data: last } = await supabase
        .from("game_rounds")
        .select("order_index")
        .eq("session_id", session.id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

    const orderIndex = (last?.order_index ?? -1) + 1;

    const { data: round, error: roundError } = await supabase
        .from("game_rounds")
        .insert({
            session_id: session.id,
            type: "trivia",
            status: "pending",
            order_index: orderIndex,
            config: buildRoundConfig(input),
        })
        .select("id")
        .single();

    if (roundError || !round)
        return NextResponse.json(
            { error: "Couldn't create the question." },
            { status: 500 }
        );

    const { error: questionError } = await supabase
        .from("trivia_questions")
        .insert({
            round_id: round.id,
            question: input.question.trim(),
            options: input.options.map((o) => String(o).trim()),
            correct_index: input.correctIndex,
            points: input.points ?? DEFAULT_ROUND_CONFIG.basePoints,
            order_index: 0,
        });

    if (questionError) {
        // Don't leave a round with no question behind — it would show as an
        // empty slot in the run of show and could be started by mistake.
        await supabase.from("game_rounds").delete().eq("id", round.id);
        return NextResponse.json(
            { error: "Couldn't save the question." },
            { status: 500 }
        );
    }

    // First question in an empty session becomes the one on deck.
    if (!session.current_round_id) {
        await supabase
            .from("game_sessions")
            .update({ current_round_id: round.id })
            .eq("id", session.id);
    }

    invalidateGameState();
    return NextResponse.json({ success: true, roundId: round.id });
}

/** Reorder the run of show: body is the full list of round ids, in order. */
export async function PATCH(request: NextRequest) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { order } = (await request.json()) as { order: string[] };
    if (!Array.isArray(order) || order.length === 0)
        return NextResponse.json({ error: "Nothing to reorder." }, { status: 400 });

    const supabase = getAdminClient();
    const session = await liveSession(supabase);
    if (!session)
        return NextResponse.json({ error: "No live session." }, { status: 409 });

    // Scoped to this session so a stray id can't reshuffle another event's rounds.
    await Promise.all(
        order.map((roundId, index) =>
            supabase
                .from("game_rounds")
                .update({ order_index: index })
                .eq("id", roundId)
                .eq("session_id", session.id)
        )
    );

    invalidateGameState();
    return NextResponse.json({ success: true });
}
