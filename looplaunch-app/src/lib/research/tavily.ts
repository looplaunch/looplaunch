/**
 * Tavily Search API Service
 *
 * Market research via Tavily's official SDK (@tavily/core).
 * Reads TAVILY_API_KEY from environment — never hardcoded.
 *
 * Includes:
 * - Reusable search function with configurable depth, topic, max results, domain filters
 * - Structured result normalization into Loop Launch's internal format
 * - In-memory cache with TTL ("Research Once, Answer Many Times")
 * - Comprehensive error handling (missing key, invalid key, rate limits, timeouts)
 * - Logging that NEVER exposes the API key
 */

import { tavily } from "@tavily/core";
import type { TavilySearchResult } from "../intelligence/types";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface TavilySearchOptions {
  /** The search query string */
  query: string;
  /** Search depth: "basic" (faster, cheaper) or "advanced" (deeper, richer) */
  searchDepth?: "basic" | "advanced";
  /** Topic/category hint for the search engine */
  topic?: "general" | "news" | "finance";
  /** Maximum number of results to return (1-20, default 10) */
  maxResults?: number;
  /** Only include results from these domains */
  includeDomains?: string[];
  /** Exclude results from these domains */
  excludeDomains?: string[];
  /** Rank pages from this country higher ("India"); Tavily applies it to general searches only */
  country?: string;
}

export interface TavilySearchResponse {
  /** Whether the search succeeded */
  success: boolean;
  /** Normalized search results */
  results: TavilySearchResult[];
  /** Tavily's generated answer summary, if available */
  answer?: string;
  /** Error message if the search failed */
  error?: string;
  /** How long the search took in ms */
  durationMs: number;
  /** Whether results came from cache */
  fromCache: boolean;
}

// ──────────────────────────────────────────────
// Error Classification
// ──────────────────────────────────────────────

type TavilyErrorKind =
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "api_error"
  | "unknown";

function classifyError(error: unknown): { kind: TavilyErrorKind; message: string } {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("api key") || msg.includes("unauthorized") || msg.includes("401")) {
      return { kind: "invalid_api_key", message: "Tavily API key is invalid or expired." };
    }
    if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many requests")) {
      return { kind: "rate_limited", message: "Tavily rate limit exceeded. Please wait before retrying." };
    }
    if (msg.includes("timeout") || msg.includes("aborted") || msg.includes("timed out")) {
      return { kind: "timeout", message: "Tavily request timed out." };
    }
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("econnrefused") || msg.includes("enotfound")) {
      return { kind: "network_error", message: "Network error contacting Tavily API." };
    }

    return { kind: "api_error", message: error.message };
  }

  return { kind: "unknown", message: String(error) };
}

// ──────────────────────────────────────────────
// Search Cache (in-memory, simple dedup)
// ──────────────────────────────────────────────

const searchCache = new Map<string, { results: TavilySearchResult[]; answer?: string; cachedAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getCacheKey(opts: TavilySearchOptions): string {
  return JSON.stringify({
    q: opts.query.toLowerCase().trim(),
    d: opts.searchDepth || "advanced",
    t: opts.topic || "general",
    m: opts.maxResults || 10,
    inc: opts.includeDomains?.sort() || [],
    exc: opts.excludeDomains?.sort() || [],
    c: countryParam(opts) || "",
  });
}

/** Tavily wants a lowercase English country name ("india"), and only boosts general searches. */
function countryParam(opts: TavilySearchOptions): string | undefined {
  const country = opts.country?.trim().toLowerCase();
  return country && (opts.topic || "general") === "general" ? country : undefined;
}

// ──────────────────────────────────────────────
// Client Factory
// ──────────────────────────────────────────────

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return null;
  }
  return tavily({ apiKey });
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Check if Tavily is configured and available.
 */
export function isTavilyAvailable(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

/**
 * Reusable search function with full configuration support.
 *
 * Accepts search query, depth, topic, max results, and domain filters.
 * Returns structured research results normalized into Loop Launch's format.
 * Uses cache when possible. Never logs the API key.
 */
export async function searchTavily(opts: TavilySearchOptions): Promise<TavilySearchResponse> {
  const startTime = Date.now();

  // ── Guard: missing API key ──
  if (!isTavilyAvailable()) {
    console.warn("[TAVILY] Search aborted: TAVILY_API_KEY is not configured in the environment.");
    return {
      success: false,
      results: [],
      error: "TAVILY_API_KEY is not configured in the environment.",
      durationMs: Date.now() - startTime,
      fromCache: false,
    };
  }

  console.log("[TAVILY] Search started");
  console.log(`[TAVILY] Query: ${opts.query}`);

  // ── Check cache ──
  const cacheKey = getCacheKey(opts);
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    console.log(`[TAVILY] Cache hit for: "${opts.query}"`);
    console.log(`[TAVILY] Results returned: ${cached.results.length} (from cache)`);
    return {
      success: true,
      results: cached.results,
      answer: cached.answer,
      durationMs: Date.now() - startTime,
      fromCache: true,
    };
  }

  // ── Execute search ──
  try {
    const client = getTavilyClient();
    if (!client) {
      console.error("[TAVILY] Failed to initialize Tavily client.");
      return {
        success: false,
        results: [],
        error: "Failed to initialize Tavily client.",
        durationMs: Date.now() - startTime,
        fromCache: false,
      };
    }

    const country = countryParam(opts);
    const response = await client.search(opts.query, {
      searchDepth: opts.searchDepth || "advanced",
      topic: opts.topic || "general",
      maxResults: opts.maxResults || 10,
      includeAnswer: true,
      includeRawContent: false,
      ...(opts.includeDomains?.length ? { includeDomains: opts.includeDomains } : {}),
      ...(opts.excludeDomains?.length ? { excludeDomains: opts.excludeDomains } : {}),
      ...(country ? { country } : {}),
    });

    // ── Normalize results into Loop Launch format ──
    const results: TavilySearchResult[] = (response.results || []).map(
      (r: { title?: string; url?: string; content?: string; score?: number; publishedDate?: string }) => {
        let source = "";
        try {
          source = new URL(r.url || "").hostname.replace(/^www\./, "");
        } catch {
          source = r.url || "";
        }

        return {
          title: r.title || "",
          url: r.url || "",
          content: r.content || "",
          score: r.score || 0,
          publishedDate: r.publishedDate || null,
          source,
        };
      }
    );

    // ── Handle empty results ──
    if (results.length === 0) {
      console.log(`[TAVILY] Results returned: 0`);
      return {
        success: true,
        results: [],
        answer: typeof response.answer === "string" ? response.answer : undefined,
        durationMs: Date.now() - startTime,
        fromCache: false,
      };
    }

    // ── Cache results ──
    const answer = typeof response.answer === "string" ? response.answer : undefined;
    searchCache.set(cacheKey, { results, answer, cachedAt: Date.now() });

    console.log(`[TAVILY] Results returned: ${results.length}`);

    return {
      success: true,
      results,
      answer,
      durationMs: Date.now() - startTime,
      fromCache: false,
    };
  } catch (error) {
    const classified = classifyError(error);
    console.error(`[TAVILY] Search failed (${classified.kind}): ${classified.message}`);

    return {
      success: false,
      results: [],
      error: classified.message,
      durationMs: Date.now() - startTime,
      fromCache: false,
    };
  }
}

export interface QuestionResearchResult {
  status: "success" | "no_results" | "failed" | "unconfigured";
  results: TavilySearchResult[];
  answer?: string;
  error?: string;
  query: string;
}

/**
 * Conduct real-time web research on a specific user question, favouring pages from the
 * analysis's market. Normalizes results and handles errors without throwing.
 */
export async function researchQuestion(
  question: string,
  options: { country?: string } = {}
): Promise<QuestionResearchResult> {
  const searchQuery = question.trim();

  if (!isTavilyAvailable()) {
    console.warn("[TAVILY] API key not configured — skipping web research");
    return {
      status: "unconfigured",
      results: [],
      error: "TAVILY_API_KEY is not configured.",
      query: searchQuery,
    };
  }

  const response = await searchTavily({
    query: searchQuery,
    searchDepth: "advanced",
    maxResults: 6,
    topic: "general",
    country: options.country,
  });

  if (!response.success) {
    return {
      status: "failed",
      results: [],
      error: response.error,
      query: searchQuery,
    };
  }

  if (response.results.length === 0) {
    return {
      status: "no_results",
      results: [],
      answer: response.answer,
      query: searchQuery,
    };
  }

  return {
    status: "success",
    results: response.results,
    answer: response.answer,
    query: searchQuery,
  };
}

/**
 * Backward-compatible wrapper: search the web for market intelligence.
 * Returns cached results if available.
 */
export async function searchMarket(query: string): Promise<TavilySearchResult[]> {
  const response = await searchTavily({
    query,
    searchDepth: "advanced",
    maxResults: 10,
  });
  return response.results;
}

/**
 * Run multiple market research searches and combine results.
 * Builds queries from onboarding data to cover different angles.
 *
 * Returns both the raw Tavily results (for storage) and a summary text
 * (for passing to Gemini for structuring). This keeps raw research
 * separate from synthesized intelligence.
 */
export async function runMarketResearch(
  industry: string,
  targetAudience: string,
  competitors: string
): Promise<{ allResults: TavilySearchResult[]; summaryText: string }> {
  if (!isTavilyAvailable()) {
    console.log("[Tavily] Skipping market research — API key not configured");
    return { allResults: [], summaryText: "" };
  }

  // Build diverse search queries
  const currentYear = new Date().getFullYear();
  const queries: TavilySearchOptions[] = [
    {
      query: `${industry} market trends ${currentYear - 1} ${currentYear}`,
      searchDepth: "advanced",
      maxResults: 8,
    },
    {
      query: `${industry} ${targetAudience} market size growth`,
      searchDepth: "advanced",
      maxResults: 8,
    },
    {
      query: `${industry} competitive landscape analysis`,
      searchDepth: "advanced",
      maxResults: 8,
    },
  ];

  // Add competitor-specific queries if provided
  if (competitors) {
    const competitorNames = competitors
      .split(/[,\n]/)
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 3); // Max 3 competitor searches

    for (const name of competitorNames) {
      queries.push({
        query: `${name} company marketing strategy`,
        searchDepth: "basic",
        maxResults: 5,
      });
    }
  }

  // Run all searches in parallel
  const results = await Promise.allSettled(queries.map((q) => searchTavily(q)));

  const allResults: TavilySearchResult[] = [];
  let failedCount = 0;

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      allResults.push(...result.value.results);
    } else {
      failedCount++;
    }
  }

  if (failedCount > 0) {
    console.warn(`[Tavily] ${failedCount}/${queries.length} market research queries failed`);
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Build summary text for Gemini — this is the "Extract Facts" step
  // Raw results are kept separate; only the text summary goes to the AI
  const summaryText = deduped
    .map(
      (r) =>
        `[${r.title}]\n${r.content}\nSource: ${r.url}${r.publishedDate ? ` (${r.publishedDate})` : ""}\nRelevance: ${(r.score * 100).toFixed(0)}%\n`
    )
    .join("\n---\n");

  console.log(
    `[Tavily] Market research complete: ${deduped.length} unique results from ${queries.length} queries`
  );

  return { allResults: deduped, summaryText };
}

/**
 * Test the Tavily integration with a sample query.
 * Used by the /api/intelligence/tavily-test endpoint.
 * Returns the full TavilySearchResponse for inspection.
 */
export async function testTavilyIntegration(
  query: string = "Analyze the SaaS CRM market in the United States"
): Promise<TavilySearchResponse> {
  return searchTavily({
    query,
    searchDepth: "basic",
    maxResults: 5,
    topic: "general",
  });
}
