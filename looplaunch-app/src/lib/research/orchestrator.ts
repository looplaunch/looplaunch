/**
 * Research orchestrator: the one place Search Intel research runs.
 *
 *  1. Market        where to search (country / city), from the business profile
 *  2. Discovery     up to MAX_COMPETITOR_DISCOVERY_QUERIES Google searches (SerpApi) and one
 *                   Tavily search, in parallel; they give organic results, ads, questions
 *  3. Competitors   Gemini names candidates from the numbered evidence; only candidates the
 *                   evidence confirms are kept (see competitors.ts)
 *  4. Competitor ads up to MAX_AD_SEARCH_QUERIES more searches, aimed at competitors and never
 *                   at the business's own brand; stops early once enough competitor ads are seen
 *  5. Ad Library    Ads Transparency Center lookups for the top direct competitors
 *  6. Assemble      dedupe, classify, apply the 10-per-category limits, record limitations
 *
 * Every provider call goes through the cache and the request ledger. A failed provider
 * never discards what the others found; the run is marked "partial" instead.
 */

import { identifyCompetitors, type IdentifiedCompetitor, type SearchEvidence } from "../ai/gemini";
import type {
  CompanyIntelligence,
  CompetitorIntelligence,
  KeywordAdResult,
  ResearchRunInfo,
  SearchQuerySignal,
  ShoppingProduct,
  TavilySearchResult,
} from "../intelligence/types";
import { classifyAds, mergeAdSightings, selectAds, type AdSighting } from "./ads";
import { cacheKey, createResearchCache, type ResearchCache } from "./cache";
import {
  buildEvidence,
  heuristicCandidates,
  toCompetitors,
  validateCandidates,
  type CompetitorCandidate,
  type EvidenceItem,
} from "./competitors";
import { researchConfig, type ResearchConfig } from "./config";
import { hostOf, registrableDomain } from "./domains";
import { ResearchLedger } from "./ledger";
import { resolveMarket } from "./market";
import { adQueries, categoryOf, discoveryQueries, intentOf } from "./plan";
import { selectQuestions, type FoundQuestion, type SelectedQuestion } from "./questions";
import {
  canonicalQuery,
  createSerpApiClient,
  type GoogleSearchData,
  type LocalPlace,
  type OrganicSearchResult,
  type ProviderResult,
  type SerpApiClient,
} from "./serpapi";
import { searchTavily } from "./tavily";

export interface ResearchDeps {
  serp: SerpApiClient;
  tavily: (query: string, ledger: ResearchLedger) => Promise<ProviderResult<TavilySearchResult[]>>;
  identifyCompetitors: (
    profile: CompanyIntelligence,
    evidence: SearchEvidence[]
  ) => Promise<IdentifiedCompetitor[] | null>;
  now: () => Date;
}

export interface ResearchResult {
  competitors: CompetitorIntelligence[];
  /** Competitor, other-advertiser and own ads, each group capped at maxAds */
  ads: KeywordAdResult[];
  questions: SelectedQuestion[];
  organic: OrganicSearchResult[];
  shopping: ShoppingProduct[];
  queries: SearchQuerySignal[];
  messagingPatterns: Array<{ theme: string; frequency: number; examples: string[] }>;
  strategicOpportunities: string[];
  strategicThreats: string[];
  research: ResearchRunInfo;
  ledger: ResearchLedger;
}

interface SearchRun {
  query: string;
  intent: SearchQuerySignal["intent"];
  purpose: "competitor_discovery" | "competitor_ads";
  result: ProviderResult<GoogleSearchData>;
}

/** Tavily through the same cache and ledger as SerpApi. */
function createTavilySearch(cache: ResearchCache, config: ResearchConfig): ResearchDeps["tavily"] {
  return async (query, ledger) => {
    const started = Date.now();
    const params = { q: canonicalQuery(query), depth: "basic", max: 6 };
    const key = cacheKey("tavily", "search", params);
    const record = (cacheHit: boolean, success: boolean, error?: string) =>
      ledger.record({ provider: "tavily", operation: "search", query, purpose: "market_evidence", cacheHit, success, error, durationMs: Date.now() - started });

    const hit = await cache.get<TavilySearchResult[]>(key);
    if (hit) {
      record(true, true);
      return { ok: true, data: hit.value, fromCache: true, fetchedAt: hit.fetchedAt };
    }
    const res = await searchTavily({ query, searchDepth: "basic", maxResults: 6 });
    if (!res.success) {
      const notConfigured = /not configured/i.test(res.error || "");
      record(false, false, res.error);
      return { ok: false, kind: notConfigured ? "not_configured" : "provider_error", message: res.error || "Tavily search failed" };
    }
    const entry = await cache.set(key, { provider: "tavily", operation: "search", params }, res.results, config.cacheTtlHours);
    record(res.fromCache, true);
    return { ok: true, data: res.results, fromCache: res.fromCache, fetchedAt: entry.fetchedAt };
  };
}

export function defaultResearchDeps(config: ResearchConfig): ResearchDeps {
  const cache = createResearchCache();
  return {
    serp: createSerpApiClient({ apiKey: process.env.SERPAPI_API_KEY, cache, config }),
    tavily: createTavilySearch(cache, config),
    identifyCompetitors: (profile, evidence) => identifyCompetitors(profile, evidence),
    now: () => new Date(),
  };
}

const AD_THEMES = [
  { theme: "Speed & convenience", regex: /fast|quick|minutes|instant|easy|same.day|delivery/i },
  { theme: "Price, deals & free trials", regex: /free|save|sale|deal|offer|discount|affordable|cheap|\$|₹|£|€|\boff\b/i },
  { theme: "Quality & trust", regex: /trusted|official|rated|best|premium|guarantee|warranty|secure/i },
  { theme: "New & latest", regex: /\bnew\b|latest|20\d\d|launch|now available/i },
  { theme: "Smart / AI features", regex: /\bai\b|smart|intelligent|automat/i },
];

function failureNote(kind: string): string {
  switch (kind) {
    case "not_configured":
      return "not set up";
    case "quota":
      return "out of monthly searches";
    case "rate_limited":
      return "rate limited";
    default:
      return "failed";
  }
}

function nameMatches(advertiser: string, competitor: string, domain: string): boolean {
  const a = advertiser.toLowerCase();
  const label = (domain.split(".")[0] || "").toLowerCase();
  return a.includes(competitor.toLowerCase()) || (label.length >= 3 && a.includes(label));
}

export async function runResearch(
  profile: CompanyIntelligence,
  options: { sessionId?: string; config?: Partial<ResearchConfig>; deps?: Partial<ResearchDeps> } = {}
): Promise<ResearchResult> {
  const config = researchConfig(options.config);
  const deps: ResearchDeps = { ...defaultResearchDeps(config), ...options.deps };
  const ledger = new ResearchLedger(options.sessionId, {
    competitor_discovery: config.maxDiscoveryQueries,
    competitor_ads: config.maxAdQueries,
    ad_library: config.maxAdLibraryLookups,
    market_evidence: 1,
    location_lookup: 1,
  });
  const limitations: string[] = [];
  const ownDomain = hostOf(profile.website);
  const own = { domain: ownDomain, name: profile.name || "" };
  const category = categoryOf(profile);

  // ── 1. Market ──
  const market = await resolveMarket(profile, (city, iso2) =>
    ledger.take("location_lookup") ? deps.serp.resolveLocation(city, iso2, { ledger, purpose: "location_lookup" }) : Promise.resolve(null)
  );
  limitations.push(...market.notes);

  // ── 2. Discovery: Google searches and one Tavily search, in parallel ──
  const runs: SearchRun[] = [];
  const sightings: AdSighting[] = [];
  const found: FoundQuestion[] = [];
  const organic: Array<OrganicSearchResult & { query: string }> = [];
  const local: Array<LocalPlace & { query: string }> = [];
  const shopping: ShoppingProduct[] = [];

  const absorb = (run: SearchRun) => {
    runs.push(run);
    if (!run.result.ok) return;
    const { data, fetchedAt } = run.result;
    for (const ad of data.ads) sightings.push({ ad, query: run.query, observedAt: fetchedAt, location: market.location });
    for (const q of data.peopleAlsoAsk) found.push({ ...q, sourceQuery: run.query, observedAt: fetchedAt });
    for (const o of data.organic) organic.push({ ...o, query: run.query });
    for (const p of data.local) local.push({ ...p, query: run.query });
    for (const s of data.shopping) if (!shopping.some((x) => x.link === s.link)) shopping.push(s);
  };

  // A missing key or an exhausted quota won't fix itself during this run: stop asking.
  let serpBlocked = false;
  const blocks = (r: ProviderResult<unknown>) => !r.ok && (r.kind === "not_configured" || r.kind === "quota");
  const search = async (query: string, purpose: SearchRun["purpose"]): Promise<SearchRun> => {
    const result = await deps.serp.googleSearch(query, market, { ledger, purpose });
    if (blocks(result)) serpBlocked = true;
    return { query, intent: intentOf(query), purpose, result };
  };

  if (!category) {
    limitations.push("The website didn't make clear what this business sells, so competitor searches were skipped.");
  }
  const discovery = discoveryQueries(profile, market, config.maxDiscoveryQueries).filter(() => ledger.take("competitor_discovery"));
  const tavilyQuery = category
    ? market.scope === "local" && market.city
      ? `best ${category} in ${market.city}`
      : `best ${category} ${deps.now().getFullYear()}`
    : "";

  const [discoveryRuns, articleResult] = await Promise.all([
    Promise.all(discovery.map((q) => search(q.query, "competitor_discovery"))),
    tavilyQuery && ledger.take("market_evidence") ? deps.tavily(tavilyQuery, ledger) : Promise.resolve(null),
  ]);
  discoveryRuns.forEach(absorb);
  const articles = articleResult?.ok ? articleResult.data : [];

  // ── 3. Competitors from the evidence ──
  let ads = mergeAdSightings(sightings);
  let evidence: EvidenceItem[] = buildEvidence({ organic, ads, articles, local }, ownDomain);
  let candidates: CompetitorCandidate[] = [];

  if (evidence.length > 0) {
    const identified = await deps.identifyCompetitors(
      profile,
      evidence.map((e) => ({ n: e.n, kind: e.kind, title: e.title, domain: e.host, snippet: e.snippet }))
    );
    if (identified) {
      candidates = identified;
    } else {
      candidates = heuristicCandidates(evidence);
      limitations.push("Gemini was unavailable, so competitors were picked from how often they appear in search and have no match score.");
    }
  }

  const collectedAt = deps.now().toISOString();
  const okQueries = () => runs.filter((r) => r.result.ok).map((r) => r.query);
  let validation = validateCandidates(candidates, evidence, own);
  let competitors = toCompetitors(validation.verified, { searches: okQueries(), ads, profile, collectedAt }, config.maxCompetitors);

  // ── 4. Searches aimed at competitor ads (stop once there are enough) ──
  const competitorAds = () => classifyAds(mergeAdSightings(sightings), ownDomain, competitors).filter((a) => a.relation === "competitor");
  const plan = adQueries(profile, market, competitors, {
    alreadyRun: runs.map((r) => r.query),
    advertisingDomains: new Set(competitorAds().map((a) => a.competitorDomain || "")),
    max: ledger.remaining("competitor_ads"),
  });
  for (const query of plan) {
    if (serpBlocked || competitorAds().length >= config.maxAds || !ledger.take("competitor_ads")) break;
    absorb(await search(query, "competitor_ads"));
  }

  // Re-check candidates against everything collected (no new Gemini call).
  ads = mergeAdSightings(sightings);
  evidence = buildEvidence({ organic, ads, articles, local }, ownDomain);
  validation = validateCandidates(candidates, evidence, own);
  console.log(
    `[Research] ${candidates.length} candidates from ${evidence.length} evidence items; verified: ${validation.verified.map((v) => v.name).join(", ") || "none"}; ` +
      `unverified: ${validation.unverified.map((u) => u.name).join(", ") || "none"}`
  );
  competitors = toCompetitors(validation.verified, { searches: okQueries(), ads, profile, collectedAt }, config.maxCompetitors);

  // ── 5. Ad Library for the top direct competitors ──
  const libraryTargets = serpBlocked ? [] : competitors.filter((c) => c.category === "direct" && c.domain).slice(0, config.maxAdLibraryLookups);
  const libraryRuns: Array<{ domain: string; ok: boolean; fromCache: boolean; fetchedAt?: string }> = [];
  await Promise.all(
    libraryTargets.map(async (comp) => {
      if (!ledger.take("ad_library")) return;
      const domain = registrableDomain(comp.domain);
      const res = await deps.serp.adLibrary(domain, market, { ledger, purpose: "ad_library" });
      libraryRuns.push({ domain, ok: res.ok, fromCache: res.ok && res.fromCache, fetchedAt: res.ok ? res.fetchedAt : undefined });
      if (!res.ok) {
        comp.transparencyStatus = "api_error";
        return;
      }
      // A domain search also returns ads from other advertisers that link there (agencies,
      // resellers, or local businesses linking to google.com). Only the competitor's own count.
      const theirs = res.data.creatives.filter((cr) => nameMatches(cr.advertiser, comp.name, domain));
      const dropped = res.data.creatives.length - theirs.length;
      if (dropped > 0) {
        limitations.push(`Ad Library: ${dropped} record${dropped === 1 ? "" : "s"} linking to ${domain} came from other advertisers and ${dropped === 1 ? "isn't" : "aren't"} shown as ${comp.name}'s ads.`);
      }
      comp.transparencyStatus = theirs.length > 0 ? "verified_has_ads" : res.data.creatives.length > 0 ? "insufficient_evidence" : "no_ads_found";
      comp.creatives = theirs.map((cr) => ({
        ...cr,
        targetDomain: domain,
        competitorName: comp.name,
        region: market.iso2,
        advertiserMatchesCompetitor: true,
      }));
    })
  );
  // Keep at most maxAds creatives overall, shared between competitors; previews and recent ones first.
  const perCompetitor = Math.max(1, Math.ceil(config.maxAds / Math.max(1, libraryTargets.length)));
  let libraryLeft = config.maxAds;
  for (const comp of libraryTargets) {
    const sorted = [...(comp.creatives || [])].sort(
      (a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)) || (b.lastShownAt || "").localeCompare(a.lastShownAt || "")
    );
    comp.creatives = sorted.slice(0, Math.min(perCompetitor, libraryLeft));
    libraryLeft -= comp.creatives.length;
  }

  // ── 6. Assemble ──
  const classified = classifyAds(ads, ownDomain, competitors);
  const kept = selectAds(classified, competitors.map((c) => c.domain || ""), config.maxAds);
  const questions = selectQuestions(found, config.maxQuestions, [
    category,
    own.name,
    ...(profile.products || []),
    ...competitors.map((c) => c.name),
  ]);

  const competitorHeadlines = kept.competitor.map((a) => a.title);
  const messagingPatterns = AD_THEMES.map((t) => {
    const matching = competitorHeadlines.filter((h) => t.regex.test(h));
    return { theme: t.theme, frequency: matching.length, examples: matching.slice(0, 3) };
  })
    .filter((p) => p.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency);

  const direct = competitors.filter((c) => c.category === "direct").slice(0, 3).map((c) => c.name);
  const marketplaces = competitors.filter((c) => c.category === "marketplace").slice(0, 3).map((c) => c.name);
  const advertisers = [...new Set(kept.competitor.map((a) => a.competitorName || a.advertiserDomain || ""))].filter(Boolean);
  const strategicOpportunities: string[] = [];
  if (questions[0]) strategicOpportunities.push(`Buyers ask Google "${questions[0].question}". A clear answer on your site or socials meets them right there.`);
  if (direct.length) strategicOpportunities.push(`Buyers compare you with ${direct.join(", ")}. Honest comparison content catches them while they decide.`);
  const strategicThreats: string[] = [];
  if (advertisers.length) strategicThreats.push(`${advertisers.slice(0, 3).join(", ")} ran Google ads on your buyers' searches when we checked.`);
  if (marketplaces.length) strategicThreats.push(`Buyers compare prices on ${marketplaces.join(", ")}.`);

  // ── Status and limitations ──
  const failedRuns = runs.filter((r) => !r.result.ok);
  if (failedRuns.length) {
    const kinds = [...new Set(failedRuns.map((r) => (r.result.ok ? "" : failureNote(r.result.kind))))].join(", ");
    limitations.push(`${failedRuns.length} of ${runs.length} Google searches didn't work (${kinds}), so some results may be missing.`);
  }
  if (articleResult && !articleResult.ok && articleResult.kind !== "not_configured") limitations.push("The Tavily web search failed, so fewer sources were checked.");
  if (libraryRuns.some((r) => !r.ok)) limitations.push("Some Ad Library lookups failed.");
  if (runs.some((r) => r.result.ok)) {
    limitations.push(
      `Saw ${kept.competitor.length} competitor ad${kept.competitor.length === 1 ? "" : "s"} across ${okQueries().length} Google searches. Ads change by time and place, so a competitor missing here may still advertise.`
    );
  }
  if (questions.length === 0 && runs.some((r) => r.result.ok)) limitations.push("Google showed no \"People also ask\" questions for these searches.");

  const okRuns = runs.filter((r) => r.result.ok);
  const nothingFound = competitors.length === 0 && classified.length === 0 && questions.length === 0 && organic.length === 0;
  const status: ResearchRunInfo["status"] =
    runs.length > 0 && okRuns.length === 0 && articles.length === 0
      ? "unavailable"
      : runs.length === 0 && articles.length === 0
        ? category
          ? "unavailable"
          : "empty"
        : nothingFound
          ? "empty"
          : failedRuns.length > 0 || libraryRuns.some((r) => !r.ok) || (articleResult !== null && !articleResult.ok)
            ? "partial"
            : "complete";

  const fetchedTimes = [
    ...okRuns.map((r) => (r.result.ok ? r.result.fetchedAt : "")),
    ...libraryRuns.map((r) => r.fetchedAt || ""),
    articleResult?.ok ? articleResult.fetchedAt : "",
  ].filter(Boolean);

  const research: ResearchRunInfo = {
    version: 2,
    status,
    completedAt: deps.now().toISOString(),
    dataCollectedAt: fetchedTimes.sort()[0],
    market: { scope: market.scope, country: market.country, searchLocation: market.location, city: market.city, assumed: market.assumed },
    queries: [
      ...runs.map((r) => ({
        query: r.query,
        purpose: r.purpose,
        provider: "serpapi" as const,
        fromCache: r.result.ok && r.result.fromCache,
        ok: r.result.ok,
        observedAt: r.result.ok ? r.result.fetchedAt : undefined,
      })),
      ...(articleResult
        ? [{ query: tavilyQuery, purpose: "market_evidence" as const, provider: "tavily" as const, fromCache: articleResult.ok && articleResult.fromCache, ok: articleResult.ok, observedAt: articleResult.ok ? articleResult.fetchedAt : undefined }]
        : []),
      ...libraryRuns.map((r) => ({ query: r.domain, purpose: "ad_library" as const, provider: "serpapi" as const, fromCache: r.fromCache, ok: r.ok, observedAt: r.fetchedAt })),
    ],
    requests: { serpapi: ledger.counts("serpapi"), tavily: ledger.counts("tavily") },
    limitations,
    unverifiedCompetitors: validation.unverified.slice(0, 10),
  };

  const queries: SearchQuerySignal[] = runs.map((r) => ({
    query: r.query,
    intent: r.intent,
    totalOrganicResults: r.result.ok ? r.result.data.organic.length : undefined,
    totalAds: r.result.ok ? r.result.data.ads.length : undefined,
  }));

  await ledger.persist();
  console.log(
    `[Research] ${profile.name}: ${competitors.length} competitors, ${kept.competitor.length} competitor ads (+${kept.other.length} other, ${kept.own.length} own), ` +
      `${questions.length} questions. SerpApi ${JSON.stringify(research.requests.serpapi)}, status ${status}`
  );

  return {
    competitors,
    ads: [...kept.competitor, ...kept.other, ...kept.own],
    questions,
    organic: organic.slice(0, 10),
    shopping: shopping.slice(0, 6),
    queries,
    messagingPatterns,
    strategicOpportunities,
    strategicThreats,
    research,
    ledger,
  };
}
