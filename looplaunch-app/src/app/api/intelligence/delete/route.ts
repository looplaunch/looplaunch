/**
 * POST /api/intelligence/delete
 *
 * Body: { sessionId }
 * Deletes one of the signed-in person's analyses (and its chat) from their History.
 */

import { NextResponse } from "next/server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { deleteOwnedSession } from "@/lib/intelligence/store";

export async function POST(request: Request) {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to delete analyses." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  // Only the owner can delete. Unowned analyses don't appear in anyone's History.
  const result = await deleteOwnedSession(body.sessionId, user.id);
  if (result === "not-found") {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }
  if (result === "failed") {
    return NextResponse.json({ error: "Couldn't delete this analysis. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
