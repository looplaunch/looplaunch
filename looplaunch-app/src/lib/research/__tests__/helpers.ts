/**
 * Test doubles for the research pipeline: fake SerpApi, Tavily and Gemini that return
 * canned results and count calls, so tests never spend provider credits.
 */

import type { IdentifiedCompetitor } from "../../ai/gemini";
import type { AdvertiserAdCreative, CompanyIntelligence, TavilySearchResult } from "../../intelligence/types";
import type { ResearchDeps } from "../orchestrator";
import type {
  AdLibraryData,
  GoogleSearchData,
  ProviderFailureKind,
  ProviderResult,
  RawSearchAd,
  SerpApiClient,
} from "../serpapi";

export const NOW = new Date("2026-10-29T12:00:00.000Z");

export function profile(overrides: Partial<CompanyIntelligence> = {}): CompanyIntelligence {
  return {
    name: "Brand",
    website: "https://brand.example",
    industry: "",
    description: "",
    valueProposition: "",
    products: [],
    targetSegments: [],
    brandTone: "",
    strengths: [],
    weaknesses: [],
    currentChannels: [],
    contentThemes: [],
    technologyStack: [],
    marketScope: "national",
    country: "United States",
    ...overrides,
  };
}

export function serp(partial: Partial<GoogleSearchData> = {}): GoogleSearchData {
  return { ads: [], peopleAlsoAsk: [], organic: [], shopping: [], local: [], ...partial };
}

export function ad(domain: string, title: string, extra: Partial<RawSearchAd> = {}): RawSearchAd {
  return { position: 1, blockPosition: "top", title, link: `https://www.${domain}/landing`, displayedLink: `https://www.${domain}`, description: `${title} description`, ...extra };
}

export function organic(domain: string, title: string, position = 1, snippet = "") {
  return { position, title, link: `https://www.${domain}/page`, snippet, domain };
}

export function questions(...texts: string[]) {
  return texts.map((question) => ({ question, snippet: `Google's answer to ${question}`, title: "Source", link: "https://source.example/a" }));
}

type SearchResponse = GoogleSearchData | ProviderFailureKind;

/** Fake SerpApi: canned data per query (unknown queries return empty results) and per Ad Library domain. */
export function fakeSerp(options: {
  searches?: Record<string, SearchResponse>;
  library?: Record<string, AdvertiserAdCreative[] | ProviderFailureKind>;
  location?: string | null;
  fromCache?: boolean;
} = {}) {
  const calls = { search: [] as string[], library: [] as string[], location: [] as string[] };
  const ok = <T>(data: T): ProviderResult<T> => ({ ok: true, data, fromCache: Boolean(options.fromCache), fetchedAt: NOW.toISOString() });
  const fail = (kind: ProviderFailureKind): ProviderResult<never> => ({ ok: false, kind, message: `fake ${kind}` });

  const client: SerpApiClient = {
    async googleSearch(query, _market, ctx) {
      calls.search.push(query);
      const response = options.searches?.[query] ?? serp();
      ctx.ledger.record({ provider: "serpapi", operation: "google", query, purpose: ctx.purpose, cacheHit: Boolean(options.fromCache), success: typeof response !== "string", durationMs: 1 });
      return typeof response === "string" ? fail(response) : ok(response);
    },
    async adLibrary(domain, _market, ctx) {
      calls.library.push(domain);
      const response = options.library?.[domain] ?? [];
      ctx.ledger.record({ provider: "serpapi", operation: "google_ads_transparency_center", query: domain, purpose: ctx.purpose, cacheHit: false, success: typeof response !== "string", durationMs: 1 });
      return typeof response === "string" ? fail(response) : ok<AdLibraryData>({ creatives: response });
    },
    async resolveLocation(city) {
      calls.location.push(city);
      return options.location ?? null;
    },
  };
  return { client, calls };
}

export function deps(options: {
  serp: SerpApiClient;
  tavily?: TavilySearchResult[] | ProviderFailureKind;
  competitors?: Array<Partial<IdentifiedCompetitor> & { name: string; domain: string }> | null;
}): Partial<ResearchDeps> & { geminiCalls: number; tavilyQueries: string[] } {
  const state = { geminiCalls: 0, tavilyQueries: [] as string[] };
  return {
    serp: options.serp,
    tavily: async (query, ledger) => {
      state.tavilyQueries.push(query);
      const response = options.tavily ?? [];
      ledger.record({ provider: "tavily", operation: "search", query, purpose: "market_evidence", cacheHit: false, success: typeof response !== "string", durationMs: 1 });
      return typeof response === "string"
        ? { ok: false, kind: response, message: `fake ${response}` }
        : { ok: true, data: response, fromCache: false, fetchedAt: NOW.toISOString() };
    },
    identifyCompetitors: async () => {
      state.geminiCalls++;
      if (options.competitors === null) return null;
      return (options.competitors || []).map((c) => ({ type: "direct" as const, similarity: 80, why: `${c.name} sells the same thing.`, evidence: [1], ...c }));
    },
    now: () => NOW,
    get geminiCalls() {
      return state.geminiCalls;
    },
    get tavilyQueries() {
      return state.tavilyQueries;
    },
  };
}

export function article(title: string, content: string, url = "https://news.example/best-of"): TavilySearchResult {
  return { title, url, content, score: 0.9, publishedDate: null, source: new URL(url).hostname };
}

export function creative(id: string, extra: Partial<AdvertiserAdCreative> = {}): AdvertiserAdCreative {
  return {
    id,
    advertiser: "Rival Inc",
    targetDomain: "",
    format: "image",
    image: `https://tpc.googlesyndication.com/archive/simgad/${id}`,
    firstShownAt: "2026-09-01T00:00:00.000Z",
    lastShownAt: "2026-10-20T00:00:00.000Z",
    detailsLink: `https://adstransparency.google.com/advertiser/AR1/creative/${id}`,
    source: "serpapi_google_ads_transparency_center",
    ...extra,
  };
}
