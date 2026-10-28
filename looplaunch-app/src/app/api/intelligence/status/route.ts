/**
 * GET /api/intelligence/status?sessionId=xxx
 *
 * Returns the current pipeline status for a session.
 * Frontend polls this endpoint during the gathering phase.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/intelligence/store";
import { canUseSession } from "@/lib/auth/session-access";
import type { StatusResponse } from "@/lib/intelligence/types";

export async function GET(request: Request) {
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
    marketIntelligence: session.marketIntelligence,
    competitorIntelligence: session.competitorIntelligence,
    error: session.error,
  };

  return NextResponse.json(response);
}
