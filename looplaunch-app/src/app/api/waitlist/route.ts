/**
 * POST /api/waitlist
 *
 * Body: { email, company? }
 * Adds an email to the Supabase `waitlist` table (migration 006). Public: this is the
 * only thing visitors can do while Loop Launch is invite-only.
 *
 * `company` is a honeypot field hidden from people. Bots fill it in; we pretend to
 * succeed and store nothing.
 */

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/supabase";

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

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many tries. Please wait a minute." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: unknown; company?: unknown };
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ ok: true, alreadyJoined: false });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "The waitlist is unavailable right now. Please try again later." }, { status: 503 });
  }

  const { error } = await supabase.from(WAITLIST_TABLE).insert({
    email,
    source: request.headers.get("referer")?.slice(0, 500) ?? null,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  });

  // 23505 = unique violation: this email is already on the list, which is fine.
  if (error?.code === "23505") return NextResponse.json({ ok: true, alreadyJoined: true });
  if (error) {
    console.error("[Waitlist] Insert failed:", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyJoined: false });
}
