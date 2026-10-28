/**
 * Competitor Discovery & Verification Engine
 *
 * 1. Builds up to 6 Google searches from what the business really sells (the profiler's
 *    plain-English category and the searches real buyers type), not from industry labels.
 * 2. Runs them through SerpApi (organic results, ads, People Also Ask, inline shopping),
 *    plus a dedicated ad search for the buying-intent ones.
 * 3. Asks Gemini to read those results and name the real competitors, skipping news sites,
 *    blogs and review articles that only mention the product. Falls back to heuristics
 *    when Gemini is unavailable.
 * 4. Scores each competitor (0-100) from product similarity plus how often they show up
 *    and advertise on the same searches.
 * 5. Checks the Google Ads Transparency Center for the top direct competitors.
 * 6. Summarizes ad messaging and a few data-driven opportunities and threats.
 */

import {
  searchGoogleIntelligence,
  searchKeywordAds,
  searchAdvertiserTransparency,
  searchGoogleShopping,
  type PeopleAlsoAskQuestion,
  type OrganicSearchResult,
} from "./serpapi";
import { searchTavily } from "./tavily";
import { identifyCompetitors, type IdentifiedCompetitor, type SearchEvidence } from "../ai/gemini";
import type {
  CompanyIntelligence,
  CompetitorIntelligence,
  CompetitorCategory,
  CompetitorScoreBreakdown,
  KeywordAdResult,
  ShoppingProduct,
  SearchQuerySignal,
  TavilySearchResult,
} from "../intelligence/types";

// Stores and marketplaces where buyers compare products
const KNOWN_MARKETPLACES = new Set([
  "amazon.com",
  "amazon.in",
  "flipkart.com",
  "etsy.com",
  "ebay.com",
  "walmart.com",
  "target.com",
  "bestbuy.com",
  "capterra.com",
  "g2.com",
  "softwareadvice.com",
  "getapp.com",
  "producthunt.com",
  "appsumo.com",
  "apps.shopify.com",
]);

// News, review and reference sites that mention products but don't sell them
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
  "cnet.com",
  "techradar.com",
  "tomsguide.com",
  "gsmarena.com",
  "androidauthority.com",
  "macrumors.com",
  "9to5mac.com",
  "engadget.com",
  "mashable.com",
  "digitaltrends.com",
  "finance.yahoo.com",
  "yahoo.com",
  "msn.com",
  "reuters.com",
  "bloomberg.com",
  "cnbc.com",
  "bbc.com",
  "cnn.com",
  "nytimes.com",
  "wirecutter.com",
  "medium.com",
  "substack.com",
  "memeburn.com",
  "trustpilot.com",
]);

const PUBLISHER_HINT = /\b(news|blog|magazine|journal|tribune|gazette|herald|reviews?|wiki|forum)\b/i;

// Platforms that show up everywhere but are never competitors
const IGNORED_DOMAINS = new Set([
  "google.com",
  "google.co.uk",
  "google.co.in",
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
  "en.wikipedia.org",
  "github.com",
  "quora.com",
  "yelp.com",
  "glassdoor.com",
  "indeed.com",
]);

// SerpApi needs a real country for `location` and `gl`; anything vaguer searches the US.
const COUNTRIES: Array<[RegExp, string, string]> = [
  [/united states|\busa?\b|america/i, "United States", "us"],
  [/united kingdom|\buk\b|england|britain/i, "United Kingdom", "uk"],
  [/india/i, "India", "in"],
  [/canada/i, "Canada", "ca"],
  [/australia/i, "Australia", "au"],
  [/germany/i, "Germany", "de"],
  [/france/i, "France", "fr"],
  [/singapore/i, "Singapore", "sg"],
  [/united arab emirates|\buae\b|dubai/i, "United Arab Emirates", "ae"],
];

function searchCountry(geography?: string): { location: string; gl: string } {
  const match = geography ? COUNTRIES.find(([re]) => re.test(geography)) : undefined;
  return match ? { location: match[1], gl: match[2] } : { location: "United States", gl: "us" };
}

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

/** "https://www.bestbuy.com › iphone" → "bestbuy.com" */
function domainFromDisplayedLink(displayed: string): string {
  const first = displayed.replace(/^https?:\/\//i, "").split(/[\s›/]/)[0] || "";
  return first.toLowerCase().replace(/^www\./, "");
}

/** Ad links are often Google tracking URLs; the displayed link names the real advertiser. */
function adDomain(ad: { link?: string; displayedLink?: string }): string {
  const fromLink = ad.link ? normalizeDomain(ad.link) : "";
  if (fromLink && !/google|doubleclick/.test(fromLink)) return fromLink;
  return ad.displayedLink ? domainFromDisplayedLink(ad.displayedLink) : fromLink;
}

function isPublisher(domain: string, titles: string[] = []): boolean {
  if (KNOWN_PUBLISHERS.has(domain)) return true;
  if ([...KNOWN_PUBLISHERS].some((p) => domain.endsWith(`.${p}`))) return true;
  return PUBLISHER_HINT.test(domain) || titles.some((t) => /^(the )?\d+ best|top \d+|best .* of 20\d\d/i.test(t));
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

function clip(text: string | undefined, max: number): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** First price-looking phrase in the snippets, e.g. "From $799" or "$12/month". */
function findPrice(snippets: string[]): string | undefined {
  const re = /(?:(?:from|starting at|starts at)\s+)?(?:US|Rs\.?|₹|£|€)?\s?[$₹£€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:\/|per)\s*(?:mo|month|yr|year))?/i;
  for (const s of snippets) {
    const m = s.match(re);
    if (m) {
      const price = m[0].trim();
      return price.charAt(0).toUpperCase() + price.slice(1);
    }
  }
  return undefined;
}

// ──────────────────────────────────────────────
// 1. Search plan
// ──────────────────────────────────────────────

function categoryOf(profile: CompanyIntelligence): string {
  return (profile.category || profile.subIndustry || profile.products?.[0] || profile.industry || "")
    .toLowerCase()
    .trim();
}

function intentOf(query: string): SearchQuerySignal["intent"] {
  if (/\b(price|prices|cost|cheap|deal|deals|discount|offer)\b|\$/.test(query)) return "pricing";
  if (/\b(vs|versus|alternatives?|competitors?|like)\b/.test(query)) return "brand_alternative";
  return "commercial";
}

/** Up to 6 searches a real buyer of this business would type. */
export function generateDiscoveryQueries(profile: CompanyIntelligence): SearchQuerySignal[] {
  const brand = (profile.name || "").trim();
  const category = categoryOf(profile);
  const queries: SearchQuerySignal[] = [];
  const seen = new Set<string>();

  // "best smartphones" and "best smartphone 2026" cost two credits for the same results.
  const keyOf = (query: string) =>
    query
      .split(" ")
      .map((w) => w.replace(/\d+/g, "").replace(/s$/, ""))
      .filter(Boolean)
      .sort()
      .join(" ");

  const add = (raw: string) => {
    const query = raw.toLowerCase().replace(/\s+/g, " ").trim();
    const key = keyOf(query);
    if (query.length < 3 || seen.has(key)) return;
    seen.add(key);
    queries.push({ query, intent: intentOf(query) });
  };

  if (brand) add(`${brand} alternatives`);
  if (category) add(`best ${category}`);
  for (const term of profile.searchTerms || []) add(term);
  if (category) add(`${category} price`);

  return queries.slice(0, 6);
}

// ──────────────────────────────────────────────
// 2. Candidates and scoring
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

/** All search evidence for a domain, including subdomains (news.samsung.com counts for samsung.com). */
function candidateStats(raw: Map<string, RawCandidate>, domain: string) {
  const matches = [...raw.values()].filter((c) => c.domain === domain || c.domain.endsWith(`.${domain}`));
  const queries = new Set<string>();
  for (const m of matches) m.discoveryQueries.forEach((q) => queries.add(q));
  return {
    appearances: queries.size,
    queries: [...queries],
    snippets: matches.flatMap((m) => m.snippets),
    titles: matches.flatMap((m) => m.titles),
    organicRankings: matches.flatMap((m) => m.organicRankings),
    sponsoredRankings: matches.flatMap((m) => m.sponsoredRankings),
  };
}

function scoreBreakdown(
  type: CompetitorCategory,
  similarity: number,
  appearances: number,
  runsAds: boolean,
  hasPrice: boolean
): CompetitorScoreBreakdown {
  return {
    productSimilarity: Math.round(similarity * 0.3),
    audienceOverlap: type === "direct" ? Math.round(10 + similarity * 0.1) : Math.round(6 + similarity * 0.08),
    businessModel: type === "direct" ? 13 : type === "indirect" ? 9 : 6,
    geography: 8,
    searchIntent: Math.min(15, appearances * 3 + (runsAds ? 4 : 0)),
    pricingPosition: hasPrice ? 8 : 5,
  };
}

const total = (b: CompetitorScoreBreakdown) =>
  b.productSimilarity + b.audienceOverlap + b.businessModel + b.geography + b.searchIntent + b.pricingPosition;

function toCompetitor(
  input: { name: string; domain: string; type: CompetitorCategory; similarity: number; why?: string },
  raw: Map<string, RawCandidate>,
  profile: CompanyIntelligence
): CompetitorIntelligence {
  const stats = candidateStats(raw, input.domain);
  const runsAds = stats.sponsoredRankings.length > 0;
  const pricing = findPrice(stats.snippets);
  const breakdown = scoreBreakdown(input.type, input.similarity, stats.appearances, runsAds, Boolean(pricing));

  const strengths: string[] = [];
  if (stats.appearances > 0) strengths.push(`Shows up on Google for ${stats.appearances} of the searches your buyers make`);
  if (runsAds) strengths.push("Pays for Google ads on those searches");

  return {
    name: input.name,
    domain: input.domain,
    website: `https://${input.domain}`,
    description: clip(input.why || stats.snippets[0] || `${input.name} sells ${categoryOf(profile)}.`, 260),
    valueProposition: clip(stats.titles[0] || input.why || input.name, 140),
    products: [],
    targetSegments: profile.targetSegments,
    strengths,
    weaknesses: [],
    marketingChannels: runsAds ? ["Google Search Ads", "Organic Search"] : stats.appearances > 0 ? ["Organic Search"] : [],
    contentStrategy: "",
    differentiators: [],
    pricing,
    category: input.type,
    score: total(breakdown),
    scoreBreakdown: breakdown,
    scoringRationale: `Product similarity ${input.similarity}/100, seen in ${stats.appearances} buyer searches${runsAds ? ", runs Google ads" : ""}.`,
    discoveryQueries: stats.queries,
    organicRankings: stats.organicRankings,
    sponsoredRankings: stats.sponsoredRankings,
    transparencyStatus: "not_verified",
    creatives: [],
    evidenceSnippet: stats.snippets[0] || "",
    verifiedAt: new Date().toISOString(),
  };
}

/** Used only when Gemini can't read the results: keep real sellers that keep showing up. */
function heuristicCompetitors(
  raw: Map<string, RawCandidate>,
  profile: CompanyIntelligence
): Array<{ name: string; domain: string; type: CompetitorCategory; similarity: number }> {
  const out: Array<{ name: string; domain: string; type: CompetitorCategory; similarity: number }> = [];

  for (const lc of profile.likelyCompetitors || []) {
    if (lc.domain) {
      out.push({ name: lc.name, domain: normalizeDomain(lc.domain), type: lc.type || "direct", similarity: 75 });
    }
  }

  for (const [domain, cand] of raw.entries()) {
    if (out.some((c) => c.domain === domain) || isPublisher(domain, cand.titles)) continue;
    const marketplace = KNOWN_MARKETPLACES.has(domain);
    const appearances = cand.discoveryQueries.size;
    const runsAds = cand.sponsoredRankings.length > 0;
    if (!marketplace && appearances < 2 && !runsAds) continue;
    out.push({
      name: cand.name,
      domain,
      type: marketplace ? "marketplace" : "indirect",
      similarity: marketplace ? 40 : Math.min(70, 45 + appearances * 5),
    });
  }
  return out;
}

// ──────────────────────────────────────────────
// 3. Engine
// ──────────────────────────────────────────────

export async function runCompetitorDiscoveryEngine(profile: CompanyIntelligence): Promise<CompetitorEngineResult> {
  const userDomain = normalizeDomain(profile.website || "");
  const queries = generateDiscoveryQueries(profile);
  const { location, gl } = searchCountry(profile.geography);
  const category = categoryOf(profile);

  console.log(`[CompetitorEngine] ${profile.name} (${userDomain}), category "${category}", ${queries.length} searches in ${location}`);

  const rawCandidates = new Map<string, RawCandidate>();
  const collectedAds: KeywordAdResult[] = [];
  const collectedPaa: PeopleAlsoAskQuestion[] = [];
  const collectedOrganic: OrganicSearchResult[] = [];
  const collectedShopping: ShoppingProduct[] = [];

  const recordCandidate = (domain: string, title: string, snippet: string, query: string, isAd: boolean, position: number, link: string) => {
    if (!domain || domain === userDomain || domain.endsWith(`.${userDomain}`) || IGNORED_DOMAINS.has(domain)) return;

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
    (isAd ? candidate.sponsoredRankings : candidate.organicRankings).push({ query, position, title, link, snippet });
  };

  const addAd = (ad: KeywordAdResult) => {
    const domain = adDomain(ad);
    if (collectedAds.some((a) => a.title === ad.title && adDomain(a) === domain)) return;
    collectedAds.push(ad);
    recordCandidate(domain, ad.title, ad.snippet || "", ad.query, true, ad.position, ad.link);
  };

  // ── Google searches: organic, ads, People Also Ask and inline shopping (1 SerpApi credit each) ──
  const BATCH_SIZE = 3;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    await Promise.allSettled(
      queries.slice(i, i + BATCH_SIZE).map(async (qSig) => {
        const q = qSig.query;
        const serp = await searchGoogleIntelligence(q, { location, gl });
        if (!serp) return;
        qSig.totalOrganicResults = serp.organicResults.length;
        qSig.totalAds = serp.ads.length;

        serp.ads.forEach((ad, idx) =>
          addAd({
            id: `ad_g_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            position: ad.position,
            blockPosition: ad.blockPosition,
            title: ad.title,
            link: ad.link,
            displayedLink: ad.displayedLink,
            trackingLink: ad.trackingLink,
            snippet: ad.snippet,
            advertiserName: ad.advertiserName,
            sitelinks: ad.sitelinks,
            query: q,
            location,
            collectedAt: serp.collectedAt,
          })
        );

        for (const paa of serp.peopleAlsoAsk) {
          if (paa.question && !collectedPaa.some((p) => p.question.toLowerCase() === paa.question.toLowerCase())) {
            collectedPaa.push(paa);
          }
        }

        for (const org of serp.organicResults) {
          recordCandidate(normalizeDomain(org.link), org.title, org.snippet || "", q, false, org.position, org.link);
          collectedOrganic.push(org);
        }

        for (const sp of serp.shoppingResults || []) {
          if (!collectedShopping.some((s) => s.link === sp.link)) collectedShopping.push(sp);
        }
      })
    );
  }

  // ── Dedicated ad search, only for buying-intent searches (research searches rarely show ads) ──
  const adQueries = queries.filter((q) => q.intent === "commercial" || q.intent === "pricing").slice(0, 3);
  await Promise.allSettled(
    adQueries.map(async (qSig) => {
      const ads = await searchKeywordAds(qSig.query, { location, gl });
      ads.forEach(addAd);
    })
  );

  // ── One article search naming the main brands: evidence for Gemini, never a competitor itself ──
  let articles: TavilySearchResult[] = [];
  if (category) {
    try {
      const res = await searchTavily({
        query: `top ${category} brands ${new Date().getFullYear()}`,
        searchDepth: "basic",
        maxResults: 6,
      });
      if (res.success) articles = res.results;
    } catch (err) {
      console.warn("[CompetitorEngine] Tavily brand search error:", err);
    }
  }

  // ── Google Shopping for physical products ──
  if (profile.sellsPhysicalProducts && category) {
    try {
      const shopItems = await searchGoogleShopping(category, { location, gl });
      for (const item of shopItems) {
        if (!collectedShopping.some((s) => s.link === item.link)) collectedShopping.push(item);
      }
    } catch {
      // Non-fatal
    }
  }

  console.log(`[CompetitorEngine] ${rawCandidates.size} domains, ${collectedAds.length} ads, ${collectedPaa.length} questions`);

  // ─── Pick the real competitors ───
  const evidence: SearchEvidence[] = [];
  const seenEvidence = new Set<string>();
  const pushEvidence = (kind: SearchEvidence["kind"], title: string, domain: string, snippet: string) => {
    const key = `${domain}|${title}`;
    if (!domain || seenEvidence.has(key) || evidence.length >= 60) return;
    seenEvidence.add(key);
    evidence.push({ n: evidence.length + 1, kind, title: clip(title, 110), domain, snippet: clip(snippet, 180) });
  };
  collectedAds.forEach((a) => pushEvidence("ad", a.title, adDomain(a), a.snippet || ""));
  collectedOrganic.forEach((o) => pushEvidence("organic", o.title, normalizeDomain(o.link), o.snippet || ""));
  articles.forEach((a) => pushEvidence("article", a.title, normalizeDomain(a.url), a.content));

  let picked: Array<{ name: string; domain: string; type: CompetitorCategory; similarity: number; why?: string }>;
  const identified: IdentifiedCompetitor[] | null =
    evidence.length > 0 || (profile.likelyCompetitors?.length ?? 0) > 0
      ? await identifyCompetitors(profile, evidence)
      : null;

  if (identified && identified.length > 0) {
    picked = identified.filter((c) => !isPublisher(c.domain) && !IGNORED_DOMAINS.has(c.domain));
    console.log(`[CompetitorEngine] Gemini picked ${picked.length} competitors: ${picked.map((c) => c.name).join(", ")}`);
  } else {
    picked = heuristicCompetitors(rawCandidates, profile);
    console.log(`[CompetitorEngine] Heuristic fallback picked ${picked.length} competitors`);
  }

  const seenDomains = new Set<string>();
  const categoryWeight: Record<CompetitorCategory, number> = { direct: 4, indirect: 3, marketplace: 2, publisher: 1, irrelevant: 0 };
  const verifiedList = picked
    .filter((c) => {
      if (!c.domain || c.domain === userDomain || seenDomains.has(c.domain)) return false;
      seenDomains.add(c.domain);
      return true;
    })
    .map((c) => toCompetitor(c, rawCandidates, profile))
    .sort(
      (a, b) =>
        (categoryWeight[b.category || "indirect"] || 0) - (categoryWeight[a.category || "indirect"] || 0) ||
        (b.score || 0) - (a.score || 0)
    )
    .slice(0, 12);

  // ─── Ads Transparency Center for the top direct competitors ───
  const forTransparency = verifiedList.filter((c) => c.category === "direct").slice(0, 3);
  await Promise.allSettled(
    forTransparency.map(async (comp) => {
      if (!comp.domain) return;
      try {
        const trans = await searchAdvertiserTransparency(comp.domain, { gl });
        comp.transparencyStatus = trans.status;
        if (trans.creatives && trans.creatives.length > 0) comp.creatives = trans.creatives;
      } catch (err) {
        console.warn(`[CompetitorEngine] Transparency check error for ${comp.domain}:`, err);
        comp.transparencyStatus = "api_error";
      }
    })
  );

  // ─── Ad messaging themes ───
  const allAdHeadlines = collectedAds.map((a) => a.title);
  const themeHooks = [
    { theme: "Speed & convenience", regex: /fast|quick|minutes|instant|easy|same.day|delivery/i },
    { theme: "Price, deals & free trials", regex: /free|save|sale|deal|offer|discount|affordable|cheap|\$|₹|off\b/i },
    { theme: "Quality & trust", regex: /trusted|official|rated|best|premium|guarantee|warranty|secure/i },
    { theme: "New & latest", regex: /new|latest|20\d\d|launch|now available/i },
    { theme: "Smart / AI features", regex: /\bai\b|smart|intelligent|automat/i },
  ];
  const messagingPatterns = themeHooks
    .map((th) => {
      const matching = allAdHeadlines.filter((h) => th.regex.test(h));
      return { theme: th.theme, frequency: matching.length, examples: matching.slice(0, 3) };
    })
    .filter((p) => p.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency);

  // ─── Opportunities and threats, stated only from what the searches showed ───
  const advertisers = [...new Set(collectedAds.map((a) => adDomain(a)).filter(Boolean))];
  const directNames = verifiedList.filter((c) => c.category === "direct").slice(0, 3).map((c) => c.name);
  const marketplaces = verifiedList.filter((c) => c.category === "marketplace").slice(0, 3).map((c) => c.name);

  const strategicOpportunities: string[] = [];
  if (collectedPaa[0]) {
    strategicOpportunities.push(`Buyers keep asking Google "${collectedPaa[0].question}". A clear answer on your site or socials meets them right there.`);
  }
  if (directNames.length > 0) {
    strategicOpportunities.push(`Shoppers compare you with ${directNames.join(", ")}. Honest comparison content catches them while they decide.`);
  }

  const strategicThreats: string[] = [];
  if (advertisers.length > 0) {
    strategicThreats.push(`${advertisers.length} brands pay for Google ads on your buyers' searches, including ${advertisers.slice(0, 3).join(", ")}.`);
  }
  if (marketplaces.length > 0) {
    strategicThreats.push(`Buyers compare prices on ${marketplaces.join(", ")}.`);
  }

  console.log(
    `[CompetitorEngine] Final: ${verifiedList.filter((c) => c.category === "direct").length} direct, ` +
      `${verifiedList.filter((c) => c.category === "indirect").length} indirect, ` +
      `${verifiedList.filter((c) => c.category === "marketplace").length} marketplaces`
  );

  return {
    verifiedCompetitors: verifiedList,
    keywordAds: collectedAds,
    shoppingResults: collectedShopping,
    peopleAlsoAsk: collectedPaa.slice(0, 30),
    organicKeywords: collectedOrganic,
    generatedQueries: queries,
    messagingPatterns,
    strategicOpportunities,
    strategicThreats,
  };
}
