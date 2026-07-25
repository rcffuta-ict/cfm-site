import fs from "fs/promises";
import path from "path";

/**
 * The Oracle's local state: the member snapshot it draws from, and the waiting
 * room of recently drawn raffle ids.
 *
 * Both live in memory for the draw itself and are mirrored to JSON on the
 * laptop's own disk, so refreshing the console, opening it on a second device,
 * or restarting the server mid-event never loses the queue. Nothing here
 * touches the network.
 */

const DIR = path.join(process.cwd(), ".oracle");
const MEMBERS_FILE = path.join(DIR, "members.json");
const WAITING_FILE = path.join(DIR, "waiting.json");

/** A registrant, pre-enriched at snapshot time so the draw needs no lookups. */
export interface OracleMember {
    raffleId: number;
    firstName: string;
    lastName: string;
    level: string;
    gender: string;
    unit: string | null;
    avatarUrl: string | null;
}

export interface MembersSnapshot {
    eventId: string | null;
    /** Epoch ms of the last successful refresh. */
    syncedAt: number;
    members: OracleMember[];
    /**
     * Profile ids confirmed as admin during a refresh. Lets the draw authorise
     * the caller without the network round trip `isAdmin()` would cost.
     */
    adminPids: string[];
}

export interface WaitingRoom {
    /** How many draws an id sits out. 0 disables the waiting room entirely. */
    slots: number;
    /** Recently drawn raffle ids, most recent first. */
    queue: number[];
}

export const DEFAULT_SLOTS = 3;
export const MAX_SLOTS = 10;

const EMPTY_SNAPSHOT: MembersSnapshot = {
    eventId: null,
    syncedAt: 0,
    members: [],
    adminPids: [],
};

const globalForStore = globalThis as typeof globalThis & {
    __cfmOracleSnapshot?: MembersSnapshot;
    __cfmOracleWaiting?: WaitingRoom;
    __cfmOracleLoaded?: boolean;
};

async function readJson<T>(file: string): Promise<T | null> {
    try {
        return JSON.parse(await fs.readFile(file, "utf8")) as T;
    } catch {
        // Missing or corrupt — callers fall back to defaults. A bad file must
        // never stop the Oracle from starting.
        return null;
    }
}

/**
 * Write via a temp file + rename so a crash mid-write can't leave a truncated
 * JSON file that would come back as an empty waiting room next boot.
 */
async function writeJson(file: string, value: unknown): Promise<void> {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value), "utf8");
    await fs.rename(tmp, file);
}

/** Load both files into memory once per process. */
async function ensureLoaded(): Promise<void> {
    if (globalForStore.__cfmOracleLoaded) return;

    const [snapshot, waiting] = await Promise.all([
        readJson<MembersSnapshot>(MEMBERS_FILE),
        readJson<WaitingRoom>(WAITING_FILE),
    ]);

    globalForStore.__cfmOracleSnapshot = snapshot ?? EMPTY_SNAPSHOT;
    globalForStore.__cfmOracleWaiting = waiting ?? {
        slots: DEFAULT_SLOTS,
        queue: [],
    };
    globalForStore.__cfmOracleLoaded = true;
}

// ── Snapshot ──────────────────────────────────────────────────────────────

export async function getSnapshot(): Promise<MembersSnapshot> {
    await ensureLoaded();
    return globalForStore.__cfmOracleSnapshot ?? EMPTY_SNAPSHOT;
}

export async function saveSnapshot(snapshot: MembersSnapshot): Promise<void> {
    await ensureLoaded();
    globalForStore.__cfmOracleSnapshot = snapshot;
    await writeJson(MEMBERS_FILE, snapshot);
}

/** Whether a profile id was confirmed admin during a refresh on this machine. */
export async function isCachedAdmin(pid: string): Promise<boolean> {
    const snapshot = await getSnapshot();
    return snapshot.adminPids.includes(pid);
}

// ── Waiting room ──────────────────────────────────────────────────────────

export async function getWaitingRoom(): Promise<WaitingRoom> {
    await ensureLoaded();
    return (
        globalForStore.__cfmOracleWaiting ?? {
            slots: DEFAULT_SLOTS,
            queue: [],
        }
    );
}

/** The ids actually blocked right now — the queue trimmed to the slot count. */
export async function getBlockedIds(): Promise<number[]> {
    const { slots, queue } = await getWaitingRoom();
    return queue.slice(0, slots);
}

async function saveWaitingRoom(next: WaitingRoom): Promise<void> {
    globalForStore.__cfmOracleWaiting = next;
    await writeJson(WAITING_FILE, next);
}

/**
 * Record a draw. The id goes to the front of the queue and sits out the next
 * `slots` draws. We keep a little history beyond the current slot count so
 * raising the setting mid-event takes effect immediately rather than starting
 * from an artificially short queue.
 */
export async function recordDraw(raffleId: number): Promise<WaitingRoom> {
    const current = await getWaitingRoom();
    const next: WaitingRoom = {
        slots: current.slots,
        queue: [raffleId, ...current.queue.filter((id) => id !== raffleId)].slice(
            0,
            MAX_SLOTS
        ),
    };
    await saveWaitingRoom(next);
    return next;
}

export async function setSlots(slots: number): Promise<WaitingRoom> {
    const current = await getWaitingRoom();
    const clamped = Math.max(0, Math.min(MAX_SLOTS, Math.floor(slots) || 0));
    const next = { ...current, slots: clamped };
    await saveWaitingRoom(next);
    return next;
}

export async function clearWaitingRoom(): Promise<WaitingRoom> {
    const current = await getWaitingRoom();
    const next = { ...current, queue: [] };
    await saveWaitingRoom(next);
    return next;
}
