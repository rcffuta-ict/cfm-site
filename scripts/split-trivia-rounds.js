/**
 * One-off migration: split a trivia round that holds many questions into one
 * round per question.
 *
 * The app treats a question *as* a round (see src/lib/games/service.ts), so a
 * round carrying 24 questions only ever renders its first one — in the host
 * editor and on the big screen alike. This moves the data onto the shape the
 * code expects.
 *
 * Dry run (default):  node --env-file=.env.production scripts/split-trivia-rounds.js
 * Apply:              node --env-file=.env.production scripts/split-trivia-rounds.js --apply
 */

const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

function die(message) {
    console.error(`\n✗ ${message}`);
    process.exit(1);
}

async function main() {
    console.log(APPLY ? "MODE: APPLY (writes)" : "MODE: DRY RUN (no writes)");
    console.log(`Project: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

    // ── Find the rounds that carry more than one question ────────────────
    const { data: rounds, error: roundsError } = await supabase
        .from("game_rounds")
        .select("id, session_id, type, status, order_index, config")
        .eq("type", "trivia");
    if (roundsError) die(`Couldn't read game_rounds: ${roundsError.message}`);

    const { data: questions, error: questionsError } = await supabase
        .from("trivia_questions")
        .select("id, round_id, order_index, question, options, correct_index, points");
    if (questionsError)
        die(`Couldn't read trivia_questions: ${questionsError.message}`);

    const byRound = new Map();
    for (const q of questions) {
        if (!byRound.has(q.round_id)) byRound.set(q.round_id, []);
        byRound.get(q.round_id).push(q);
    }

    const overloaded = rounds.filter((r) => (byRound.get(r.id) ?? []).length > 1);
    if (overloaded.length === 0) {
        console.log("Nothing to do — every trivia round holds at most one question.");
        return;
    }
    if (overloaded.length > 1)
        die(
            `${overloaded.length} rounds hold multiple questions. This script handles one at a time — rerun per round or widen it deliberately.`
        );

    const round = overloaded[0];
    const rows = byRound
        .get(round.id)
        .slice()
        .sort((a, b) => a.order_index - b.order_index);

    console.log(`Round ${round.id} (session ${round.session_id})`);
    console.log(`  status: ${round.status}, order_index: ${round.order_index}`);
    console.log(`  questions: ${rows.length}\n`);

    // ── Refuse to run over scored data ───────────────────────────────────
    // Answers are keyed by round_id, so re-parenting questions would silently
    // detach points that have already been awarded.
    const { count: answerCount, error: answersError } = await supabase
        .from("trivia_answers")
        .select("id", { count: "exact", head: true })
        .eq("round_id", round.id);
    if (answersError) die(`Couldn't count trivia_answers: ${answersError.message}`);
    if (answerCount > 0)
        die(
            `${answerCount} answers already exist for this round — splitting it would orphan them. Resolve by hand.`
        );

    if (round.status === "active")
        die("Round is active (on screen). Stop it before migrating.");

    // ── Plan ─────────────────────────────────────────────────────────────
    // The existing round keeps question #1 and takes order_index 0; questions
    // 2..n get fresh rounds at 1..n-1. Renumbering the existing round first
    // frees the slots the new rounds want, in case (session_id, order_index)
    // is unique.
    const { data: allSessionRounds } = await supabase
        .from("game_rounds")
        .select("id, type, order_index")
        .eq("session_id", round.session_id)
        .neq("id", round.id);
    if ((allSessionRounds ?? []).length > 0)
        die(
            `Session has ${allSessionRounds.length} other round(s) (${allSessionRounds
                .map((r) => `${r.type}@${r.order_index}`)
                .join(", ")}). Renumbering would disturb them — handle by hand.`
        );

    console.log("Plan:");
    console.log(`  1. round ${round.id} → order_index 0, keeps "${rows[0].question.slice(0, 60)}…"`);
    console.log(`  2. question ${rows[0].id} → order_index 0`);
    console.log(`  3. create ${rows.length - 1} rounds (order_index 1..${rows.length - 1}), config copied from the existing round`);
    console.log(`  4. re-parent questions 2..${rows.length} onto them, order_index 0`);
    console.log(`  5. session.current_round_id → ${round.id}\n`);

    if (!APPLY) {
        rows.forEach((q, i) =>
            console.log(`  #${i + 1} ${q.question.slice(0, 70)}`)
        );
        console.log("\nDry run complete. Rerun with --apply to write.");
        return;
    }

    // ── Apply ────────────────────────────────────────────────────────────
    const config = round.config ?? {};

    const step = async (label, promise) => {
        const { error } = await promise;
        if (error) die(`${label}: ${error.message}`);
        console.log(`  ✓ ${label}`);
    };

    await step(
        "existing round → order_index 0",
        supabase.from("game_rounds").update({ order_index: 0 }).eq("id", round.id)
    );
    await step(
        "first question → order_index 0",
        supabase
            .from("trivia_questions")
            .update({ order_index: 0 })
            .eq("id", rows[0].id)
    );

    for (let i = 1; i < rows.length; i++) {
        const q = rows[i];
        const { data: newRound, error } = await supabase
            .from("game_rounds")
            .insert({
                session_id: round.session_id,
                type: "trivia",
                status: "pending",
                order_index: i,
                config,
            })
            .select("id")
            .single();
        if (error || !newRound)
            die(`creating round for question ${i + 1}: ${error?.message}`);

        const { error: moveError } = await supabase
            .from("trivia_questions")
            .update({ round_id: newRound.id, order_index: 0 })
            .eq("id", q.id);
        if (moveError) {
            // Don't leave an empty round behind — it would show as a blank slot
            // in the run of show and could be started by mistake.
            await supabase.from("game_rounds").delete().eq("id", newRound.id);
            die(`moving question ${i + 1}: ${moveError.message}`);
        }
        console.log(`  ✓ #${i + 1} → round ${newRound.id} (order_index ${i})`);
    }

    await step(
        "session.current_round_id → first round",
        supabase
            .from("game_sessions")
            .update({ current_round_id: round.id })
            .eq("id", round.session_id)
    );

    // ── Verify ───────────────────────────────────────────────────────────
    const { data: after } = await supabase
        .from("game_rounds")
        .select("id, order_index, trivia_questions(id)")
        .eq("session_id", round.session_id)
        .eq("type", "trivia")
        .order("order_index", { ascending: true });

    console.log(`\nAfter: ${after.length} trivia rounds`);
    const bad = after.filter((r) => (r.trivia_questions ?? []).length !== 1);
    if (bad.length > 0)
        die(`${bad.length} round(s) don't hold exactly one question — inspect.`);
    console.log("Every round holds exactly one question. Done.");
}

main().catch((e) => die(e.message));
