/**
 * POST /api/intelligence/gather
 *
 * Main intelligence pipeline endpoint.
 * Receives onboarding data (9-question format) and orchestrates:
 * 1. Crawl company website (Crawl4AI with fetch fallback)
 * 2. Automatic Business Profiling (Industry, sub-industry, business model, audience, pricing, geography, confidence)
 * 3. Competitor Discovery Engine (8-12 search queries, SerpApi organic + ads, Tavily, 6-factor heuristic scoring, Transparency Center)
 * 4. Market Dynamics & Search Landscape (People Also Ask, keyword ads, shopping, messaging patterns)
 * 5. Strategic SWOT & Positioning Diagnosis
 * 6. Store everything in Supabase persistent store & in-memory cache
 *
 * Returns immediately with a sessionId (202 Accepted).
 * Pipeline runs asynchronously — poll /api/intelligence/status for progress.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import type { OnboardingInput, GatherResponse } from "@/lib/intelligence/types";
import {
  createSession,
  updateSession,
  updateStatus,
} from "@/lib/intelligence/store";
import {
  crawlWebsite,
  crawlResultToText,
} from "@/lib/crawler/website-crawler";
import { buildBusinessProfile } from "@/lib/ai/business-profiler";
import { runCompetitorDiscoveryEngine } from "@/lib/research/competitor-engine";
import {
  analyzeMarket,
  answerBuyerQuestions,
  generateDiagnosis,
} from "@/lib/ai/gemini";

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
    // ─── STAGE 1: Crawl Company Website ───
    await updateStatus(sessionId, "crawling_company", "Crawling and extracting evidence from your website...");
    let companyCrawl;
    try {
      companyCrawl = await crawlWebsite(input.website);
    } catch (e) {
      console.error("[Pipeline] Company crawl failed:", e);
      companyCrawl = { pages: [], domain: "", totalPages: 0, crawledAt: new Date().toISOString() };
    }
    const companyText = crawlResultToText(companyCrawl);

    // ─── STAGE 2: Automatic Business Profiling ───
    await updateStatus(sessionId, "analyzing_company", "Synthesizing evidence-grounded business profile...");
    const companyIntel = await buildBusinessProfile(input, companyText);
    companyIntel.rawCrawlData = companyCrawl;
    input.companyName = companyIntel.name;

    await updateSession(sessionId, {
      companyIntelligence: companyIntel,
      onboardingInput: input,
    });

    // ─── STAGE 3: Competitor Discovery & Search Intelligence Engine ───
    await updateStatus(
      sessionId,
      "crawling_competitors",
      "Running 8-12 search query discovery pipeline across Google Search & Ads..."
    );

    const compEngineResult = await runCompetitorDiscoveryEngine(companyIntel);

    // Save verified competitors
    await updateSession(sessionId, {
      competitorIntelligence: compEngineResult.verifiedCompetitors,
    });

    // ─── STAGE 4: Gemini & Market Dynamics Synthesis ───
    await updateStatus(
      sessionId,
      "analyzing_market",
      "Analyzing competitive messaging patterns & buyer search intent..."
    );

    let marketResearchContext = `Company: ${companyIntel.name} in ${companyIntel.industry} (${companyIntel.subIndustry || ""})\n`;
    marketResearchContext += `Value Proposition: ${companyIntel.valueProposition}\n`;
    marketResearchContext += `Verified Competitors:\n${compEngineResult.verifiedCompetitors.slice(0, 5).map((c) => `• ${c.name} (${c.website}) [${c.category}]: ${c.description} - Pricing: ${c.pricing || "N/A"}`).join("\n")}\n\n`;

    if (compEngineResult.peopleAlsoAsk.length > 0) {
      marketResearchContext += `Google People Also Ask Questions:\n${compEngineResult.peopleAlsoAsk.map((p) => `• ${p.question}`).join("\n")}\n\n`;
    }

    if (compEngineResult.keywordAds.length > 0) {
      marketResearchContext += `Active Google Ads in Space:\n${compEngineResult.keywordAds.slice(0, 6).map((a) => `• [${a.advertiserName || a.displayedLink}] "${a.title}" - ${a.snippet}`).join("\n")}\n\n`;
    }

    // Answer the first buyer questions now (one call), so the search intel panel shows them instantly.
    const [marketIntel, paaAnswers] = await Promise.all([
      analyzeMarket(input, marketResearchContext),
      answerBuyerQuestions(
        compEngineResult.peopleAlsoAsk.slice(0, 8).map((p) => p.question),
        companyIntel
      ),
    ]);
    const answeredQuestions = compEngineResult.peopleAlsoAsk.map((p) => {
      const a = paaAnswers.find((x) => x.question === p.question);
      return a ? { ...p, answer: a.answer, tip: a.tip } : p;
    });

    // Merge comprehensive search signals into MarketIntelligence
    const enrichedMarketIntel = {
      ...marketIntel,
      googleAds: compEngineResult.keywordAds.slice(0, 8).map((a) => ({
        title: a.title,
        link: a.link,
        snippet: a.snippet,
        displayedLink: a.displayedLink,
      })),
      keywordAds: compEngineResult.keywordAds,
      shoppingResults: compEngineResult.shoppingResults,
      peopleAlsoAsk: answeredQuestions,
      organicKeywords: compEngineResult.organicKeywords.slice(0, 10).map((o) => ({
        position: o.position,
        title: o.title,
        link: o.link,
        snippet: o.snippet,
      })),
      generatedQueries: compEngineResult.generatedQueries,
      messagingPatterns: compEngineResult.messagingPatterns,
      strategicOpportunities: compEngineResult.strategicOpportunities,
      strategicThreats: compEngineResult.strategicThreats,
      collectedAt: new Date().toISOString(),
    };

    await updateSession(sessionId, {
      marketIntelligence: enrichedMarketIntel,
    });

    // ─── STAGE 5: Strategic Diagnosis ───
    await updateStatus(sessionId, "diagnosing", "Formulating competitive SWOT & positioning diagnosis...");
    const diagnosis = await generateDiagnosis(
      companyIntel,
      compEngineResult.verifiedCompetitors,
      enrichedMarketIntel,
      input
    );
    await updateSession(sessionId, { diagnosis });

    // ─── DONE ───
    await updateStatus(sessionId, "ready", "Intelligence gathering complete. Ready for questions.");
    console.log(`[Pipeline] Session ${sessionId} complete with ${compEngineResult.verifiedCompetitors.length} verified competitors.`);
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
