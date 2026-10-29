/**
 * Research budget: how much the first Search Intel run collects and how many paid searches
 * it may make. Each value can be overridden with the environment variable of the same name.
 * These are ceilings, not targets: the pipeline never invents records to reach them.
 */

export interface ResearchConfig {
  /** Buyer questions shown (Google "People also ask") */
  maxQuestions: number;
  /** Distinct competitor search ads, and Ad Library creatives, each */
  maxAds: number;
  maxCompetitors: number;
  /** Google searches used to find competitors (1 SerpApi credit each unless cached) */
  maxDiscoveryQueries: number;
  /** Extra Google searches aimed at competitor ads */
  maxAdQueries: number;
  /** Ads Transparency Center lookups, one per competitor */
  maxAdLibraryLookups: number;
  /** Retries per failed provider request (429, 5xx, network) */
  maxRetries: number;
  /** How long provider results are reused before searching again */
  cacheTtlHours: number;
  /**
   * SerpApi engine for Google searches. "google_ads" returns sponsored results plus organic
   * results and People Also Ask; in a side-by-side check (Oct 2026) it showed ads where
   * "google" showed none for the same query, at the same cost.
   */
  searchEngine: "google_ads" | "google";
}

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
}

export function researchConfig(overrides: Partial<ResearchConfig> = {}): ResearchConfig {
  return {
    maxQuestions: intFromEnv("MAX_INITIAL_QUESTIONS", 10, 0, 50),
    maxAds: intFromEnv("MAX_INITIAL_ADS", 10, 0, 50),
    maxCompetitors: intFromEnv("MAX_INITIAL_COMPETITORS", 10, 1, 30),
    maxDiscoveryQueries: intFromEnv("MAX_COMPETITOR_DISCOVERY_QUERIES", 2, 1, 6),
    maxAdQueries: intFromEnv("MAX_AD_SEARCH_QUERIES", 3, 0, 6),
    maxAdLibraryLookups: intFromEnv("MAX_AD_LIBRARY_LOOKUPS", 2, 0, 6),
    maxRetries: intFromEnv("MAX_RESEARCH_RETRIES", 1, 0, 3),
    cacheTtlHours: intFromEnv("RESEARCH_CACHE_TTL_HOURS", 72, 0, 24 * 30),
    searchEngine: process.env.SERPAPI_SEARCH_ENGINE === "google" ? "google" : "google_ads",
    ...overrides,
  };
}
