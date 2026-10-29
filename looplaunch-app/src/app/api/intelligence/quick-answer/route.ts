/**
 * POST /api/intelligence/quick-answer
 *
 * Short answer for a "People Also Ask" question shown in the search intel sidebar,
 * used when Google itself didn't return an answer snippet. Needs a login, like the rest
 * of the search intel.
 */

import { NextResponse } from "next/server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { getSession, updateSession } from "@/lib/intelligence/store";
import { canUseSession } from "@/lib/auth/session-access";
import { getSignedInClaims } from "@/lib/auth/supabase-server";
import { answerBuyerQuestion } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  if (!(await getSignedInClaims())) {
    return NextResponse.json({ error: "Log in to see the answers.", loginRequired: true }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; question?: string };
  const question = body.question?.trim();
  if (!body.sessionId || !question) {
    return NextResponse.json({ error: "Missing sessionId or question" }, { status: 400 });
  }
  if (question.length > 300) {
    return NextResponse.json({ error: "Question is too long" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session || !(await canUseSession(session))) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  try {
    const result = await answerBuyerQuestion(question, session.companyIntelligence ?? null);

    // Keep the answer with the analysis, so it shows instantly next time.
    const fresh = (await getSession(session.id)) ?? session;
    const market = fresh.marketIntelligence;
    if (market?.peopleAlsoAsk?.some((p) => p.question === question)) {
      await updateSession(session.id, {
        marketIntelligence: {
          ...market,
          peopleAlsoAsk: market.peopleAlsoAsk.map((p) =>
            p.question === question ? { ...p, answer: result.answer, tip: result.tip } : p
          ),
        },
      }).catch(() => {});
    }

    return NextResponse.json(result);
  } catch (e) {
    console.warn("[QuickAnswer] Failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Couldn't get an answer right now. Try again in a moment." },
      { status: 503 }
    );
  }
}
