/**
 * POST /api/intelligence/claim
 *
 * Body: { sessionId }
 * Attaches an anonymous analysis to the logged-in user, so it shows up in History.
 */

import { NextResponse } from "next/server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { claimSession } from "@/lib/intelligence/store";

export async function POST(request: Request) {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to save this analysis" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const claimed = await claimSession(body.sessionId, user.id);
  if (!claimed) {
    return NextResponse.json({ error: "Session not found or owned by someone else" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
