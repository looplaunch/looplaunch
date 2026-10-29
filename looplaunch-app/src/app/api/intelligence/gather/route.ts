/**
 * POST /api/intelligence/gather
 *
 * Main intelligence pipeline endpoint. Receives the onboarding answers and runs:
 * 1. Crawl the website (Crawl4AI, or the built-in fetch crawler)
 * 2. Business profile: what they sell, to whom, and where (Gemini, from the crawled pages)
 * 3. Search Intel research (src/lib/research/orchestrator.ts): competitors, competitor ads,
 *    Ad Library and buyer questions within the configured search budget, reusing cached results
 * 4. Market analysis and AI answers to the buyer questions (Gemini, from that research)
 * 5. Strategic diagnosis (Gemini, from the same research brief)
 * 6. Everything is stored on the session (Supabase + in-memory cache)
 *
 * Returns immediately with a sessionId (202 Accepted). Poll /api/intelligence/status.
 */

import { NextResponse } from "next/server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import type { CrawlResult, GatherResponse, MarketIntelligence, OnboardingInput } from "@/lib/intelligence/types";
import { createSession, updateSession, updateStatus } from "@/lib/intelligence/store";
import { crawlWebsite, crawlResultToText } from "@/lib/crawler/website-crawler";
import { buildBusinessProfile } from "@/lib/ai/business-profiler";
import { runResearch } from "@/lib/research/orchestrator";
import { buildResearchBrief } from "@/lib/ai/research-brief";
import { analyzeMarket, answerBuyerQuestions, generateDiagnosis } from "@/lib/ai/gemini";

// ──────────────────────────────────────────────
// Validation (9-question format)
// ──────────────────────────────────────────────

function validateInput(body: unknown): OnboardingInput | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  // Website is the only strictly required field
  if (!data.website || typeof data.website !== "string") return null;

  return {
    website: data.website as string,
    role: (data.role as string) || "",
    industry: (data.industry as string) || "",
    stage: (data.stage as string) || "",
    coreOffer: (data.coreOffer as string) || "",
    audience: Array.isArray(data.audience) ? (data.audience as string[]) : [],
    salesChannels: Array.isArray(data.salesChannels) ? (data.salesChannels as string[]) : [],
    biggestHeadache: (data.biggestHeadache as string) || "",
    thirtyDayGoal: (data.thirtyDayGoal as string) || "",
    companyName: (data.companyName as string) || undefined,
  };
}

// ──────────────────────────────────────────────
// Pipeline Orchestrator (runs asynchronously)
// ──────────────────────────────────────────────

async function runPipeline(sessionId: string, input: OnboardingInput) {
  try {
    // ─── STAGE 1: Crawl the website ───
    await updateStatus(sessionId, "crawling_company", "Reading your website...");
    let companyCrawl: CrawlResult;
    try {
      companyCrawl = await crawlWebsite(input.website);
    } catch (e) {
      console.error("[Pipeline] Company crawl failed:", e);
      companyCrawl = { pages: [], domain: "", totalPages: 0, crawledAt: new Date().toISOString() };
    }
    const companyText = crawlResultToText(companyCrawl);

    // ─── STAGE 2: Business profile ───
    await updateStatus(sessionId, "analyzing_company", "Working out what you sell, to whom, and where...");
    const companyIntel = await buildBusinessProfile(input, companyText);
    companyIntel.rawCrawlData = companyCrawl;
    input.companyName = companyIntel.name;
    await updateSession(sessionId, { companyIntelligence: companyIntel, onboardingInput: input });

    // ─── STAGE 3: Search Intel research (budgeted, cached, ledgered) ───
    await updateStatus(sessionId, "crawling_competitors", "Searching Google for your competitors, their ads and your buyers' questions...");
    const research = await runResearch(companyIntel, { sessionId });
    await updateSession(sessionId, { competitorIntelligence: research.competitors });

    // ─── STAGE 4: Market analysis + AI answers to the buyer questions ───
    await updateStatus(sessionId, "analyzing_market", "Reading the market evidence...");
    const searchData: MarketIntelligence = {
      industryOverview: "",
      marketSize: "",
      growthTrends: [],
      keyPlayers: [],
      emergingTrends: [],
      customerBehaviors: [],
      regulations: [],
      opportunities: [],
      threats: [],
      keywordAds: research.ads,
      shoppingResults: research.shopping,
      peopleAlsoAsk: research.questions.map((q) => ({
        id: q.id,
        question: q.question,
        sourceQuery: q.sourceQuery,
        observedAt: q.observedAt,
        snippet: q.snippet,
        title: q.title,
        link: q.link,
      })),
      organicKeywords: research.organic.map((o) => ({ position: o.position, title: o.title, link: o.link, snippet: o.snippet })),
      generatedQueries: research.queries,
      messagingPatterns: research.messagingPatterns,
      strategicOpportunities: research.strategicOpportunities,
      strategicThreats: research.strategicThreats,
      collectedAt: research.research.dataCollectedAt || research.research.completedAt,
      research: research.research,
    };
    const brief = buildResearchBrief({ company: companyIntel, competitors: research.competitors, market: searchData });

    // Gemini answers are labelled as AI in Search Intel; Google's own answer stays in `snippet`.
    const [marketAnalysis, answers] = await Promise.all([
      analyzeMarket(input, brief),
      answerBuyerQuestions(
        research.questions.map((q) => q.question),
        companyIntel
      ),
    ]);
    // Only the analysis fields come from Gemini; it can't overwrite collected search data.
    const { industryOverview, marketSize, growthTrends, keyPlayers, emergingTrends, customerBehaviors, regulations, opportunities, threats, analysisUnavailable } =
      marketAnalysis;
    const marketIntel: MarketIntelligence = {
      ...searchData,
      industryOverview,
      marketSize,
      growthTrends,
      keyPlayers,
      emergingTrends,
      customerBehaviors,
      regulations,
      opportunities,
      threats,
      analysisUnavailable,
      peopleAlsoAsk: (searchData.peopleAlsoAsk || []).map((q) => {
        const a = answers.find((x) => x.question === q.question);
        return a ? { ...q, answer: a.answer, tip: a.tip } : q;
      }),
    };
    await updateSession(sessionId, { marketIntelligence: marketIntel });

    // ─── STAGE 5: Strategic diagnosis ───
    await updateStatus(sessionId, "diagnosing", "Putting your diagnosis together...");
    const diagnosis = await generateDiagnosis(companyIntel, research.competitors, marketIntel, input);
    if (diagnosis) await updateSession(sessionId, { diagnosis });

    // ─── DONE ───
    await updateStatus(sessionId, "ready", "Intelligence gathering complete. Ready for questions.");
    console.log(`[Pipeline] Session ${sessionId} complete: research ${research.research.status}, ${research.competitors.length} competitors.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Pipeline] Fatal error for session ${sessionId}:`, msg);
    await updateSession(sessionId, {
      status: "error",
      statusMessage: "An error occurred during intelligence gathering.",
      error: msg,
    });
  }
}

// ──────────────────────────────────────────────
// Route Handler
// ──────────────────────────────────────────────

export async function POST(request: Request) {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  try {
    const body = await request.json();
    const input = validateInput(body);

    if (!input) {
      return NextResponse.json(
        { error: "Invalid input. 'website' is required." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn("[Pipeline] GEMINI_API_KEY is not set — pipeline will operate using contextual demo mode.");
    }

    // Create session and start pipeline asynchronously
    const user = await getCurrentUser();
    const session = await createSession(input, user?.id);

    // Run pipeline in background (don't await — return immediately)
    runPipeline(session.id, input).catch((e) => {
      console.error("[Pipeline] Unhandled error:", e);
    });

    const response: GatherResponse = {
      sessionId: session.id,
      status: "crawling_company",
      message: "Intelligence gathering started. Poll /api/intelligence/status for progress.",
    };

    return NextResponse.json(response, { status: 202 }); // 202 Accepted
  } catch (error) {
    console.error("[API] /intelligence/gather error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
