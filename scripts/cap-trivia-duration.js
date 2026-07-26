/**
 * Bring existing trivia rounds down to the current duration cap.
 *
 * The cap lives in src/lib/games/questions.ts and is enforced on every write
 * path plus at round start, so this is only about making the stored configs
 * say what the host panel shows. Rounds whose config is `{}` are filled in
 * explicitly rather than left to fall back.
 *
 * Dry run (default):  node --env-file=.env.production scripts/cap-trivia-duration.js
 * Apply:              node --env-file=.env.production scripts/cap-trivia-duration.js --apply
 */

const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");

// Kept in step with MAX_DURATION_SECONDS in src/lib/games/questions.ts — this
// script is plain CJS and can't import the TS module.
const MAX_DURATION_SECONDS = 12;

const DEFAULTS = { durationSeconds: 20, basePoints: 100, speedBonus: 50 };

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
    console.log(`Project: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log(`Cap: ${MAX_DURATION_SECONDS}s\n`);

    const { data: rounds, error } = await supabase
        .from("game_rounds")
        .select("id, status, order_index, config")
        .eq("type", "trivia")
        .order("order_index", { ascending: true });
    if (error) die(`Couldn't read game_rounds: ${error.message}`);

    // An active round already has an `ends_at` computed from the old duration;
    // rewriting its config now would leave the two disagreeing mid-question.
    const active = rounds.filter((r) => r.status === "active");
    if (active.length > 0)
        die(`Round ${active[0].id} is on screen. Stop it before rewriting configs.`);

    const targets = rounds.filter((r) => {
        const current = Number(r.config?.durationSeconds) || DEFAULTS.durationSeconds;
        return current !== MAX_DURATION_SECONDS;
    });

    console.log(`${rounds.length} trivia rounds, ${targets.length} to change:`);
    for (const r of targets) {
        const current = Number(r.config?.durationSeconds) || DEFAULTS.durationSeconds;
        const inherited = r.config?.durationSeconds === undefined ? " (inherited)" : "";
        console.log(
            `  #${r.order_index + 1} ${r.id}  ${current}s${inherited} → ${MAX_DURATION_SECONDS}s`
        );
    }

    if (targets.length === 0) {
        console.log("\nNothing to do.");
        return;
    }

    if (!APPLY) {
        console.log("\nDry run complete. Rerun with --apply to write.");
        return;
    }

    console.log("");
    for (const r of targets) {
        // Merge rather than replace: `disabled` and any hand-tuned basePoints
        // on a round have to survive.
        const config = {
            ...DEFAULTS,
            ...(r.config ?? {}),
            durationSeconds: MAX_DURATION_SECONDS,
        };
        const { error: updateError } = await supabase
            .from("game_rounds")
            .update({ config })
            .eq("id", r.id);
        if (updateError) die(`updating ${r.id}: ${updateError.message}`);
        console.log(`  ✓ #${r.order_index + 1} ${r.id}`);
    }

    const { data: after } = await supabase
        .from("game_rounds")
        .select("id, config")
        .eq("type", "trivia");
    const bad = after.filter(
        (r) => Number(r.config?.durationSeconds) !== MAX_DURATION_SECONDS
    );
    if (bad.length > 0) die(`${bad.length} round(s) still off-cap — inspect.`);
    console.log(`\nAll ${after.length} trivia rounds run ${MAX_DURATION_SECONDS}s. Done.`);
}

main().catch((e) => die(e.message));
