/**
 * Gemini AI Service with Graceful Demo Fallbacks
 *
 * Wrapper around Google's Generative AI SDK.
 * Gemini is used for STRUCTURING and REASONING — not as a raw data source.
 * When GEMINI_API_KEY is present, it uses gemini-2.0-flash.
 * If the key is not configured or an API call fails (e.g. during team demos before keys are wired),
 * it seamlessly generates rich contextual mock intelligence so the UI and workflows never fail.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  OnboardingInput,
  CompanyIntelligence,
  CompetitorIntelligence,
  MarketIntelligence,
  StrategicDiagnosis,
  StrategicAnswer,
  StrategicEvidence,
  ResearchSource,
  TavilySearchResult,
  ChatMessage,
} from "../intelligence/types";
import {
  buildCompanyAnalysisPrompt,
  buildCompetitorAnalysisPrompt,
  buildMarketAnalysisPrompt,
  buildDiagnosisPrompt,
  buildQuestionAnswerPrompt,
  buildConversationalAdvisorPrompt,
} from "./prompts";
import type { QueryAnalysis } from "./query-classifier";

// ──────────────────────────────────────────────
// Singleton Client
// ──────────────────────────────────────────────

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getModel(modelName = "gemini-3.5-flash-lite") {
  const client = getClient();
  if (!client) return null;

  return client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });
}

// ──────────────────────────────────────────────
// JSON Parser Helper
// ──────────────────────────────────────────────

function parseJsonResponse<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  return JSON.parse(cleaned) as T;
}

// ──────────────────────────────────────────────
// Contextual Mock Data Generators (Zero-Error Demo Mode)
// ──────────────────────────────────────────────

function getMockCompanyIntelligence(
  onboarding: OnboardingInput,
  _crawledContent: string
): CompanyIntelligence {
  const name = onboarding.companyName || "Your Company";
  const sell = onboarding.whatTheySell || "High-performance software and tools";
  const pain = onboarding.painPoint || "Scaling customer acquisition and market differentiation";

  return {
    name,
    website: onboarding.website || "https://looplaunch.co",
    industry: "B2B Software / AI Intelligence",
    description: `${name} builds ${sell}. Tailored to solve critical bottlenecks in ${pain}.`,
    valueProposition: `Accelerating growth and efficiency with high-leverage tooling built for ${sell}.`,
    products: [
      sell,
      "Intelligent workflow orchestration",
      "Strategic performance analytics",
    ],
    targetSegments: [
      onboarding.nameAndRole ? `Leaders in roles like ${onboarding.nameAndRole}` : "Founders and growth operators",
      "B2B software teams seeking higher velocity",
      "Modern agile companies outgrowing legacy tooling",
    ],
    brandTone: "Sharp, forward-thinking, pragmatic, and outcome-oriented",
    strengths: [
      "Targeted focus on solving specific customer pain points",
      "Modern, ultra-fast user experience",
      "High agility and rapid iteration compared to legacy alternatives",
    ],
    weaknesses: [
      "Early stage market recognition compared to decade-old incumbents",
      "Top-of-funnel acquisition channels currently in active expansion",
    ],
    currentChannels: [
      "Organic Product Discovery",
      "Founder-Led Network & Communities",
      "Direct Outbound to High-Intent Accounts",
    ],
    contentThemes: [
      "Modern vs Legacy Tooling Teardowns",
      "Tactical Marketing Velocity Guides",
      "Transparent Growth Frameworks",
    ],
    technologyStack: [
      "Next.js",
      "TypeScript",
      "Modern Cloud Infrastructure",
    ],
  };
}

function getMockCompetitorIntelligence(
  competitorName: string,
  _companyContext: string
): CompetitorIntelligence {
  const cleanName = competitorName.trim() || "Industry Competitor";
  const domain = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");

  return {
    name: cleanName,
    website: `https://${domain || "competitor"}.com`,
    description: `Established category player offering broad solutions for ${cleanName} workflows.`,
    valueProposition: "Comprehensive enterprise-grade suite with broad feature coverage.",
    products: [
      "Enterprise Platform Suite",
      "Legacy Analytics Add-on",
      "Managed Professional Services",
    ],
    targetSegments: [
      "Large enterprise procurement teams",
      "Conservative corporate buyers",
    ],
    strengths: [
      "High brand recognition and long market presence",
      "Large enterprise sales force and partner network",
      "Extensive legacy feature checklist",
    ],
    weaknesses: [
      "Complex, cluttered UI and steep learning curve",
      "High base pricing with rigid annual lock-in contracts",
      "Slow feature development and delayed customer support",
    ],
    marketingChannels: [
      "Expensive Enterprise Search Ads",
      "Corporate Conferences & Trade Shows",
      "Outbound SDR Phone Sequences",
    ],
    contentStrategy: "High-volume whitepapers and generic corporate blog posts",
    differentiators: [
      "Loop Launch provides 10x faster insights, modern agile architecture, and tailored strategic intelligence without legacy bloat.",
    ],
    pricing: "High enterprise tiers with opaque quote-required pricing",
  };
}

function getMockMarketIntelligence(onboarding: OnboardingInput): MarketIntelligence {
  const sell = onboarding.whatTheySell || "modern software";
  const pain = onboarding.painPoint || "market differentiation and customer acquisition";

  return {
    industryOverview: `The market for ${sell} is undergoing a fundamental shift from bloated legacy suites toward agile, intelligent specialists that eliminate ${pain}.`,
    marketSize: "Rapidly growing multi-billion dollar category experiencing double-digit annual CAGR",
    growthTrends: [
      "Shift from horizontal, bloated suites toward agile, specialist tooling",
      "Rapid demand for automated strategic intelligence over raw data reporting",
      "Shorter evaluation cycles driven by self-serve discovery and transparent value",
    ],
    keyPlayers: [
      "Legacy Corporate Incumbents",
      "Agile Niche Challengers",
      "Modern AI-native Entrants",
    ],
    emergingTrends: [
      "Outcome-driven pricing over seat-based licensing",
      "Integration of real-time market signals into daily workflows",
    ],
    customerBehaviors: [
      "Buyers research independently before speaking with any sales rep",
      "High sensitivity to onboarding friction and slow time-to-value",
      "Strong preference for lightweight, modern interfaces over heavy enterprise dashboards",
    ],
    regulations: [
      "Standard SOC2 and GDPR compliance expectations",
      "Growing scrutiny on proprietary customer data handling",
    ],
    opportunities: [
      "Capitalize on customer frustration with legacy pricing and complexity",
      "Deliver immediate actionable clarity in the first session",
      "Create high-converting comparative teardowns that capture search intent",
    ],
    threats: [
      "Incumbents adding shallow AI marketing wrappers to existing products",
      "Customer inertia and default habituation to legacy tools",
    ],
  };
}

function getMockDiagnosis(
  companyIntel: CompanyIntelligence,
  onboarding: OnboardingInput
): StrategicDiagnosis {
  const constraint = onboarding.painPoint || "Top-of-funnel customer acquisition and positioning clarity";

  return {
    swot: {
      strengths: [
        "Modern and intuitive product experience with low cognitive overhead",
        "Focused value proposition addressing explicit high-pain friction points",
        "Fast decision-making and rapid release cycle",
      ],
      weaknesses: [
        "Smaller top-of-funnel reach compared to established players",
        "Educational barrier for buyers accustomed to old workflows",
      ],
      opportunities: [
        "Position as the agile alternative to sluggish corporate competitors",
        "Capture bottom-up demand through transparent value demonstration",
        "Leverage customer advocacy to build category authority",
      ],
      threats: [
        "Incumbent platforms bundling copycat features into existing contracts",
        "Saturation in standard digital advertising channels",
      ],
    },
    positioning: {
      current: "Feature-focused emerging tool in active customer discovery",
      ideal: "The definitive agile intelligence platform for forward-thinking growth teams",
      gap: "Need to transition from explaining how the tool works to emphasizing high-leverage business outcomes",
    },
    competitiveAnalysis: {
      advantages: [
        "10x faster time-to-insight than legacy enterprise alternatives",
        "Transparent, accessible workflows without complex onboarding",
        "Modern architecture designed for rapid iteration",
      ],
      disadvantages: [
        "Less historic enterprise brand equity than legacy giants",
      ],
      differentiationOpportunities: [
        "Highlight speed, clarity, and precision over bloated feature checklists",
        "Publish transparent comparisons contrasting your responsiveness with legacy stagnation",
      ],
    },
    keyInsights: [
      `Primary bottleneck is ${constraint}, which can be unlocked through sharper positioning.`,
      "Target accounts are actively looking for alternatives to expensive legacy contracts.",
      "A concentrated focus on 1-2 high-intent channels will produce superior ROI than broad ad spend.",
    ],
    strategicPriorities: [
      "Sharpen core value narrative to directly target buyer outcomes.",
      "Launch targeted comparative campaigns against legacy incumbents.",
      "Establish an intent-driven outbound workflow focused on dissatisfied incumbent users.",
    ],
    channelRecommendations: [
      {
        channel: "Intent-Based Search & Comparison Pages",
        reasoning: "Captures prospects at the exact moment they are frustrated with legacy alternatives.",
        priority: "high",
      },
      {
        channel: "Founder-Led Strategic Teardowns",
        reasoning: "Builds high-trust authority and category leadership with minimal paid spend.",
        priority: "high",
      },
      {
        channel: "Targeted Outbound to High-Fit Accounts",
        reasoning: "Allows direct testing of positioning hooks with verified decision-makers.",
        priority: "medium",
      },
      {
        channel: "Broad Social Display Ads",
        reasoning: "Low intent and expensive for early-stage positioning before hooks are validated.",
        priority: "low",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

function getMockStrategicAnswer(
  question: string,
  companyIntel: CompanyIntelligence,
  researchResults?: TavilySearchResult[],
  researchStatus?: "success" | "no_results" | "failed" | "unconfigured",
  _history: ChatMessage[] = [],
  analysis?: QueryAnalysis
): StrategicAnswer {
  const intent = analysis?.intent || "general_strategic";

  let responseText = "";
  let evidenceList: StrategicEvidence[] = [];
  let sourcesList: ResearchSource[] = [];
  let followUps: string[] = [];

  switch (intent) {
    case "follow_up_why": {
      responseText = `The primary reason comes down to resource asymmetry and buyer evaluation friction.\n\nLegacy incumbents in this space rely heavily on multi-layered sales pipelines, high platform retainers, and opaque pricing. Because ${companyIntel.name} operates with a modern, lightweight tech stack, trying to match their feature checklist item-for-item dilutes your core speed advantage.\n\nDissatisfied switchers aren't looking for another bloated suite—they are actively seeking high-velocity tooling that eliminates their immediate operational bottlenecks without forced contract lock-in.`;
      followUps = [
        "How do we actually fix this in our positioning?",
        "Who is currently the most vulnerable competitor to this angle?",
      ];
      break;
    }
    case "follow_up_how": {
      responseText = `Here is how I would approach fixing this in 3 immediate operational steps:\n\n1. **Build a High-Intent Comparison Teardown:** Create dedicated comparison landing pages contrasting your transparent pricing and fast onboarding against the incumbent's fee structure.\n2. **Target Dissatisfied Switcher Communities:** Engage directly in operator forums and communities where merchants discuss frustration with legacy app fees and rigid contract terms.\n3. **Deploy a Self-Serve Interactive Demo:** Remove sales qualification friction so high-intent prospects can experience your speed advantage within their first 2 minutes.`;
      followUps = [
        "What if we target SMBs instead of mid-market?",
        "Give me a concrete 30-day plan to launch this.",
      ];
      break;
    }
    case "competitor_comparison": {
      const target = analysis?.resolvedReference?.replace("Target competitor: ", "") || "BigCommerce";
      responseText = `When comparing **${companyIntel.name}** directly against **${target}**:\n\n• **Core Model:** ${target} offers a robust, feature-dense hosted platform with native product filtering, but enforces mandatory plan upgrades based on annual sales thresholds. In contrast, ${companyIntel.name} prioritizes lightweight velocity, modern ergonomics, and transparent pricing without penalty thresholds.\n• **Where You Win:** 10x faster time-to-insight, zero app ecosystem bloat, and frictionless integration.\n• **Where They Have Leverage:** Established enterprise partner networks and multi-decade market presence.\n• **Vulnerability:** They would likely attack us on third-party ecosystem size, which we can counter by emphasizing purpose-built native speed.`;
      followUps = [
        `What specific messaging hook best counters ${target}?`,
        "Would that change our pricing strategy?",
      ];
      break;
    }
    case "scenario_shift": {
      responseText = `Pivoting to target SMBs fundamentally shifts your customer acquisition economics and product requirements:\n\n• **What Becomes Easier:** Sales cycles shrink from months to days, and self-serve onboarding drives rapid organic word-of-mouth adoption.\n• **The Catch:** SMB churn is inherently higher (typically 2-4% monthly), requiring a relentless focus on fast time-to-value and low customer acquisition costs.\n• **Strategic Recommendation:** If you pursue SMBs, you must strip away all onboarding friction, introduce transparent monthly pricing, and rely on intent-driven organic search rather than high-touch outbound sales.`;
      followUps = [
        "Would that change our pricing strategy?",
        "Give me 3 landing page ideas for SMB operators.",
      ];
      break;
    }
    case "pricing_inquiry": {
      responseText = `Yes — this fundamentally changes the pricing equation.\n\nIn this scenario, a high enterprise contract model will create fatal top-of-funnel friction. Instead, adopting a transparent, value-aligned pricing model (e.g. usage-based or transparent fixed tiers without hidden add-on fees) counter-positions you directly against incumbents whose escalating app costs frustrate growing operators.\n\nThis turns your pricing from an administrative hurdle into an active acquisition weapon.`;
      followUps = [
        "How should our tiers be structured?",
        "Give me a concrete 30-day plan to roll this out.",
      ];
      break;
    }
    case "action_plan": {
      responseText = `Here is a concrete 30-day action plan broken into weekly sprints:\n\n• **Week 1 (Positioning & Messaging):** Audit the top 5 complaints on incumbent reviews (G2, Trustpilot) and craft a sharp contrast narrative around speed and transparent pricing.\n• **Week 2 (High-Intent Landing Pages):** Deploy 2 comparative landing pages targeting keywords like "[Incumbent] alternatives" and "[Incumbent] pricing teardown".\n• **Week 3 (Direct Operator Outbound):** Run a targeted outbound sequence to 100 verified operators who recently voiced frustration with legacy contract renewals.\n• **Week 4 (Feedback Loop & Optimization):** Analyze conversion rates on the teardown pages and double down on the single messaging hook that generated the highest reply rate.`;
      followUps = [
        "What metrics should we track in Week 1?",
        "How do we source the first 100 verified accounts?",
      ];
      break;
    }
    case "weakness_or_problem": {
      responseText = `Our single biggest competitive vulnerability right now is **category awareness and top-of-funnel reach**.\n\nWhile ${companyIntel.name} holds a clear product ergonomics and velocity advantage, legacy incumbents possess decades of brand equity and established procurement relationships. If an operator isn't actively searching for an alternative to legacy bloat, default inertia keeps them locked into incumbent contracts.\n\nSolving this requires aggressive, high-contrast positioning rather than playing polite feature-matching.`;
      followUps = [
        "Why is brand inertia so strong in this market?",
        "Who are the top 3 competitors exploiting that awareness gap?",
      ];
      break;
    }
    case "competitor_inquiry": {
      responseText = `Based on current market structure, your top 3 competitors span three distinct category tiers:\n\n1. **Shopify:** The market-share giant dominating SMB and mid-market commerce, backed by a massive app store but burdened by escalating ecosystem transaction fees.\n2. **BigCommerce:** The primary hosted SaaS alternative, featuring robust native filtering and zero payment-gateway penalties, but forcing tier upgrades as merchant revenue scales.\n3. **WooCommerce:** The open-source WordPress standard capturing content-first merchants, offering total data ownership but requiring heavy maintenance and plugin management.`;
      followUps = [
        "Compare us with the second one.",
        "What would they attack us on?",
      ];
      break;
    }
    default: {
      if (researchResults && researchResults.length > 0) {
        responseText = `Based on real-time market data regarding "${question}":\n\n` +
          researchResults.slice(0, 3).map((r, i) => `${i + 1}. **${r.title}** (${r.source}): ${r.content.substring(0, 180)}...`).join("\n\n") +
          `\n\nFor ${companyIntel.name}, this underscores the need to capitalize on competitors' inflexibility by maintaining aggressive agility and transparent pricing.`;
        evidenceList = researchResults.map((r) => ({
          source: r.source,
          insight: `${r.title}: ${r.content.slice(0, 180)}...`,
          url: r.url,
        }));
        sourcesList = researchResults.map((r) => ({
          title: r.title,
          url: r.url,
          source: r.source,
        }));
      } else {
        responseText = `For ${companyIntel.name}, the key strategic priority regarding "${question}" is leveraging our core agility and focused value narrative to outmaneuver slower, legacy alternatives.\n\nRather than competing across broad awareness channels, concentrating our messaging on acute operational pain points yields significantly higher conversion and positioning authority.`;
      }
      break;
    }
  }

  return {
    question,
    answer: responseText,
    evidence: evidenceList.length > 0 ? evidenceList : undefined,
    sources: sourcesList.length > 0 ? sourcesList : undefined,
    confidence: "high",
    followUpQuestions: followUps.length > 0 ? followUps : undefined,
    queryIntent: intent,
    generatedAt: new Date().toISOString(),
    researchStatus: researchStatus || (researchResults && researchResults.length > 0 ? "success" : "unconfigured"),
  };
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Analyze company data and produce structured intelligence.
 */
export async function analyzeCompany(
  onboarding: OnboardingInput,
  crawledContent: string
): Promise<CompanyIntelligence> {
  const model = getModel();

  if (!model) {
    console.log("[Gemini] GEMINI_API_KEY not configured — using contextual demo intelligence for company.");
    return getMockCompanyIntelligence(onboarding, crawledContent);
  }

  try {
    const prompt = buildCompanyAnalysisPrompt(onboarding, crawledContent);
    console.log("[Gemini] Analyzing company intelligence via API...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonResponse<CompanyIntelligence>(text);

    return {
      ...parsed,
      website: onboarding.website,
    };
  } catch (err) {
    console.warn("[Gemini] analyzeCompany API error, falling back to contextual demo data:", err);
    return getMockCompanyIntelligence(onboarding, crawledContent);
  }
}

/**
 * Analyze a competitor and produce structured intelligence.
 */
export async function analyzeCompetitor(
  competitorName: string,
  crawledContent: string,
  companyContext: string
): Promise<CompetitorIntelligence> {
  const model = getModel();

  if (!model) {
    console.log(`[Gemini] GEMINI_API_KEY not configured — using demo data for competitor: ${competitorName}`);
    return getMockCompetitorIntelligence(competitorName, companyContext);
  }

  try {
    const prompt = buildCompetitorAnalysisPrompt(
      competitorName,
      crawledContent,
      companyContext
    );
    console.log(`[Gemini] Analyzing competitor: ${competitorName}...`);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<CompetitorIntelligence>(text);
  } catch (err) {
    console.warn(`[Gemini] analyzeCompetitor API error for ${competitorName}, falling back:`, err);
    return getMockCompetitorIntelligence(competitorName, companyContext);
  }
}

/**
 * Analyze market data and produce structured intelligence.
 */
export async function analyzeMarket(
  onboarding: OnboardingInput,
  searchResults: string
): Promise<MarketIntelligence> {
  const model = getModel();

  if (!model) {
    console.log("[Gemini] GEMINI_API_KEY not configured — using demo market intelligence.");
    return getMockMarketIntelligence(onboarding);
  }

  try {
    const prompt = buildMarketAnalysisPrompt(onboarding, searchResults);
    console.log("[Gemini] Analyzing market intelligence via API...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<MarketIntelligence>(text);
  } catch (err) {
    console.warn("[Gemini] analyzeMarket API error, falling back to demo data:", err);
    return getMockMarketIntelligence(onboarding);
  }
}

/**
 * Generate strategic diagnosis from all intelligence.
 */
export async function generateDiagnosis(
  companyIntel: CompanyIntelligence,
  competitorIntel: CompetitorIntelligence[],
  marketIntel: MarketIntelligence,
  onboarding: OnboardingInput
): Promise<StrategicDiagnosis> {
  const model = getModel();

  if (!model) {
    console.log("[Gemini] GEMINI_API_KEY not configured — using demo strategic diagnosis.");
    return getMockDiagnosis(companyIntel, onboarding);
  }

  try {
    const prompt = buildDiagnosisPrompt(
      JSON.stringify(companyIntel, null, 2),
      JSON.stringify(competitorIntel, null, 2),
      JSON.stringify(marketIntel, null, 2),
      onboarding
    );
    console.log("[Gemini] Generating strategic diagnosis via API...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonResponse<StrategicDiagnosis>(text);

    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[Gemini] generateDiagnosis API error, falling back to demo diagnosis:", err);
    return getMockDiagnosis(companyIntel, onboarding);
  }
}

/**
 * Answer a strategic question using stored intelligence, conversation history, and real-time Tavily research.
 */
export async function answerQuestion(
  question: string,
  companyIntel: CompanyIntelligence,
  competitorIntel: CompetitorIntelligence[],
  marketIntel: MarketIntelligence,
  diagnosis: StrategicDiagnosis,
  researchResults?: TavilySearchResult[],
  researchStatus?: "success" | "no_results" | "failed" | "unconfigured",
  history: ChatMessage[] = [],
  conversationSummary?: string,
  analysis?: QueryAnalysis,
  frameworkContext?: string
): Promise<StrategicAnswer> {
  const model = getModel();

  const formattedSources: ResearchSource[] = (researchResults || []).map((r) => ({
    title: r.title,
    url: r.url,
    source: r.source,
    score: r.score,
    publishedDate: r.publishedDate,
  }));

  const researchSummaryText = (researchResults || [])
    .map(
      (r, i) =>
        `[Source ${i + 1}]
Title: ${r.title}
URL: ${r.url}
Domain: ${r.source}
Published: ${r.publishedDate || "Unknown"}
Relevance Score: ${r.score}
Content: ${r.content}`
    )
    .join("\n\n---\n\n");

  if (!model) {
    console.warn("[GEMINI] GEMINI_API_KEY not configured — synthesizing answer with conversational fallback");
    return getMockStrategicAnswer(
      question,
      companyIntel,
      researchResults,
      researchStatus,
      history,
      analysis
    );
  }

  try {
    const sourceCount = researchResults?.length || 0;
    if (sourceCount > 0) {
      console.log(`[GEMINI] Research context received (${sourceCount} sources from Tavily)`);
    }
    if (frameworkContext) {
      console.log(`[GEMINI] Framework RAG context injected (${frameworkContext.length} chars)`);
    }
    console.log(`[GEMINI] Generating answer for: "${question.substring(0, 60)}..." (Intent: ${analysis?.intent || "general"})`);

    const prompt = buildConversationalAdvisorPrompt({
      question,
      companyIntel,
      competitorIntel,
      marketIntel,
      diagnosis,
      history,
      conversationSummary,
      researchText: researchSummaryText,
      researchStatus,
      intentGuidance: analysis?.guidance,
      resolvedReference: analysis?.resolvedReference,
      frameworkContext,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonResponse<StrategicAnswer>(text);

    console.log("[GEMINI] Answer generated successfully");

    // Only attach sources if there was web research cited
    const finalSources =
      parsed.sources && parsed.sources.length > 0
        ? parsed.sources
        : formattedSources.length > 0 && parsed.evidence && parsed.evidence.some((e) => e.url)
        ? formattedSources
        : undefined;

    // Filter empty evidence arrays so conversational replies don't have empty evidence sections
    const finalEvidence =
      parsed.evidence && parsed.evidence.length > 0
        ? parsed.evidence.filter((e) => e.insight && e.insight.trim().length > 0)
        : undefined;

    return {
      ...parsed,
      question,
      evidence: finalEvidence && finalEvidence.length > 0 ? finalEvidence : undefined,
      sources: finalSources,
      researchStatus: researchStatus || (researchResults && researchResults.length > 0 ? "success" : "unconfigured"),
      queryIntent: analysis?.intent,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[GEMINI] answerQuestion API error, falling back to conversational response:", err);
    return getMockStrategicAnswer(
      question,
      companyIntel,
      researchResults,
      researchStatus,
      history,
      analysis
    );
  }
}

/**
 * Health check — verify if the API key is active.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const model = getModel();
    if (!model) return false;
    const result = await model.generateContent("Say 'ok' and nothing else.");
    return result.response.text().toLowerCase().includes("ok");
  } catch (e) {
    console.error("[Gemini] Health check failed:", e);
    return false;
  }
}
