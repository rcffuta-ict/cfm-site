import { NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { loadGameState } from "@/src/lib/games/service";
import type { LeaderboardEntry } from "@/src/lib/games/types";

/**
 * Combined standings for the live session, broken down per game.
 *
 * Aggregated from the answer tables rather than a materialised scores table, so
 * it can't drift out of sync with what it's derived from. The cost of that is
 * reading every scoring row each time — which is why the whole thing sits
 * behind a short cache: the TV and every phone open at the reveal all want this
 * at once, and they can share one read.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_N = 20;
const CACHE_TTL_MS = 3000;

interface Payload {
    entries: LeaderboardEntry[];
    totalPlayers: number;
    version: string;
}

const globalForBoard = globalThis as typeof globalThis & {
    __cfmBoardCache?: { payload: Payload; at: number };
    __cfmBoardInflight?: Promise<Payload>;
};

async function build(): Promise<Payload> {
    const supabase = getAdminClient();
    const state = await loadGameState(supabase);

    const empty: Payload = { entries: [], totalPlayers: 0, version: "idle" };
    if (!state.session) return empty;

    const { data: rounds } = await supabase
        .from("game_rounds")
        .select("id")
        .eq("session_id", state.session.id);

    const roundIds = (rounds ?? []).map((r) => r.id);
    if (roundIds.length === 0) return empty;

    // Buzzer points hang off prompts, not rounds, so those ids are resolved
    // first and the three reads then run together.
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
            : Promise.resolve({
                  data: [] as { profile_id: string; points_awarded: number }[],
              }),
    ]);

    interface Row {
        trivia: number;
        bingo: number;
        buzzer: number;
        total: number;
        correct: number;
    }

    const totals = new Map<string, Row>();
    const row = (id: string): Row => {
        let r = totals.get(id);
        if (!r) {
            r = { trivia: 0, bingo: 0, buzzer: 0, total: 0, correct: 0 };
            totals.set(id, r);
        }
        return r;
    };

    for (const a of answers ?? []) {
        const r = row(a.profile_id);
        const pts = a.points_awarded ?? 0;
        r.trivia += pts;
        r.total += pts;
        if (a.is_correct) r.correct += 1;
    }
    for (const w of wins ?? []) {
        const r = row(w.profile_id);
        const pts = w.points_awarded ?? 0;
        r.bingo += pts;
        r.total += pts;
    }
    for (const p of presses ?? []) {
        const r = row(p.profile_id);
        const pts = p.points_awarded ?? 0;
        r.buzzer += pts;
        r.total += pts;
    }

    // Only people who actually scored. A board padded with zeros reads as
    // broken on a big screen, and early on most of the room legitimately has
    // none yet — `totalPlayers` still reports participation.
    const ranked = [...totals.entries()]
        .filter(([, r]) => r.total > 0)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, TOP_N);

    if (ranked.length === 0)
        return { entries: [], totalPlayers: totals.size, version: `0:${totals.size}` };

    // Only the visible slice needs names, so this stays one small query even
    // with 500 players.
    const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", ranked.map(([id]) => id));

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const entries: LeaderboardEntry[] = ranked.map(([profileId, r]) => {
        const p = profileById.get(profileId);
        return {
            profileId,
            name: p ? `${p.first_name} ${p.last_name}`.trim() : "Unknown",
            level: null,
            avatarUrl: p?.avatar_url ?? null,
            trivia: r.trivia,
            bingo: r.bingo,
            buzzer: r.buzzer,
            points: r.total,
            correct: r.correct,
        };
    });

    return {
        entries,
        totalPlayers: totals.size,
        version: `${entries.length}:${entries[0]?.points ?? 0}:${totals.size}`,
    };
}

async function getBoard(): Promise<Payload> {
    const cached = globalForBoard.__cfmBoardCache;
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.payload;

    if (globalForBoard.__cfmBoardInflight) return globalForBoard.__cfmBoardInflight;

    const inflight = build()
        .then((payload) => {
            globalForBoard.__cfmBoardCache = { payload, at: Date.now() };
            return payload;
        })
        .finally(() => {
            globalForBoard.__cfmBoardInflight = undefined;
        });

    globalForBoard.__cfmBoardInflight = inflight;
    return inflight;
}

export async function GET() {
    const payload = await getBoard();
    return NextResponse.json(payload, {
        headers: { ETag: `W/"${payload.version}"`, "Cache-Control": "no-store" },
    });
}
