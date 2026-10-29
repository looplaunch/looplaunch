/**
 * GET /api/intelligence/status?sessionId=xxx
 *
 * Returns the current pipeline status for a session.
 * Frontend polls this endpoint during the gathering phase.
 *
 * Once ready, it includes the Search Intel view, built from stored research only (no new
 * searches). Signed-out visitors get the counts but not the records, so the sidebar shows
 * it locked.
 */

import { NextResponse } from "next/server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { getSession } from "@/lib/intelligence/store";
import { canUseSession } from "@/lib/auth/session-access";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { buildSearchIntelView, validateSearchIntelView } from "@/lib/intelligence/search-intel";
import type { StatusResponse } from "@/lib/intelligence/types";

export async function GET(request: Request) {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId parameter" },
      { status: 400 }
    );
  }

  const session = await getSession(sessionId);

  if (!session || !(await canUseSession(session))) {
    return NextResponse.json(
      { error: "Session not found or expired" },
      { status: 404 }
    );
  }

  const signedIn = Boolean(await getSignedInClaims());
  const searchIntel = session.status === "ready" ? buildSearchIntelView(session, { locked: !signedIn }) : undefined;
  const problems = searchIntel ? validateSearchIntelView(searchIntel) : [];
  if (problems.length) console.warn(`[Status] Search Intel view for ${session.id} has problems: ${problems.join("; ")}`);

  const response: StatusResponse = {
    sessionId: session.id,
    status: session.status,
    statusMessage: session.statusMessage,
    hasCompanyIntelligence: !!session.companyIntelligence,
    hasCompetitorIntelligence:
      !!session.competitorIntelligence && session.competitorIntelligence.length > 0,
    hasMarketIntelligence: !!session.marketIntelligence,
    hasDiagnosis: !!session.diagnosis,
    companyName: session.onboardingInput?.companyName || session.companyIntelligence?.name,
    messages: session.messages || [],
    searchIntel,
    error: session.error,
  };

  return NextResponse.json(response);
}
