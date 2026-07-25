import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { requireAdmin } from "@/src/lib/auth/requireAdmin";
import { invalidateGameState } from "@/src/lib/games/service";
import {
    buildRoundConfig,
    isDisabled,
    validateQuestion,
    type QuestionInput,
} from "@/src/lib/games/questions";

/**
 * Edit, enable/disable, or delete one question.
 *
 * The guard rails here exist because a trivia round is scored: once people have
 * answered, changing the wording or the correct option would silently
 * invalidate points already awarded. So content edits are refused after the
 * first answer lands, while disabling and deleting stay available (deleting is
 * confirmed in the UI, since it takes those points with it).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ roundId: string }> };

async function loadRound(
    supabase: ReturnType<typeof getAdminClient>,
    roundId: string
) {
    const { data: round } = await supabase
        .from("game_rounds")
        .select("id, session_id, status, order_index, config")
        .eq("id", roundId)
        .maybeSingle();
    if (!round) return null;

    const { count } = await supabase
        .from("trivia_answers")
        .select("id", { count: "exact", head: true })
        .eq("round_id", roundId);

    return { round, answerCount: count ?? 0 };
}

export async function PATCH(request: NextRequest, { params }: Params) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { roundId } = await params;
    const supabase = getAdminClient();

    const loaded = await loadRound(supabase, roundId);
    if (!loaded)
        return NextResponse.json({ error: "Unknown question" }, { status: 404 });
    const { round, answerCount } = loaded;

    const body = (await request.json()) as Partial<QuestionInput> & {
        disabled?: boolean;
    };

    // ── Enable / disable: always allowed, never touches scoring ─────────
    if (typeof body.disabled === "boolean" && Object.keys(body).length === 1) {
        if (round.status === "active")
            return NextResponse.json(
                { error: "Can't disable the question that's on screen." },
                { status: 409 }
            );

        await supabase
            .from("game_rounds")
            .update({
                config: { ...(round.config ?? {}), disabled: body.disabled },
            })
            .eq("id", roundId);

        invalidateGameState();
        return NextResponse.json({ success: true });
    }

    // ── Content edit ────────────────────────────────────────────────────
    if (answerCount > 0)
        return NextResponse.json(
            {
                error: `${answerCount} ${answerCount === 1 ? "person has" : "people have"} already answered this — editing it would invalidate their points. Disable it instead, or delete it.`,
            },
            { status: 409 }
        );

    if (round.status === "active")
        return NextResponse.json(
            { error: "Can't edit the question that's on screen." },
            { status: 409 }
        );

    const input: QuestionInput = {
        question: body.question ?? "",
        options: body.options ?? [],
        correctIndex: body.correctIndex ?? -1,
        points: body.points,
        durationSeconds: body.durationSeconds,
    };

    const invalid = validateQuestion(input);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    await supabase
        .from("game_rounds")
        .update({
            config: buildRoundConfig(input, isDisabled(round.config)),
        })
        .eq("id", roundId);

    const { error } = await supabase
        .from("trivia_questions")
        .update({
            question: input.question.trim(),
            options: input.options.map((o) => String(o).trim()),
            correct_index: input.correctIndex,
            points: input.points,
        })
        .eq("round_id", roundId);

    if (error)
        return NextResponse.json({ error: "Couldn't save." }, { status: 500 });

    invalidateGameState();
    return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
    if (!(await requireAdmin()))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { roundId } = await params;
    const supabase = getAdminClient();

    const loaded = await loadRound(supabase, roundId);
    if (!loaded)
        return NextResponse.json({ error: "Unknown question" }, { status: 404 });

    if (loaded.round.status === "active")
        return NextResponse.json(
            { error: "Can't delete the question that's on screen." },
            { status: 409 }
        );

    // If this round is the one on deck, move the pointer off it first — the
    // foreign key would null it anyway, but doing it explicitly means the
    // session lands on the next question rather than on nothing.
    const { data: session } = await supabase
        .from("game_sessions")
        .select("id, current_round_id")
        .eq("id", loaded.round.session_id)
        .maybeSingle();

    if (session?.current_round_id === roundId) {
        const { data: nextRound } = await supabase
            .from("game_rounds")
            .select("id")
            .eq("session_id", session.id)
            .neq("id", roundId)
            .gte("order_index", loaded.round.order_index)
            .order("order_index", { ascending: true })
            .limit(1)
            .maybeSingle();

        await supabase
            .from("game_sessions")
            .update({ current_round_id: nextRound?.id ?? null })
            .eq("id", session.id);
    }

    // Cascades to trivia_questions and trivia_answers.
    const { error } = await supabase.from("game_rounds").delete().eq("id", roundId);
    if (error)
        return NextResponse.json({ error: "Couldn't delete." }, { status: 500 });

    invalidateGameState();
    return NextResponse.json({ success: true, deletedAnswers: loaded.answerCount });
}
