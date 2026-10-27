/**
 * SerpApi Search & Google Intelligence Service
 *
 * Powers:
 * 1. Google Search Intelligence (Organic rankings, People Also Ask questions, Related Searches)
 * 2. Keyword-Level Ad Discovery (Google Ads engine with exact location & ad metadata)
 * 3. Advertiser-Level Creative Research (Google Ads Transparency Center)
 * 4. Google Shopping Intelligence (Product listings, pricing, and merchant sources)
 *
 * All operations include in-memory TTL caching, bounded timeouts, and strict error handling.
 */

import type {
  KeywordAdResult,
  AdvertiserAdCreative,
  ShoppingProduct,
} from "../intelligence/types";

export interface GoogleAd {
  position: number;
  blockPosition?: "top" | "bottom";
  title: string;
  link: string;
  snippet?: string;
  displayedLink?: string;
  trackingLink?: string;
  advertiserName?: string;
  sitelinks?: { title: string; link: string }[];
}

export interface PeopleAlsoAskQuestion {
  question: string;
  snippet?: string;
  title?: string;
  link?: string;
}

export interface OrganicSearchResult {
  position: number;
  title: string;
  link: string;
  snippet?: string;
  displayedLink?: string;
  domain?: string;
}

export interface SerpApiIntelligence {
  query: string;
  ads: GoogleAd[];
  peopleAlsoAsk: PeopleAlsoAskQuestion[];
  organicResults: OrganicSearchResult[];
  relatedSearches: string[];
  totalAds: number;
  totalQuestions: number;
  shoppingResults?: ShoppingProduct[];
  collectedAt: string;
}

export interface TransparencyCenterResult {
  advertiserQuery: string;
  status:
    | "verified_has_ads"
    | "no_ads_found"
    | "not_verified"
    | "api_error"
    | "insufficient_evidence";
  advertiserName?: string;
  advertiserId?: string;
  targetDomain?: string;
  creatives: AdvertiserAdCreative[];
  totalCreatives: number;
  error?: string;
  collectedAt: string;
}

// ──────────────────────────────────────────────
// In-Memory Cache (TTL: 6 hours)
// ──────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const serpCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getCached<T>(key: string): T | null {
  const entry = serpCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    serpCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
  serpCache.set(key, { data, timestamp: Date.now() });
}

function getApiKey(): string | null {
  return process.env.SERPAPI_API_KEY || null;
}

function extractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return urlStr.toLowerCase();
  }
}

// ──────────────────────────────────────────────
// 1. Google Search Intelligence (General & Organic)
// ──────────────────────────────────────────────

/**
 * Perform a live Google Search via SerpApi to gather competitive ad, question, and organic search intelligence.
 */
export async function searchGoogleIntelligence(
  query: string,
  options: { location?: string; num?: number; gl?: string; hl?: string } = {}
): Promise<SerpApiIntelligence | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[SerpApi] SERPAPI_API_KEY is not configured.");
    return null;
  }

  const location = options.location || "United States";
  const num = options.num || 10;
  const gl = options.gl || "us";
  const hl = options.hl || "en";

  const cacheKey = `google:${query.toLowerCase().trim()}:${location}:${gl}:${num}`;
  const cached = getCached<SerpApiIntelligence>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("location", location);
    url.searchParams.set("hl", hl);
    url.searchParams.set("gl", gl);
    url.searchParams.set("num", num.toString());
    url.searchParams.set("api_key", apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[SerpApi] HTTP ${res.status} response for query: "${query}"`);
      return null;
    }

    const data = await res.json();
    if (data.error) {
      console.warn(`[SerpApi] API error for "${query}":`, data.error);
      return null;
    }

    // 1. Extract Google Ads
    const rawAds = Array.isArray(data.ads) ? data.ads : [];
    const ads: GoogleAd[] = rawAds.map((ad: Record<string, unknown>, idx: number) => ({
      position: (ad.position as number) || idx + 1,
      blockPosition: ((ad.block_position as string) === "bottom" ? "bottom" : "top") as "top" | "bottom",
      title: (ad.title as string) || "",
      link: (ad.link as string) || (ad.tracking_link as string) || "",
      snippet: (ad.description as string) || (ad.snippet as string) || "",
      displayedLink: (ad.displayed_link as string) || "",
      trackingLink: (ad.tracking_link as string) || undefined,
      advertiserName: (ad.source as string) || (ad.displayed_link as string) || undefined,
      sitelinks: Array.isArray(ad.sitelinks)
        ? (ad.sitelinks as Array<{ title?: string; link?: string }>).map((s) => ({
            title: s.title || "",
            link: s.link || "",
          }))
        : [],
    }));

    // 2. Extract People Also Ask questions
    const rawPaa = Array.isArray(data.related_questions) ? data.related_questions : [];
    const peopleAlsoAsk: PeopleAlsoAskQuestion[] = rawPaa.map((paa: Record<string, unknown>) => {
      // Google now often answers PAA with an AI overview: the text lives in `text_blocks`
      // (paragraphs and lists) and the source in `references`, not in `snippet`/`link`.
      const blocks = Array.isArray(paa.text_blocks) ? (paa.text_blocks as Record<string, unknown>[]) : [];
      const blockText = blocks
        .flatMap((b) => {
          if (typeof b.snippet === "string") return [b.snippet];
          if (Array.isArray(b.list)) {
            return (b.list as Record<string, unknown>[])
              .map((li) => [li.title, li.snippet].filter((x) => typeof x === "string").join(" "))
              .filter(Boolean)
              .map((t) => `• ${t}`);
          }
          return [];
        })
        .join("\n")
        .trim();
      const list = Array.isArray(paa.list) ? (paa.list as unknown[]).filter((x) => typeof x === "string") : [];
      const refs = Array.isArray(paa.references) ? (paa.references as Record<string, unknown>[]) : [];

      return {
        question: (paa.question as string) || "",
        snippet: (paa.snippet as string) || blockText || list.map((l) => `• ${l}`).join("\n"),
        title: (paa.title as string) || (refs[0]?.title as string) || "",
        link: (paa.link as string) || (refs[0]?.link as string) || "",
      };
    });

    // 3. Extract Organic Results
    const rawOrganic = Array.isArray(data.organic_results) ? data.organic_results : [];
    const organicResults: OrganicSearchResult[] = rawOrganic.slice(0, 10).map((org: Record<string, unknown>, idx: number) => {
      const link = (org.link as string) || "";
      return {
        position: (org.position as number) || idx + 1,
        title: (org.title as string) || "",
        link,
        snippet: (org.snippet as string) || "",
        displayedLink: (org.displayed_link as string) || "",
        domain: extractDomain(link),
      };
    });

    // 4. Extract Related Searches
    const rawRelated = Array.isArray(data.related_searches) ? data.related_searches : [];
    const relatedSearches: string[] = rawRelated
      .map((r: Record<string, unknown>) => (r.query as string) || "")
      .filter(Boolean);

    // 5. Extract Inline Shopping / Product Results if present
    const rawShopping = Array.isArray(data.shopping_results)
      ? data.shopping_results
      : Array.isArray(data.inline_shopping)
      ? data.inline_shopping
      : [];
    const shoppingResults: ShoppingProduct[] = rawShopping.slice(0, 6).map((sp: Record<string, unknown>, idx: number) => ({
      position: (sp.position as number) || idx + 1,
      title: (sp.title as string) || "",
      price: (sp.price as string) || undefined,
      source: (sp.source as string) || undefined,
      link: (sp.link as string) || (sp.product_link as string) || "",
      rating: typeof sp.rating === "number" ? sp.rating : undefined,
      reviews: typeof sp.reviews === "number" ? sp.reviews : undefined,
      thumbnail: (sp.thumbnail as string) || undefined,
    }));

    const result: SerpApiIntelligence = {
      query,
      ads,
      peopleAlsoAsk,
      organicResults,
      relatedSearches,
      totalAds: ads.length,
      totalQuestions: peopleAlsoAsk.length,
      shoppingResults: shoppingResults.length > 0 ? shoppingResults : undefined,
      collectedAt: new Date().toISOString(),
    };

    setCached(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[SerpApi] Failed to fetch intelligence for "${query}":`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ──────────────────────────────────────────────
// 2. Keyword-Level Ad Discovery (Google Ads Engine)
// ──────────────────────────────────────────────

/**
 * Dedicated keyword-level Google Ads research using SerpApi's `google_ads` engine.
 * Requires `location` parameter.
 */
export async function searchKeywordAds(
  query: string,
  options: { location?: string; gl?: string; hl?: string } = {}
): Promise<KeywordAdResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[SerpApi] SERPAPI_API_KEY is not configured.");
    return [];
  }

  const location = options.location || "United States";
  const gl = options.gl || "us";
  const hl = options.hl || "en";

  const cacheKey = `keyword_ads:${query.toLowerCase().trim()}:${location}:${gl}`;
  const cached = getCached<KeywordAdResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_ads");
    url.searchParams.set("q", query);
    url.searchParams.set("location", location);
    url.searchParams.set("hl", hl);
    url.searchParams.set("gl", gl);
    url.searchParams.set("api_key", apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[SerpApi] google_ads HTTP ${res.status} for "${query}"`);
      return [];
    }

    const data = await res.json();
    if (data.error) {
      console.warn(`[SerpApi] google_ads API error for "${query}":`, data.error);
      return [];
    }

    const rawAds = Array.isArray(data.ads) ? data.ads : [];
    const collectedAt = new Date().toISOString();

    const ads: KeywordAdResult[] = rawAds.map((ad: Record<string, unknown>, idx: number) => {
      const position = (ad.position as number) || idx + 1;
      const blockPosition = (ad.block_position as string) === "bottom" ? "bottom" : "top";
      const title = (ad.title as string) || "";
      const link = (ad.link as string) || (ad.tracking_link as string) || "";
      const displayedLink = (ad.displayed_link as string) || "";
      const snippet = (ad.description as string) || (ad.snippet as string) || "";
      const advertiserName = (ad.source as string) || displayedLink || undefined;

      const sitelinks = Array.isArray(ad.sitelinks)
        ? (ad.sitelinks as Array<{ title?: string; link?: string }>).map((s) => ({
            title: s.title || "",
            link: s.link || "",
          }))
        : [];

      return {
        id: `ad_kw_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        position,
        blockPosition,
        title,
        link,
        displayedLink,
        trackingLink: (ad.tracking_link as string) || undefined,
        snippet,
        advertiserName,
        sitelinks: sitelinks.length > 0 ? sitelinks : undefined,
        query,
        location,
        collectedAt,
      };
    });

    setCached(cacheKey, ads);
    return ads;
  } catch (err) {
    console.warn(`[SerpApi] Failed google_ads for "${query}":`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ──────────────────────────────────────────────
// 3. Advertiser-Level Creative Research (Transparency Center)
// ──────────────────────────────────────────────

/**
 * Retrieve verified advertising creatives and metadata for a specific advertiser or domain
 * via SerpApi's `google_ads_transparency_center` engine.
 *
 * Explicitly distinguishes:
 * - "verified_has_ads": Advertiser found with active creatives
 * - "no_ads_found": Advertiser queried but 0 creatives found
 * - "not_verified": Advertiser domain not found in transparency registry
 * - "api_error": Network or service failure
 */
export async function searchAdvertiserTransparency(
  advertiserQuery: string,
  options: { gl?: string; format?: "TEXT" | "IMAGE" | "VIDEO" } = {}
): Promise<TransparencyCenterResult> {
  const apiKey = getApiKey();
  const collectedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      advertiserQuery,
      status: "insufficient_evidence",
      creatives: [],
      totalCreatives: 0,
      error: "SERPAPI_API_KEY is not configured",
      collectedAt,
    };
  }

  const cleanQuery = advertiserQuery.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const gl = options.gl || "us";

  const cacheKey = `transparency:${cleanQuery.toLowerCase()}:${gl}:${options.format || "all"}`;
  const cached = getCached<TransparencyCenterResult>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_ads_transparency_center");
    url.searchParams.set("text", cleanQuery);
    url.searchParams.set("gl", gl);
    if (options.format) {
      url.searchParams.set("format", options.format);
    }
    url.searchParams.set("api_key", apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        advertiserQuery,
        status: "api_error",
        creatives: [],
        totalCreatives: 0,
        error: `HTTP ${res.status} from Google Ads Transparency Center`,
        collectedAt,
      };
    }

    const data = await res.json();

    // Check for empty results reported by Transparency Center
    if (data.error) {
      const errLower = String(data.error).toLowerCase();
      if (
        errLower.includes("hasn't returned any results") ||
        errLower.includes("empty") ||
        errLower.includes("no results")
      ) {
        const emptyResult: TransparencyCenterResult = {
          advertiserQuery,
          status: "no_ads_found",
          targetDomain: cleanQuery,
          creatives: [],
          totalCreatives: 0,
          collectedAt,
        };
        setCached(cacheKey, emptyResult);
        return emptyResult;
      }

      return {
        advertiserQuery,
        status: "not_verified",
        creatives: [],
        totalCreatives: 0,
        error: String(data.error),
        collectedAt,
      };
    }

    const rawCreatives = Array.isArray(data.ad_creatives) ? data.ad_creatives : [];
    if (rawCreatives.length === 0) {
      const noAdsResult: TransparencyCenterResult = {
        advertiserQuery,
        status: "no_ads_found",
        targetDomain: cleanQuery,
        creatives: [],
        totalCreatives: 0,
        collectedAt,
      };
      setCached(cacheKey, noAdsResult);
      return noAdsResult;
    }

    // Extract first advertiser metadata
    const firstAd = rawCreatives[0] || {};
    const advertiserName = (firstAd.advertiser as string) || (data.advertiser?.name as string) || cleanQuery;
    const advertiserId = (firstAd.advertiser_id as string) || (data.advertiser?.id as string) || undefined;

    // Deduplicate repeated creatives by creative ID or image/body
    const seenCreatives = new Set<string>();
    const creatives: AdvertiserAdCreative[] = [];

    for (const ad of rawCreatives) {
      const creativeId = (ad.ad_creative_id as string) || (ad.image as string) || (ad.body as string) || "";
      if (creativeId && seenCreatives.has(creativeId)) continue;
      if (creativeId) seenCreatives.add(creativeId);

      const formatRaw = ((ad.format as string) || "text").toLowerCase();
      const format: "text" | "image" | "video" =
        formatRaw === "image" ? "image" : formatRaw === "video" ? "video" : "text";

      creatives.push({
        id: (ad.ad_creative_id as string) || `cr_${creatives.length + 1}`,
        advertiser: (ad.advertiser as string) || advertiserName,
        advertiserId: (ad.advertiser_id as string) || advertiserId,
        targetDomain: (ad.target_domain as string) || cleanQuery,
        format,
        image: (ad.image as string) || undefined,
        video: (ad.video as string) || undefined,
        body: (ad.body as string) || (ad.title as string) || undefined,
        firstShown: (ad.first_shown as string) || undefined,
        lastShown: (ad.last_shown as string) || undefined,
        detailsLink: (ad.details_link as string) || undefined,
      });

      if (creatives.length >= 12) break; // Keep top 12 distinct creatives
    }

    const result: TransparencyCenterResult = {
      advertiserQuery,
      status: "verified_has_ads",
      advertiserName,
      advertiserId,
      targetDomain: cleanQuery,
      creatives,
      totalCreatives: creatives.length,
      collectedAt,
    };

    setCached(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[SerpApi] Transparency Center error for "${cleanQuery}":`, err instanceof Error ? err.message : String(err));
    return {
      advertiserQuery,
      status: "api_error",
      creatives: [],
      totalCreatives: 0,
      error: err instanceof Error ? err.message : String(err),
      collectedAt,
    };
  }
}

// ──────────────────────────────────────────────
// 4. Google Shopping Intelligence
// ──────────────────────────────────────────────

/**
 * Query Google Shopping for product pricing, merchant visibility, and consumer offers.
 */
export async function searchGoogleShopping(
  query: string,
  options: { location?: string; gl?: string; hl?: string; num?: number } = {}
): Promise<ShoppingProduct[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const location = options.location || "United States";
  const gl = options.gl || "us";
  const hl = options.hl || "en";
  const num = options.num || 8;

  const cacheKey = `shopping:${query.toLowerCase().trim()}:${location}:${gl}`;
  const cached = getCached<ShoppingProduct[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("location", location);
    url.searchParams.set("hl", hl);
    url.searchParams.set("gl", gl);
    url.searchParams.set("num", num.toString());
    url.searchParams.set("api_key", apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();
    const rawShopping = Array.isArray(data.shopping_results) ? data.shopping_results : [];

    const products: ShoppingProduct[] = rawShopping.slice(0, num).map((sp: Record<string, unknown>, idx: number) => ({
      position: (sp.position as number) || idx + 1,
      title: (sp.title as string) || "",
      price: (sp.price as string) || undefined,
      source: (sp.source as string) || (sp.seller as string) || undefined,
      link: (sp.link as string) || (sp.product_link as string) || "",
      rating: typeof sp.rating === "number" ? sp.rating : undefined,
      reviews: typeof sp.reviews === "number" ? sp.reviews : undefined,
      thumbnail: (sp.thumbnail as string) || undefined,
    }));

    setCached(cacheKey, products);
    return products;
  } catch (err) {
    console.warn(`[SerpApi] Shopping error for "${query}":`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Backward-compatible helper to fetch search footprint for a competitor.
 */
export async function getCompetitorSearchFootprint(
  competitorName: string
): Promise<SerpApiIntelligence | null> {
  const query = `${competitorName} pricing alternatives`;
  return await searchGoogleIntelligence(query);
}
