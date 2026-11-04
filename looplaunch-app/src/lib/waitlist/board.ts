/**
 * The waitlist and its leaderboard, on the Supabase `waitlist` table (migrations 006 and 008).
 * In local development without Supabase an in-memory list stands in, so the page still works.
 *
 * A row is on the board once it has a first name and a best time: fastest first, equal times in
 * the order they were set. Each person keeps one row, with their best time.
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/db/supabase";
import type { Board, BoardEntry } from "./types";

export const BOARD_SIZE = 10;
// The board is read on every page view; a few seconds' reuse keeps that off the database.
const BOARD_CACHE_MS = 10_000;

/** The game columns aren't in the database yet: migration 008 hasn't been run. */
export class BoardNotSetUpError extends Error {}

interface WaitlistRow {
  id: string;
  first_name: string | null;
  best_time_ms: number | null;
  best_time_at: string | null;
}

interface NewRow {
  email: string;
  first_name: string;
  best_time_ms: number | null;
  best_time_at: string | null;
  consented_at: string;
  source: string | null;
  user_agent: string | null;
}

export interface WaitlistStore {
  find(email: string): Promise<WaitlistRow | null>;
  /** Null when the email is already there (joined a moment ago from another tab). */
  insert(row: NewRow): Promise<WaitlistRow | null>;
  /** Gives a row from before the game (no name yet) its first name. */
  claimName(id: string, firstName: string, at: string): Promise<void>;
  /** Saves the time only if it beats the row's best; true when it did. */
  saveIfFaster(id: string, timeMs: number, at: string): Promise<boolean>;
  board(): Promise<Board>;
  /** Where a best time set at `at` stands, 1 for the fastest. */
  rank(timeMs: number, at: string): Promise<number>;
}

const ROW = "id, first_name, best_time_ms, best_time_at";
// Missing column, table or view: what Supabase answers before migration 008.
const NOT_SET_UP = new Set(["PGRST204", "PGRST205", "42703", "42P01"]);

function check<T>(result: { data: T; error: PostgrestError | null }, what: string): T {
  if (result.error) {
    if (NOT_SET_UP.has(result.error.code)) throw new BoardNotSetUpError(result.error.message);
    throw new Error(`${what}: ${result.error.message}`);
  }
  return result.data;
}

function toEntry(row: WaitlistRow): BoardEntry {
  return { id: row.id, name: row.first_name ?? "", timeMs: row.best_time_ms ?? 0 };
}

function supabaseStore(db: SupabaseClient): WaitlistStore {
  const waitlist = () => db.from("waitlist");
  const onBoard = () => waitlist().select("id", { count: "exact", head: true }).not("first_name", "is", null);

  return {
    async find(email) {
      return check(await waitlist().select(ROW).eq("email", email).maybeSingle(), "find") as WaitlistRow | null;
    },
    async insert(row) {
      const result = await waitlist().insert(row).select(ROW).single();
      // 23505 = unique violation: the email is already on the list.
      if (result.error?.code === "23505") return null;
      return check(result, "insert") as WaitlistRow;
    },
    async claimName(id, firstName, at) {
      check(
        await waitlist().update({ first_name: firstName, consented_at: at }).eq("id", id).is("first_name", null),
        "name"
      );
    },
    async saveIfFaster(id, timeMs, at) {
      const result = await waitlist()
        .update({ best_time_ms: timeMs, best_time_at: at })
        .eq("id", id)
        .or(`best_time_ms.is.null,best_time_ms.gt.${timeMs}`)
        .select("id");
      return (check(result, "best time") ?? []).length > 0;
    },
    async board() {
      const [top, counts] = await Promise.all([
        waitlist()
          .select(ROW)
          .not("best_time_ms", "is", null)
          .not("first_name", "is", null)
          .order("best_time_ms", { ascending: true })
          .order("best_time_at", { ascending: true })
          .limit(BOARD_SIZE),
        db
          .from("waitlist_time_counts")
          .select("time_ms, players")
          .order("time_ms", { ascending: true }),
      ]);
      const rows = (check(top, "board") ?? []) as WaitlistRow[];
      const buckets = ((check(counts, "counts") ?? []) as { time_ms: number; players: number }[]).map(
        (c): [number, number] => [c.time_ms, c.players]
      );
      return {
        top: rows.map(toEntry),
        counts: buckets,
        total: buckets.reduce((sum, [, players]) => sum + players, 0),
      };
    },
    async rank(timeMs, at) {
      const [faster, earlier] = await Promise.all([
        onBoard().lt("best_time_ms", timeMs),
        onBoard().eq("best_time_ms", timeMs).lt("best_time_at", at),
      ]);
      check(faster, "rank");
      check(earlier, "rank");
      return (faster.count ?? 0) + (earlier.count ?? 0) + 1;
    },
  };
}

type MemoryRow = WaitlistRow & NewRow;
const globalForWaitlist = globalThis as unknown as { __waitlistMemory?: Map<string, MemoryRow> };

/** The waitlist kept in memory, for local development without Supabase and for tests. */
export function createMemoryStore(rows = new Map<string, MemoryRow>()): WaitlistStore {
  const byId = (id: string) => [...rows.values()].find((row) => row.id === id);
  const ranked = () =>
    [...rows.values()]
      .filter((row) => row.first_name && row.best_time_ms !== null)
      .sort((a, b) => a.best_time_ms! - b.best_time_ms! || a.best_time_at!.localeCompare(b.best_time_at!));

  return {
    async find(email) {
      return rows.get(email) ?? null;
    },
    async insert(row) {
      if (rows.has(row.email)) return null;
      const saved = { ...row, id: crypto.randomUUID() };
      rows.set(row.email, saved);
      return saved;
    },
    async claimName(id, firstName, at) {
      const row = byId(id);
      if (row && !row.first_name) Object.assign(row, { first_name: firstName, consented_at: at });
    },
    async saveIfFaster(id, timeMs, at) {
      const row = byId(id);
      if (!row || (row.best_time_ms !== null && row.best_time_ms <= timeMs)) return false;
      Object.assign(row, { best_time_ms: timeMs, best_time_at: at });
      return true;
    },
    async board() {
      const all = ranked();
      const counts = new Map<number, number>();
      for (const row of all) counts.set(row.best_time_ms!, (counts.get(row.best_time_ms!) ?? 0) + 1);
      return { top: all.slice(0, BOARD_SIZE).map(toEntry), counts: [...counts], total: all.length };
    },
    async rank(timeMs, at) {
      const ahead = ranked().filter((r) => r.best_time_ms! < timeMs || (r.best_time_ms === timeMs && r.best_time_at! < at));
      return ahead.length + 1;
    },
  };
}

/** Supabase when it's configured; the in-memory list only outside production; otherwise null. */
export function waitlistStore(): WaitlistStore | null {
  const db = getSupabase();
  if (db) return supabaseStore(db);
  if (process.env.NODE_ENV === "production") return null;
  return createMemoryStore((globalForWaitlist.__waitlistMemory ??= new Map()));
}

let cachedBoard: { board: Board; at: number } | null = null;

export async function readBoard(store: WaitlistStore): Promise<Board> {
  if (cachedBoard && Date.now() - cachedBoard.at < BOARD_CACHE_MS) return cachedBoard.board;
  const board = await store.board();
  cachedBoard = { board, at: Date.now() };
  return board;
}

export interface JoinInput {
  email: string;
  firstName: string;
  /** A replayed run's time, or null for someone who skipped the game. */
  timeMs: number | null;
  source: string | null;
  userAgent: string | null;
}

export interface JoinResult {
  entryId: string;
  alreadyJoined: boolean;
  firstName: string;
  bestMs: number | null;
  previousBestMs: number | null;
  improved: boolean;
  rank: number | null;
  board: Board;
}

/**
 * Adds someone to the waitlist, or finds them if they're already on it, and keeps their best time.
 * Someone who joined before keeps the first name they joined with, so a stranger who knows an email
 * can't rename that person on the board.
 */
export async function joinWaitlist(store: WaitlistStore, input: JoinInput): Promise<JoinResult> {
  const now = new Date().toISOString();
  let row = await store.find(input.email);
  let alreadyJoined = row !== null;
  let improved = false;
  let previousBestMs = row?.best_time_ms ?? null;

  if (!row) {
    row = await store.insert({
      email: input.email,
      first_name: input.firstName,
      best_time_ms: input.timeMs,
      best_time_at: input.timeMs === null ? null : now,
      consented_at: now,
      source: input.source,
      user_agent: input.userAgent,
    });
    if (row) {
      improved = input.timeMs !== null;
    } else {
      alreadyJoined = true;
      row = await store.find(input.email);
      if (!row) throw new Error("join: the waitlist row disappeared");
      previousBestMs = row.best_time_ms;
    }
  }

  if (alreadyJoined) {
    if (!row.first_name) {
      await store.claimName(row.id, input.firstName, now);
      row = { ...row, first_name: input.firstName };
    }
    if (input.timeMs !== null && (await store.saveIfFaster(row.id, input.timeMs, now))) {
      improved = true;
      row = { ...row, best_time_ms: input.timeMs, best_time_at: now };
    }
  }

  cachedBoard = null;
  const best = row.best_time_ms;
  const bestAt = row.best_time_at;
  const [board, rank] = await Promise.all([
    readBoard(store),
    best !== null && bestAt ? store.rank(best, bestAt) : Promise.resolve(null),
  ]);
  return {
    entryId: row.id,
    alreadyJoined,
    firstName: row.first_name ?? input.firstName,
    bestMs: best,
    previousBestMs,
    improved,
    rank,
    board,
  };
}
