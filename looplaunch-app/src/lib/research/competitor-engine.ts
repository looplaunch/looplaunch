/**
 * Competitor Discovery & Verification Engine
 *
 * Implements an industry-aware research pipeline:
 * 1. Generates 8–12 targeted search queries based on the business profile.
 * 2. Uses SerpApi (Google search, Google Ads, Google Shopping) and Tavily to collect live results.
 * 3. Extracts candidate competitor names and normalized domains.
 * 4. Deduplicates candidates and filters out non-commercial entities (social, wikis, portals).
 * 5. Investigates candidate offerings from collected evidence and snippets.
 * 6. Scores competitors using a 6-factor heuristic (0–100):
 *    - Product similarity (0–30)
 *    - Audience overlap (0–20)
 *    - Business model alignment (0–15)
 *    - Geography match (0–10)
 *    - Search intent presence (0–15)
 *    - Pricing tier compatibility (0–10)
 * 7. Categorizes candidates: direct, indirect, marketplace, publisher, or irrelevant.
 * 8. Queries Google Ads Transparency Center for verified competitors.
 * 9. Extracts common market messaging patterns and strategic opportunities.
 */

import {
  searchGoogleIntelligence,
  searchKeywordAds,
  searchAdvertiserTransparency,
  searchGoogleShopping,
  type GoogleAd,
  type PeopleAlsoAskQuestion,
  type OrganicSearchResult,
} from "./serpapi";
import { runMarketResearch } from "./tavily";
import type {
  CompanyIntelligence,
  CompetitorIntelligence,
  CompetitorCategory,
  CompetitorScoreBreakdown,
  KeywordAdResult,
  ShoppingProduct,
  SearchQuerySignal,
  AdvertiserAdCreative,
} from "../intelligence/types";

// Known aggregators / marketplaces
const KNOWN_MARKETPLACES = new Set([
  "amazon.com",
  "etsy.com",
  "ebay.com",
  "walmart.com",
  "target.com",
  "capterra.com",
  "g2.com",
  "softwareadvice.com",
  "trustpilot.com",
  "getapp.com",
  "producthunt.com",
  "appsumo.com",
  "shopify.com/app-store",
  "apps.shopify.com",
]);

// Known editorial publishers / blogs / review sites
const KNOWN_PUBLISHERS = new Set([
  "forbes.com",
  "techcrunch.com",
  "theverge.com",
  "wired.com",
  "businessinsider.com",
  "nerdwallet.com",
  "investopedia.com",
  "zdnet.com",
  "pcmag.com",
  "hubspot.com/blog",
  "zapier.com/blog",
  "wirecutter.com",
  "nytimes.com",
  "medium.com",
  "substack.com",
]);

// Non-competitor platforms (social media, search engines, encyclopedias)
const IGNORED_DOMAINS = new Set([
  "google.com",
  "google.co.uk",
  "google.ca",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "reddit.com",
  "pinterest.com",
  "tiktok.com",
  "wikipedia.org",
  "apple.com",
  "microsoft.com",
  "github.com",
  "quora.com",
  "yelp.com",
  "glassdoor.com",
  "indeed.com",
]);

function normalizeDomain(urlOrDomain: string): string {
  try {
    let raw = urlOrDomain.trim();
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      raw = `https://${raw}`;
    }
    const hostname = new URL(raw).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return urlOrDomain.toLowerCase().replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

function extractBrandName(title: string, domain: string): string {
  if (title) {
    const parts = title.split(/[|\-–—:]/);
    if (parts.length > 1) {
      const candidate = parts[0].trim();
      if (candidate.length >= 2 && candidate.length <= 35) return candidate;
    }
  }
  const clean = domain.split(".")[0];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// ──────────────────────────────────────────────
// 1. Generate 8–12 Targeted Search Queries
// ──────────────────────────────────────────────

export function generateDiscoveryQueries(profile: CompanyIntelligence): SearchQuerySignal[] {
  const brand = profile.name || "brand";
  const core = profile.products[0] || profile.valueProposition || "product";
  const industry = profile.industry || "software";
  const audience = profile.targetSegments[0] || "buyers";
  const geo = profile.geography && profile.geography !== "unspecified" ? profile.geography : "";

  const queries: SearchQuerySignal[] = [
    // 1. High-intent commercial queries
    {
      query: `best ${core} ${geo}`.trim(),
      intent: "commercial",
    },
    {
      query: `top ${core} tools for ${audience}`.trim(),
      intent: "commercial",
    },
    {
      query: `${core} software buy online`.trim(),
      intent: "commercial",
    },

    // 2. Direct competitor & alternative queries
    {
      query: `${brand} alternatives and competitors`.trim(),
      intent: "brand_alternative",
    },
    {
      query: `top alternatives to ${core}`.trim(),
      intent: "brand_alternative",
    },
    {
      query: `leading competitors in ${industry}`.trim(),
      intent: "brand_alternative",
    },

    // 3. Category & sub-industry queries
    {
      query: `${industry} platforms for ${audience}`.trim(),
      intent: "category",
    },
    {
      query: `${profile.subIndustry || industry} market leaders`.trim(),
      intent: "category",
    },

    // 4. Pain-point / solution queries
    {
      query: `how to solve ${profile.weaknesses?.[0] || "scaling"} with ${core}`.trim(),
      intent: "solution_pain",
    },
    {
      query: `${core} for ${audience} reviews comparison`.trim(),
      intent: "solution_pain",
    },

    // 5. Pricing & transactional queries
    {
      query: `${core} pricing plans cost`.trim(),
      intent: "pricing",
    },
  ];

  return queries.slice(0, 11);
}

// ──────────────────────────────────────────────
// 2. Candidate Domain Collector & Scorer
// ──────────────────────────────────────────────

interface RawCandidate {
  domain: string;
  name: string;
  url: string;
  snippets: string[];
  titles: string[];
  discoveryQueries: Set<string>;
  organicRankings: Array<{ query: string; position: number; title: string; link: string; snippet?: string }>;
  sponsoredRankings: Array<{ query: string; position: number; title: string; link: string; snippet?: string }>;
}

export interface CompetitorEngineResult {
  verifiedCompetitors: CompetitorIntelligence[];
  keywordAds: KeywordAdResult[];
  shoppingResults: ShoppingProduct[];
  peopleAlsoAsk: PeopleAlsoAskQuestion[];
  organicKeywords: OrganicSearchResult[];
  generatedQueries: SearchQuerySignal[];
  messagingPatterns: Array<{ theme: string; frequency: number; examples: string[] }>;
  strategicOpportunities: string[];
  strategicThreats: string[];
}

export async function runCompetitorDiscoveryEngine(
  profile: CompanyIntelligence
): Promise<CompetitorEngineResult> {
  const userDomain = normalizeDomain(profile.website || "");
  const queries = generateDiscoveryQueries(profile);
  const userLocation = profile.geography && profile.geography !== "unspecified" ? profile.geography : "United States";

  console.log(`[CompetitorEngine] Starting research for ${profile.name} (${userDomain}) with ${queries.length} queries`);

  const rawCandidates = new Map<string, RawCandidate>();
  const collectedAds: KeywordAdResult[] = [];
  const collectedPaa: PeopleAlsoAskQuestion[] = [];
  const collectedOrganic: OrganicSearchResult[] = [];
  const collectedShopping: ShoppingProduct[] = [];

  // Helper to record candidate
  const recordCandidate = (
    url: string,
    title: string,
    snippet: string,
    query: string,
    isAd: boolean,
    position: number
  ) => {
    const domain = normalizeDomain(url);
    if (!domain || domain === userDomain || IGNORED_DOMAINS.has(domain)) {
      return;
    }

    if (!rawCandidates.has(domain)) {
      rawCandidates.set(domain, {
        domain,
        name: extractBrandName(title, domain),
        url: `https://${domain}`,
        snippets: [],
        titles: [],
        discoveryQueries: new Set<string>(),
        organicRankings: [],
        sponsoredRankings: [],
      });
    }

    const candidate = rawCandidates.get(domain)!;
    candidate.discoveryQueries.add(query);
    if (snippet && !candidate.snippets.includes(snippet)) candidate.snippets.push(snippet);
    if (title && !candidate.titles.includes(title)) candidate.titles.push(title);

    if (isAd) {
      candidate.sponsoredRankings.push({ query, position, title, link: url, snippet });
    } else {
      candidate.organicRankings.push({ query, position, title, link: url, snippet });
    }
  };

  // ── Execute Search Queries in Bounded Parallel Batches ──
  // 3 queries per batch to avoid overwhelming rate limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const searchPromises = batch.map(async (qSig) => {
      const q = qSig.query;
      try {
        // Run Google Search (Organic + PAA + Ads)
        const serp = await searchGoogleIntelligence(q, { location: userLocation });
        if (serp) {
          qSig.totalOrganicResults = serp.organicResults.length;
          qSig.totalAds = serp.ads.length;

          // Record Ads
          for (const ad of serp.ads) {
            recordCandidate(ad.link || ad.displayedLink || "", ad.title, ad.snippet || "", q, true, ad.position);
          }

          // Record PAA
          for (const paa of serp.peopleAlsoAsk) {
            if (!collectedPaa.some((p) => p.question.toLowerCase() === paa.question.toLowerCase())) {
              collectedPaa.push(paa);
            }
          }

          // Record Organic
          for (const org of serp.organicResults) {
            recordCandidate(org.link, org.title, org.snippet || "", q, false, org.position);
            collectedOrganic.push(org);
          }

          // Record Shopping if available
          if (serp.shoppingResults) {
            for (const sp of serp.shoppingResults) {
              if (!collectedShopping.some((s) => s.link === sp.link)) {
                collectedShopping.push(sp);
              }
            }
          }
        }

        // Run dedicated Keyword Ads search
        const kwAds = await searchKeywordAds(q, { location: userLocation });
        for (const ad of kwAds) {
          collectedAds.push(ad);
          recordCandidate(ad.link || ad.displayedLink || "", ad.title, ad.snippet || "", q, true, ad.position);
        }
      } catch (err) {
        console.warn(`[CompetitorEngine] Error executing query "${q}":`, err);
      }
    });

    await Promise.allSettled(searchPromises);
  }

  // Supplementary Tavily market search
  try {
    const tavilyData = await runMarketResearch(
      `${profile.industry} ${profile.products[0] || ""}`,
      profile.targetSegments[0] || "",
      ""
    );
    for (const res of tavilyData.allResults) {
      recordCandidate(res.url, res.title, res.content, "tavily_market_research", false, 1);
    }
  } catch (err) {
    console.warn("[CompetitorEngine] Tavily market search error:", err);
  }

  // Also query Google Shopping for e-commerce / physical product companies
  if (
    profile.industry.toLowerCase().includes("ecommerce") ||
    profile.industry.toLowerCase().includes("fashion") ||
    profile.industry.toLowerCase().includes("food") ||
    profile.industry.toLowerCase().includes("retail") ||
    profile.products.some((p) => /shirt|apparel|shoe|bottle|snack|drink|supplement/i.test(p))
  ) {
    try {
      const shopItems = await searchGoogleShopping(queries[0].query, { location: userLocation });
      for (const item of shopItems) {
        if (!collectedShopping.some((s) => s.link === item.link)) {
          collectedShopping.push(item);
        }
        if (item.link) {
          recordCandidate(item.link, item.title, item.price || "", queries[0].query, false, item.position);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  console.log(`[CompetitorEngine] Extracted ${rawCandidates.size} unique candidate domains`);

  // ─── 3. Score and Categorize Each Candidate ───
  const verifiedList: CompetitorIntelligence[] = [];

  for (const [domain, cand] of rawCandidates.entries()) {
    const fullText = (cand.titles.join(" ") + " " + cand.snippets.join(" ")).toLowerCase();
    const queryOverlapCount = cand.discoveryQueries.size;
    const isMarketplace = KNOWN_MARKETPLACES.has(domain) || /marketplace|directory|comparison-tool/i.test(fullText);
    const isPublisher = KNOWN_PUBLISHERS.has(domain) || /magazine|blog|reviews|news|top 10 best/i.test(cand.titles.join(" ").toLowerCase());

    // Compute 6-factor heuristic score (0 - 100)
    const breakdown: CompetitorScoreBreakdown = {
      productSimilarity: 0,
      audienceOverlap: 0,
      businessModel: 0,
      geography: 0,
      searchIntent: 0,
      pricingPosition: 0,
    };

    // Factor 1: Product similarity (0 - 30)
    for (const prod of profile.products) {
      const terms = prod.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      const matches = terms.filter((t) => fullText.includes(t));
      if (matches.length > 0) {
        breakdown.productSimilarity = Math.min(30, breakdown.productSimilarity + matches.length * 8);
      }
    }
    if (breakdown.productSimilarity === 0) {
      // Check industry match
      const indTerms = profile.industry.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      if (indTerms.some((t) => fullText.includes(t))) {
        breakdown.productSimilarity = 12;
      }
    }

    // Factor 2: Audience overlap (0 - 20)
    for (const aud of profile.targetSegments) {
      const audTerms = aud.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      if (audTerms.some((t) => fullText.includes(t))) {
        breakdown.audienceOverlap = Math.min(20, breakdown.audienceOverlap + 10);
      }
    }
    if (breakdown.audienceOverlap === 0) breakdown.audienceOverlap = 8; // base baseline

    // Factor 3: Business model alignment (0 - 15)
    if (profile.businessModel) {
      const bm = profile.businessModel.toLowerCase();
      if (
        (bm.includes("saas") && /software|cloud|platform|app|login|demo/i.test(fullText)) ||
        (bm.includes("e-commerce") && /cart|checkout|shop|order|shipping/i.test(fullText)) ||
        (bm.includes("agency") && /agency|consulting|services|clients/i.test(fullText))
      ) {
        breakdown.businessModel = 15;
      } else {
        breakdown.businessModel = 8;
      }
    } else {
      breakdown.businessModel = 10;
    }

    // Factor 4: Geography (0 - 10)
    breakdown.geography = 8; // In SERP searches scoped to userLocation

    // Factor 5: Search intent presence (0 - 15)
    // How many queries surfaced them?
    breakdown.searchIntent = Math.min(15, queryOverlapCount * 4 + (cand.sponsoredRankings.length > 0 ? 3 : 0));

    // Factor 6: Pricing position comparability (0 - 10)
    if (/pricing|plans|\$|free trial|quote/i.test(fullText)) {
      breakdown.pricingPosition = 9;
    } else {
      breakdown.pricingPosition = 5;
    }

    const totalScore =
      breakdown.productSimilarity +
      breakdown.audienceOverlap +
      breakdown.businessModel +
      breakdown.geography +
      breakdown.searchIntent +
      breakdown.pricingPosition;

    // Determine category
    let category: CompetitorCategory = "irrelevant";
    if (isMarketplace) {
      category = "marketplace";
    } else if (isPublisher) {
      category = "publisher";
    } else if (totalScore >= 58 && breakdown.productSimilarity >= 16) {
      category = "direct";
    } else if (totalScore >= 35) {
      category = "indirect";
    } else {
      category = "irrelevant";
    }

    // Filter out irrelevant spam/domain noise
    if (category === "irrelevant") continue;

    // Extract pricing evidence if present
    const pricingEvidenceMatch = cand.snippets.find((s) => /\$|free trial|month|pricing|billed/i.test(s));

    verifiedList.push({
      name: cand.name,
      domain,
      website: cand.url,
      description: cand.snippets[0] || `${cand.name} provides products in the ${profile.industry} category.`,
      valueProposition: cand.titles[0] || `${cand.name} solution`,
      products: profile.products.slice(0, 2),
      targetSegments: profile.targetSegments,
      strengths: [
        `Observed in Google search for ${cand.discoveryQueries.size} commercial queries`,
        cand.sponsoredRankings.length > 0 ? "Active in Google Sponsored Ad placements" : "Solid organic search visibility",
      ],
      weaknesses: [
        "Generic positioning across broad industry queries",
      ],
      marketingChannels: cand.sponsoredRankings.length > 0 ? ["Google Search Ads", "Organic Search"] : ["Organic Search"],
      contentStrategy: "Search-optimized product & comparison landing pages",
      differentiators: [
        `${profile.name} provides targeted specialization vs ${cand.name}'s generic search footprint.`,
      ],
      pricing: pricingEvidenceMatch || "Pricing not explicitly stated in SERP snippet",
      category,
      score: totalScore,
      scoreBreakdown: breakdown,
      scoringRationale: `Surfaced across ${queryOverlapCount} query intents with product similarity rating of ${breakdown.productSimilarity}/30 and audience overlap of ${breakdown.audienceOverlap}/20.`,
      discoveryQueries: Array.from(cand.discoveryQueries),
      organicRankings: cand.organicRankings,
      sponsoredRankings: cand.sponsoredRankings,
      transparencyStatus: "not_verified",
      creatives: [],
      evidenceSnippet: cand.snippets[0] || cand.titles[0] || "",
      verifiedAt: new Date().toISOString(),
    });
  }

  // Sort: Direct first (highest score), then Indirect, then Marketplace, then Publisher
  verifiedList.sort((a, b) => {
    const catWeight: Record<CompetitorCategory, number> = {
      direct: 4,
      indirect: 3,
      marketplace: 2,
      publisher: 1,
      irrelevant: 0,
    };
    const catDiff = (catWeight[b.category || "indirect"] || 0) - (catWeight[a.category || "indirect"] || 0);
    if (catDiff !== 0) return catDiff;
    return (b.score || 0) - (a.score || 0);
  });

  console.log(`[CompetitorEngine] Categorized: ${verifiedList.filter((c) => c.category === "direct").length} direct, ${verifiedList.filter((c) => c.category === "indirect").length} indirect, ${verifiedList.filter((c) => c.category === "marketplace").length} marketplaces, ${verifiedList.filter((c) => c.category === "publisher").length} publishers`);

  // ─── 4. Query Google Ads Transparency Center for Top Verified Direct Competitors ───
  // Inspect top 4 direct / indirect competitors
  const topForTransparency = verifiedList.filter((c) => c.category === "direct" || c.category === "indirect").slice(0, 4);

  for (const comp of topForTransparency) {
    if (!comp.domain) continue;
    try {
      console.log(`[CompetitorEngine] Checking Google Ads Transparency Center for ${comp.domain}...`);
      const trans = await searchAdvertiserTransparency(comp.domain, { gl: "us" });
      comp.transparencyStatus = trans.status;
      if (trans.creatives && trans.creatives.length > 0) {
        comp.creatives = trans.creatives;
      }
    } catch (err) {
      console.warn(`[CompetitorEngine] Transparency check error for ${comp.domain}:`, err);
      comp.transparencyStatus = "api_error";
    }
  }

  // ─── 5. Synthesize Common Market Messaging Patterns & Strategic Insights ───
  const allAdHeadlines = collectedAds.map((a) => a.title).concat(
    verifiedList.flatMap((c) => c.sponsoredRankings?.map((s) => s.title) || [])
  );

  const messagingPatterns: Array<{ theme: string; frequency: number; examples: string[] }> = [];
  const themeHooks = [
    { theme: "Speed & Rapid Time-to-Value", regex: /fast|quick|minutes|instant|easy|streamline/i },
    { theme: "All-in-One / Unified Platform", regex: /all-in-one|platform|suite|complete|hub/i },
    { theme: "Cost Savings & Free Trials", regex: /free|save|pricing|affordable|discount|\$/i },
    { theme: "AI Automation & Intelligence", regex: /ai|automated|intelligent|smart|copilot/i },
    { theme: "Trust & Enterprise Scale", regex: /trusted|enterprise|secure|proven|rated/i },
  ];

  for (const th of themeHooks) {
    const matching = allAdHeadlines.filter((h) => th.regex.test(h));
    if (matching.length > 0) {
      messagingPatterns.push({
        theme: th.theme,
        frequency: matching.length,
        examples: matching.slice(0, 3),
      });
    }
  }

  const strategicOpportunities: string[] = [
    `Competitors predominantly target broad generic terms ("${messagingPatterns[0]?.theme || "all-in-one"}"). You can win by positioning around acute operational friction.`,
    `People Also Ask questions reveal unaddressed buyer confusion around "${collectedPaa[0]?.question || "pricing and implementation"}".`,
    `Differentiate against marketplace aggregators by offering specialized white-glove onboarding and direct support.`,
  ];

  const strategicThreats: string[] = [
    `Incumbents actively bidding on category commercial queries with paid ads at position #1.`,
    `Marketplaces and review aggregators occupy top organic positions for high-intent comparison queries.`,
  ];

  return {
    verifiedCompetitors: verifiedList.slice(0, 15), // Keep top 15 most relevant
    keywordAds: collectedAds,
    shoppingResults: collectedShopping,
    peopleAlsoAsk: collectedPaa,
    organicKeywords: collectedOrganic,
    generatedQueries: queries,
    messagingPatterns,
    strategicOpportunities,
    strategicThreats,
  };
}
