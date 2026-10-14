/**
 * POST /api/intelligence/ask
 *
 * Strategic question-answering endpoint.
 * Uses stored intelligence to answer the user's marketing strategy questions.
 *
 * Requires a valid sessionId with status "ready".
 */

import { NextResponse } from "next/server";
import { getSession, addMessageToSession } from "@/lib/intelligence/store";
import { answerQuestion } from "@/lib/ai/gemini";
import { retrieveFrameworkContext } from "@/lib/ai/framework-retriever";
import { researchQuestion } from "@/lib/research/tavily";
import { analyzeUserQuery } from "@/lib/ai/query-classifier";
import type {
  AskResponse,
  StrategicQuestion,
  CompanyIntelligence,
  MarketIntelligence,
  StrategicDiagnosis,
  ChatMessage,
  TavilySearchResult,
} from "@/lib/intelligence/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StrategicQuestion>;

    // Validate input
    if (!body.sessionId || !body.question) {
      return NextResponse.json(
        { error: "Missing sessionId or question" },
        { status: 400 }
      );
    }

    const { sessionId, question } = body;
    console.log(`\n[PIPELINE] Strategic question received (Session: ${sessionId})`);
    console.log(`[PIPELINE] Question: "${question}"`);

    // Get session (or fallback test session if testing directly)
    let session = await getSession(sessionId);

    if (!session && (sessionId === "test" || sessionId.startsWith("test_"))) {
      console.log(`[PIPELINE] Using demo test session context for sessionId: "${sessionId}"`);
      session = await getSession("test"); // Trigger createTestSession
    }

    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    // Check pipeline is complete
    if (session.status !== "ready") {
      return NextResponse.json(
        {
          error: `Intelligence gathering is not complete. Current status: ${session.status}`,
          status: session.status,
          statusMessage: session.statusMessage,
        },
        { status: 409 }
      );
    }

    // Verify required intelligence
    if (
      !session.companyIntelligence ||
      !session.marketIntelligence ||
      !session.diagnosis
    ) {
      return NextResponse.json(
        { error: "Intelligence data is incomplete. Please re-run the gathering pipeline." },
        { status: 500 }
      );
    }

    // Capture conversation history before this turn
    const priorHistory: ChatMessage[] = session.messages ? [...session.messages] : [];

    // ─── STEP 1: Add User Message to Persistent History ───
    const userMessage: ChatMessage = {
      id: `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };
    await addMessageToSession(sessionId, userMessage);

    // ─── STEP 2: Query Understanding & Intent Classification ───
    const analysis = analyzeUserQuery(
      question,
      priorHistory,
      session.companyIntelligence.name
    );
    console.log(`[QUERY UNDERSTANDING] Intent: ${analysis.intent} | Needs Search: ${analysis.needsWebResearch}`);
    if (analysis.resolvedReference) {
      console.log(`[QUERY UNDERSTANDING] Resolved Reference: ${analysis.resolvedReference}`);
    }

    // ─── STEP 3: Selective Web Research (Only when factual search is required) ───
    let researchResults: TavilySearchResult[] = [];
    let researchStatus: "success" | "no_results" | "failed" | "unconfigured" = "unconfigured";

    if (analysis.needsWebResearch && analysis.searchQuery) {
      const research = await researchQuestion(
        analysis.searchQuery,
        session.companyIntelligence?.industry
      );
      researchResults = research.results;
      researchStatus = research.status;
    }

    // ─── STEP 3.5: Retrieve Loop Launch Framework Knowledge (RAG) ───
    const framework = await retrieveFrameworkContext(
      question,
      session.companyIntelligence?.industry
    );

    // ─── STEP 4: Conversational Strategic Reasoning ───
    const answer = await answerQuestion(
      question,
      session.companyIntelligence,
      session.competitorIntelligence || [],
      session.marketIntelligence,
      session.diagnosis,
      researchResults,
      researchStatus,
      priorHistory,
      session.conversationSummary,
      analysis,
      framework.formattedContext
    );

    // ─── STEP 5: Add Assistant Response to Persistent History ───
    const assistantMessage: ChatMessage = {
      id: `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: "assistant",
      content: answer.answer,
      timestamp: new Date().toISOString(),
      evidence: answer.evidence,
      sources: answer.sources,
      confidence: answer.confidence,
      followUpQuestions: answer.followUpQuestions,
      queryIntent: analysis.intent,
      researchStatus: answer.researchStatus,
    };
    await addMessageToSession(sessionId, assistantMessage);

    console.log(`[PIPELINE] Conversational answer saved for session: ${sessionId}\n`);

    const response: AskResponse = {
      answer,
      messages: session.messages,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] /intelligence/ask error:", error);
    return NextResponse.json(
      { error: "Failed to generate answer. Please try again." },
      { status: 500 }
    );
  }
}
