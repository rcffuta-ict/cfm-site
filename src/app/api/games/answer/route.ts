import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getSessionCookie } from "@/src/lib/auth/session";
import { scoreAnswer, type RoundConfig } from "@/src/lib/games/types";
import { DEFAULT_ROUND_CONFIG } from "@/src/lib/games/types";

/**
 * Submit a trivia answer.
 *
 * Everything that decides the score is resolved here, from the database: who
 * you are (the signed cookie, never the request body), whether the round is
 * still open, and whether you were right. The client is only trusted for which
 * option it tapped.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A tap at 19.9s on patchy mobile data can land at 20.4s. Rejecting that would
 * punish the network rather than the player, so we allow a small overshoot —
 * only while the host still has the round open, so it can never let an answer
 * through after the reveal.
 */
const LATE_GRACE_MS = 1500;

export async function POST(request: NextRequest) {
    const session = await getSessionCookie();
    if (!session?.pid)
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { questionId, choiceIndex } = await request.json();
    if (!questionId || typeof choiceIndex !== "number")
        return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const supabase = getAdminClient();

    const { data: question } = await supabase
        .from("trivia_questions")
        .select("id, round_id, options, correct_index, points")
        .eq("id", questionId)
        .maybeSingle();

    if (!question)
        return NextResponse.json({ error: "Unknown question" }, { status: 404 });

    const { data: round } = await supabase
        .from("game_rounds")
        .select("id, session_id, status, config, starts_at, ends_at")
        .eq("id", question.round_id)
        .maybeSingle();

    if (!round)
        return NextResponse.json({ error: "Unknown round" }, { status: 404 });

    if (round.status !== "active")
        return NextResponse.json(
            { error: "That round is closed." },
            { status: 409 }
        );

    const now = Date.now();
    const endsAt = round.ends_at ? new Date(round.ends_at).getTime() : null;
    if (endsAt && now > endsAt + LATE_GRACE_MS)
        return NextResponse.json({ error: "Time's up." }, { status: 409 });

    const options = (question.options ?? []) as string[];
    if (choiceIndex < 0 || choiceIndex >= options.length)
        return NextResponse.json({ error: "Invalid choice" }, { status: 400 });

    const config = { ...DEFAULT_ROUND_CONFIG, ...(round.config ?? {}) } as RoundConfig;
    const isCorrect = choiceIndex === question.correct_index;
    const points = isCorrect
        ? scoreAnswer(
              config,
              question.points ?? config.basePoints,
              now,
              round.starts_at ? new Date(round.starts_at).getTime() : null,
              endsAt
          )
        : 0;

    // The UNIQUE (question_id, profile_id) constraint is what makes this safe
    // under 500 concurrent submissions — first write wins, and a second tap
    // can't overwrite an earlier answer with a better-timed one.
    const { error } = await supabase.from("trivia_answers").insert({
        round_id: round.id,
        question_id: question.id,
        profile_id: session.pid,
        choice_index: choiceIndex,
        answered_at: new Date(now).toISOString(),
        is_correct: isCorrect,
        points_awarded: points,
    });

    if (error) {
        // 23505 = unique violation: they already answered this question.
        if (error.code === "23505")
            return NextResponse.json(
                { error: "You already answered this one.", duplicate: true },
                { status: 409 }
            );
        return NextResponse.json({ error: "Couldn't save answer." }, { status: 500 });
    }

    // Best-effort roll call; never block a submission on it.
    supabase
        .from("game_participants")
        .upsert(
            { session_id: round.session_id, profile_id: session.pid },
            { onConflict: "session_id,profile_id", ignoreDuplicates: true }
        )
        .then(() => {});

    // Deliberately does not reveal correctness — that lands on the TV at the
    // reveal, and telling the phone early would spoil the room.
    return NextResponse.json({ success: true, recorded: true });
}
