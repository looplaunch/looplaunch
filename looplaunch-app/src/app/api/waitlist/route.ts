/**
 * POST /api/waitlist
 *
 * Body: { email, firstName, consent, role?, brand?, run?, company? }
 * Adds someone to the Supabase `waitlist` table (migrations 006, 008 and 009). Public: this is the
 * only thing visitors can do while Loop Launch is invite-only.
 *
 * `role` (Founder, CEO… or their own words) and `brand` (where the brand lives online: a website,
 * Instagram, LinkedIn…) are required to join. Someone already on the list who is only saving a
 * new time can leave them out; if their row has none yet, the ones sent fill it in.
 *
 * `run` is a finished game of Loopy's snake, { seed, turns }. The server replays it to get the
 * time, so a time can't be made up, and keeps each person's best for the leaderboard.
 *
 * `company` is a honeypot field hidden from people. Bots fill it in; we pretend to
 * succeed and store nothing.
 */

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/supabase";
import { BoardNotSetUpError, MissingDetailsError, joinWaitlist, waitlistStore } from "@/lib/waitlist/board";
import { cleanBrandLink, cleanRole, parseDetails } from "@/lib/waitlist/details";
import { cleanFirstName, isBlockedName } from "@/lib/waitlist/names";
import { parseRun, replay } from "@/lib/waitlist/snake";
import type { JoinResponse } from "@/lib/waitlist/types";

const WAITLIST_TABLE = "waitlist";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

// A light per-IP limit so one script can't flood the table. In memory, so it resets on deploy.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;
const recentRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (recentRequests.get(ip) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  recentRequests.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

let warnedNotSetUp = false;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many tries. Please wait a minute." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    firstName?: unknown;
    consent?: unknown;
    run?: unknown;
    company?: unknown;
    role?: unknown;
    brand?: unknown;
  };
  const firstName = cleanFirstName(body.firstName);

  if (typeof body.company === "string" && body.company.trim()) {
    const fake: JoinResponse = {
      ok: true,
      alreadyJoined: false,
      firstName,
      entryId: null,
      timeMs: null,
      bestMs: null,
      previousBestMs: null,
      improved: false,
      rank: null,
      board: null,
    };
    return NextResponse.json(fake);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!firstName) return badRequest("Please add your first name.");
  if (isBlockedName(firstName)) return badRequest("Please use your real first name.");
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return badRequest("Please enter a valid email address.");
  }
  if (body.consent !== true) return badRequest("Please tick the box so we can email you when we launch.");

  // Sent but unusable is an error to fix; not sent at all is fine for someone already on the list.
  const sentDetails = body.role !== undefined || body.brand !== undefined;
  const details = sentDetails ? parseDetails(body.role, body.brand) : null;
  if (sentDetails && !details) {
    if (!cleanRole(body.role)) return badRequest("Please pick your role, or type it in.");
    if (!cleanBrandLink(body.brand)) return badRequest("Please add a link to your brand, like yourbrand.com or instagram.com/yourbrand.");
  }

  // A run that doesn't replay to a finish still lets the person join; it just doesn't get a time.
  let timeMs: number | null = null;
  let runRejected = false;
  if (body.run !== undefined && body.run !== null) {
    const run = parseRun(body.run);
    const result = run ? replay(run.seed, run.turns) : null;
    if (result?.ok) timeMs = result.timeMs;
    else runRejected = true;
  }

  const source = request.headers.get("referer")?.slice(0, 500) ?? null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const store = waitlistStore();
  if (!store) {
    return NextResponse.json({ error: "The waitlist is unavailable right now. Please try again later." }, { status: 503 });
  }

  try {
    const joined = await joinWaitlist(store, { email, firstName, timeMs, source, userAgent, details });
    const response: JoinResponse = {
      ok: true,
      alreadyJoined: joined.alreadyJoined,
      firstName: joined.firstName,
      entryId: joined.entryId,
      timeMs,
      bestMs: joined.bestMs,
      previousBestMs: joined.previousBestMs,
      improved: joined.improved,
      rank: joined.rank,
      board: joined.board,
      ...(runRejected ? { runRejected } : {}),
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof MissingDetailsError) {
      // The page then shows the role and brand fields (this browser thought it had already joined).
      return NextResponse.json(
        { error: "Add your role and where your brand lives online to join.", needsDetails: true },
        { status: 400 }
      );
    }
    if (!(error instanceof BoardNotSetUpError)) {
      console.error("[Waitlist] Join failed:", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  }

  // Migration 008 hasn't been run: save the email the way the waitlist did before the game.
  if (!warnedNotSetUp) {
    warnedNotSetUp = true;
    console.warn("[Waitlist] Saving emails only: run supabase/migrations/008_waitlist_game.sql to keep names and times.");
  }
  const db = getSupabase();
  const { error } = db
    ? await db.from(WAITLIST_TABLE).insert({ email, source, user_agent: userAgent })
    : { error: { code: "", message: "Supabase is not configured" } };
  if (error && error.code !== "23505") {
    console.error("[Waitlist] Insert failed:", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  const response: JoinResponse = {
    ok: true,
    alreadyJoined: error?.code === "23505",
    firstName,
    entryId: null,
    timeMs,
    bestMs: null,
    previousBestMs: null,
    improved: false,
    rank: null,
    board: null,
  };
  return NextResponse.json(response);
}
