/**
 * POST /api/intelligence/quick-answer
 *
 * Short answer for a "People Also Ask" question shown in the search intel sidebar,
 * used when Google itself didn't return an answer snippet.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/intelligence/store";
import { answerBuyerQuestion } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; question?: string };
  const question = body.question?.trim();
  if (!body.sessionId || !question) {
    return NextResponse.json({ error: "Missing sessionId or question" }, { status: 400 });
  }
  if (question.length > 300) {
    return NextResponse.json({ error: "Question is too long" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  try {
    const result = await answerBuyerQuestion(question, session.companyIntelligence ?? null);
    return NextResponse.json(result);
  } catch (e) {
    console.warn("[QuickAnswer] Failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Couldn't get an answer right now. Try again in a moment." },
      { status: 503 }
    );
  }
}
