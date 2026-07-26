import { NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { loadGameState } from "@/src/lib/games/service";
import type { LeaderboardEntry } from "@/src/lib/games/types";

/**
 * Combined standings for the live session.
 *
 * Aggregated from `trivia_answers` rather than a materialised scores table —
 * with trivia alone that's one indexed read, and it can't drift out of sync
 * with the answers it's derived from. Worth materialising once buzzer and
 * bingo land and totals span three sources.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_N = 20;

export async function GET() {
    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    if (!state.session)
        return NextResponse.json({ entries: [], totalPlayers: 0 });

    const { data: rounds } = await supabase
        .from("game_rounds")
        .select("id")
        .eq("session_id", state.session.id);

    const roundIds = (rounds ?? []).map((r) => r.id);
    if (roundIds.length === 0)
        return NextResponse.json({ entries: [], totalPlayers: 0 });

    // Buzzer points hang off prompts rather than rounds, so the prompt ids for
    // this session have to be resolved before the presses can be totalled.
    const { data: prompts } = await supabase
        .from("buzzer_prompts")
        .select("id")
        .in("round_id", roundIds);
    const promptIds = (prompts ?? []).map((p) => p.id);

    const [{ data: answers }, { data: wins }, { data: presses }] = await Promise.all([
        supabase
            .from("trivia_answers")
            .select("profile_id, points_awarded, is_correct")
            .in("round_id", roundIds),
        supabase
            .from("bingo_wins")
            .select("profile_id, points_awarded")
            .in("round_id", roundIds),
        promptIds.length > 0
            ? supabase
                  .from("buzzer_presses")
                  .select("profile_id, points_awarded")
                  .in("prompt_id", promptIds)
            : Promise.resolve({ data: [] as { profile_id: string; points_awarded: number }[] }),
    ]);

    // One combined board across every game in the session, per game-plan §8.
    const totals = new Map<string, { points: number; correct: number }>();
    const bump = (id: string, points: number, correct = 0) => {
        const row = totals.get(id) ?? { points: 0, correct: 0 };
        row.points += points;
        row.correct += correct;
        totals.set(id, row);
    };

    for (const a of answers ?? [])
        bump(a.profile_id, a.points_awarded ?? 0, a.is_correct ? 1 : 0);
    for (const w of wins ?? []) bump(w.profile_id, w.points_awarded ?? 0);
    for (const p of presses ?? []) bump(p.profile_id, p.points_awarded ?? 0);

    // Only people who actually scored. Everyone who answered is in `totals`,
    // but a board padded with zeros reads as broken on the big screen — and
    // with one question in, most of the room legitimately has none yet.
    // `totalPlayers` still reports participation.
    const ranked = [...totals.entries()]
        .filter(([, row]) => row.points > 0)
        .sort((a, b) => b[1].points - a[1].points)
        .slice(0, TOP_N);

    if (ranked.length === 0)
        return NextResponse.json({ entries: [], totalPlayers: totals.size });

    // Only the visible slice needs names, so this stays one small query even
    // with 500 players.
    const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, entry_year")
        .in("id", ranked.map(([id]) => id));

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const entries: LeaderboardEntry[] = ranked.map(([profileId, row]) => {
        const p = profileById.get(profileId);
        return {
            profileId,
            name: p ? `${p.first_name} ${p.last_name}`.trim() : "Unknown",
            level: null,
            avatarUrl: p?.avatar_url ?? null,
            points: row.points,
            correct: row.correct,
        };
    });

    return NextResponse.json({ entries, totalPlayers: totals.size });
}
