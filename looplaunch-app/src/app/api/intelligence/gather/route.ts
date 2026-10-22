/**
 * POST /api/intelligence/gather
 *
 * Main intelligence pipeline endpoint.
 * Receives onboarding data and orchestrates:
 * 1. Crawl company website
 * 2. Crawl competitor websites
 * 3. Market research (Tavily)
 * 4. Gemini structuring (company, competitors, market)
 * 5. Strategic diagnosis
 * 6. Store everything in the intelligence store
 *
 * Returns immediately with a sessionId.
 * Pipeline runs asynchronously — poll /api/intelligence/status for progress.
 */

import { NextResponse } from "next/server";
import type { OnboardingInput, GatherResponse } from "@/lib/intelligence/types";
import {
  createSession,
  updateSession,
  updateStatus,
} from "@/lib/intelligence/store";
import {
  crawlWebsite,
  crawlResultToText,
  crawlUrl,
} from "@/lib/crawler/website-crawler";
import {
  analyzeCompany,
  analyzeCompetitor,
  analyzeMarket,
  generateDiagnosis,
} from "@/lib/ai/gemini";
import { runMarketResearch } from "@/lib/research/tavily";

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

function validateInput(body: unknown): OnboardingInput | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  if (!data.companyName || typeof data.companyName !== "string") return null;
  if (!data.whatTheySell || typeof data.whatTheySell !== "string") return null;

  return {
    companyName: data.companyName as string,
    nameAndRole: (data.nameAndRole as string) || "",
    whatTheySell: (data.whatTheySell as string) || "",
    website: (data.website as string) || "",
    competitors: (data.competitors as string) || "",
    painPoint: (data.painPoint as string) || "",
    whyTheyreHere: Array.isArray(data.whyTheyreHere) ? data.whyTheyreHere as string[] : [],
  };
}

// ──────────────────────────────────────────────
// Pipeline Orchestrator (runs asynchronously)
// ──────────────────────────────────────────────

async function runPipeline(sessionId: string, input: OnboardingInput) {
  try {
    // ─── STAGE 1: Crawl Company Website ───
    await updateStatus(sessionId, "crawling_company", "Researching your website...");
    let companyCrawl;
    try {
      companyCrawl = await crawlWebsite(input.website);
    } catch (e) {
      console.error("[Pipeline] Company crawl failed:", e);
      companyCrawl = { pages: [], domain: "", totalPages: 0, crawledAt: new Date().toISOString() };
    }
    const companyText = crawlResultToText(companyCrawl);

    // ─── STAGE 2: Crawl Competitor Websites ───
    await updateStatus(sessionId, "crawling_competitors", "Researching your competitors...");
    const competitorNames = input.competitors
      .split(/[,\n]/)
      .map((c) => c.trim())
      .filter(Boolean);

    const competitorCrawls: { name: string; text: string }[] = [];
    for (const name of competitorNames.slice(0, 5)) {
      try {
        // If the name looks like a URL, crawl it directly
        const isUrl = name.includes(".") && !name.includes(" ");
        const url = isUrl
          ? name.startsWith("http") ? name : `https://${name}`
          : null;

        if (url) {
          const crawl = await crawlWebsite(url);
          competitorCrawls.push({ name, text: crawlResultToText(crawl) });
        } else {
          competitorCrawls.push({ name, text: "" });
        }
      } catch (e) {
        console.warn(`[Pipeline] Competitor crawl failed for ${name}:`, e);
        competitorCrawls.push({ name, text: "" });
      }
    }

    // ─── STAGE 3: Market Research (Tavily + SerpApi) ───
    await updateStatus(sessionId, "researching_market", "Analyzing market demand & competitor search footprint...");
    let marketResearchText = "";
    let rawTavilyResults: import("@/lib/intelligence/types").TavilySearchResult[] = [];
    try {
      const { allResults, summaryText } = await runMarketResearch(
        input.whatTheySell,
        input.painPoint,
        input.competitors
      );
      marketResearchText = summaryText;
      rawTavilyResults = allResults;
    } catch (e) {
      console.warn("[Pipeline] Market research failed:", e);
    }

    // Live SerpApi: Competitor Google Ads & Real search questions (PAA)
    let serpAds: Array<{ title: string; link: string; snippet?: string; displayedLink?: string }> = [];
    let serpQuestions: Array<{ question: string; snippet?: string; link?: string }> = [];
    let serpKeywords: Array<{ position: number; title: string; link: string; snippet?: string }> = [];

    try {
      const primaryCompetitor = competitorNames[0];
      const serpQuery = primaryCompetitor 
        ? `${primaryCompetitor} alternatives`
        : `${input.companyName || input.whatTheySell}`;
        
      const { searchGoogleIntelligence } = await import("@/lib/research/serpapi");
      const serpData = await searchGoogleIntelligence(serpQuery);

      if (serpData) {
        serpAds = serpData.ads;
        serpQuestions = serpData.peopleAlsoAsk;
        serpKeywords = serpData.organicResults;

        // Enhance Gemini's market research prompt with real Google search intent
        if (serpQuestions.length > 0) {
          const questionsSnippet = serpQuestions.map((q) => `• ${q.question}`).join("\n");
          marketResearchText += `\n\n### Real Google Search Questions from Buyers:\n${questionsSnippet}`;
        }
        if (serpAds.length > 0) {
          const adsSnippet = serpAds.map((ad) => `• [Ad] "${ad.title}" - ${ad.snippet}`).join("\n");
          marketResearchText += `\n\n### Active Google Ads in Category:\n${adsSnippet}`;
        }
      }
    } catch (e) {
      console.warn("[Pipeline] SerpApi intelligence gathering non-fatal error:", e);
    }

    // ─── STAGE 4: Gemini — Analyze Company ───
    await updateStatus(sessionId, "analyzing_company", "Building company intelligence profile...");
    const companyIntel = await analyzeCompany(input, companyText);
    await updateSession(sessionId, { companyIntelligence: companyIntel });

    // ─── STAGE 5: Gemini — Analyze Competitors ───
    await updateStatus(sessionId, "analyzing_competitors", "Analyzing competitive landscape...");
    const companyContext = `${companyIntel.name}: ${companyIntel.description}. Value prop: ${companyIntel.valueProposition}`;
    const competitorIntels = [];
    for (const comp of competitorCrawls) {
      try {
        const intel = await analyzeCompetitor(comp.name, comp.text, companyContext);
        competitorIntels.push(intel);
      } catch (e) {
        console.warn(`[Pipeline] Competitor analysis failed for ${comp.name}:`, e);
      }
    }
    await updateSession(sessionId, { competitorIntelligence: competitorIntels });

    // ─── STAGE 6: Gemini — Analyze Market ───
    // Raw Tavily results + SerpApi intelligence stored on marketIntelligence
    await updateStatus(sessionId, "analyzing_market", "Understanding market dynamics & search demand...");
    const marketIntel = await analyzeMarket(input, marketResearchText);
    await updateSession(sessionId, {
      marketIntelligence: {
        ...marketIntel,
        searchResults: rawTavilyResults,
        googleAds: serpAds,
        peopleAlsoAsk: serpQuestions,
        organicKeywords: serpKeywords,
      },
    });

    // ─── STAGE 7: Gemini — Strategic Diagnosis ───
    await updateStatus(sessionId, "diagnosing", "Generating strategic diagnosis...");
    const diagnosis = await generateDiagnosis(
      companyIntel,
      competitorIntels,
      marketIntel,
      input
    );
    await updateSession(sessionId, { diagnosis });

    // ─── DONE ───
    await updateStatus(sessionId, "ready", "Intelligence gathering complete. Ready for questions.");
    console.log(`[Pipeline] Session ${sessionId} complete.`);
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
        { error: "Invalid input. 'website' and 'companyDescription' are required." },
        { status: 400 }
      );
    }

    // Log warning if Gemini is using fallback mode
    if (!process.env.GEMINI_API_KEY) {
      console.warn("[Pipeline] GEMINI_API_KEY is not set — pipeline will operate using contextual demo mode.");
    }

    // Create session and start pipeline asynchronously
    const session = await createSession(input);

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
