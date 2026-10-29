/**
 * SerpApi client for Search Intel.
 *
 * Engines used (1 search credit each, unless served from our cache):
 * - `google_ads` (default, SERPAPI_SEARCH_ENGINE=google to switch): sponsored results (ads),
 *   plus organic results, People Also Ask and more for one query. Same shape as `google`,
 *   so one parser reads both. One call answers several research needs.
 * - `google_ads_transparency_center`: an advertiser's ads in Google's Ads Transparency
 *   Center (`text` = domain, `region` = numeric country code).
 * Free endpoints: Locations API (city → canonical location) and Account API (quota).
 *
 * Every call returns either data or a typed failure, so "the search failed" is never
 * confused with "the search found nothing". Results are cached (see cache.ts) and every
 * request is written to the run's ledger (see ledger.ts). The API key never leaves the server.
 */

import type { AdvertiserAdCreative, ShoppingProduct } from "../intelligence/types";
import { cacheKey, type ResearchCache } from "./cache";
import type { ResearchConfig } from "./config";
import type { Purpose, ResearchLedger } from "./ledger";
import type { SearchMarket } from "./market";

/** Bump when a parser changes, so cached results parsed the old way aren't reused. */
const PARSER_VERSION = 2;
const ENDPOINT = "https://serpapi.com/search.json";
const TIMEOUT_MS = 15_000;
/** SerpApi reports an empty result page as an error message; it is a valid, empty answer. */
const NO_RESULTS = /hasn't returned any results|no results/i;

// ──────────────────────────────────────────────
// Parsed shapes
// ──────────────────────────────────────────────

export interface PeopleAlsoAskQuestion {
  question: string;
  snippet?: string;
  title?: string;
  link?: string;
  /** Loopy's AI-written answer and marketing tip, added after the search */
  answer?: string;
  tip?: string;
}

export interface OrganicSearchResult {
  position: number;
  title: string;
  link: string;
  snippet?: string;
  displayedLink?: string;
  domain?: string;
}

export interface RawSearchAd {
  position: number;
  blockPosition?: "top" | "bottom";
  title: string;
  link: string;
  displayedLink?: string;
  trackingLink?: string;
  description?: string;
  /** Advertiser label: a domain on some engines, a name on others */
  source?: string;
  sitelinks?: { title: string; link: string }[];
}

export interface LocalPlace {
  position: number;
  title: string;
  address?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  website?: string;
}

export interface GoogleSearchData {
  ads: RawSearchAd[];
  peopleAlsoAsk: PeopleAlsoAskQuestion[];
  organic: OrganicSearchResult[];
  shopping: ShoppingProduct[];
  local: LocalPlace[];
}

export interface AdLibraryData {
  creatives: AdvertiserAdCreative[];
}

export type ProviderFailureKind = "not_configured" | "rate_limited" | "quota" | "http" | "network" | "provider_error";

export type ProviderResult<T> =
  | { ok: true; data: T; fromCache: boolean; fetchedAt: string }
  | { ok: false; kind: ProviderFailureKind; message: string };

export interface SerpCallContext {
  ledger: ResearchLedger;
  purpose: Purpose;
}

export interface SerpApiClient {
  googleSearch(query: string, market: SearchMarket, ctx: SerpCallContext): Promise<ProviderResult<GoogleSearchData>>;
  adLibrary(domain: string, market: SearchMarket, ctx: SerpCallContext): Promise<ProviderResult<AdLibraryData>>;
  /** Free Locations API: "Austin, Texas" → "Austin,Texas,United States". */
  resolveLocation(city: string, iso2: string, ctx?: SerpCallContext): Promise<string | null>;
}

// ──────────────────────────────────────────────
// Parsers (pure)
// ──────────────────────────────────────────────

type Json = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : []);
const httpUrl = (v: unknown): string | undefined => (/^https?:\/\//i.test(str(v)) ? str(v) : undefined);

function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Sitelinks come as an array, or as { inline: [...], expanded: [...] }. */
function parseSitelinks(raw: unknown): { title: string; link: string }[] | undefined {
  const items = Array.isArray(raw)
    ? arr(raw)
    : raw && typeof raw === "object"
      ? [...arr((raw as Json).inline), ...arr((raw as Json).expanded)]
      : [];
  const links = items.map((s) => ({ title: str(s.title), link: str(s.link) })).filter((s) => s.title && s.link);
  return links.length ? links : undefined;
}

/** Google often answers People Also Ask with AI text in `text_blocks` and sources in `references`. */
function parsePaa(paa: Json): PeopleAlsoAskQuestion {
  const blocks = arr(paa.text_blocks);
  const blockText = blocks
    .flatMap((b) => {
      if (typeof b.snippet === "string") return [b.snippet];
      return arr(b.list)
        .map((li) => [li.title, li.snippet].filter((x) => typeof x === "string").join(" "))
        .filter(Boolean)
        .map((t) => `• ${t}`);
    })
    .join("\n")
    .trim();
  const list = Array.isArray(paa.list) ? (paa.list as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const refs = arr(paa.references);
  return {
    question: str(paa.question),
    snippet: str(paa.snippet) || blockText || list.map((l) => `• ${l}`).join("\n") || undefined,
    title: str(paa.title) || str(refs[0]?.title) || undefined,
    link: httpUrl(paa.link) || httpUrl(refs[0]?.link),
  };
}

export function parseGoogleSearch(data: Json): GoogleSearchData {
  const ads: RawSearchAd[] = arr(data.ads)
    .map((ad, i) => ({
      position: num(ad.position) ?? i + 1,
      blockPosition: str(ad.block_position) === "bottom" ? ("bottom" as const) : ("top" as const),
      title: str(ad.title),
      link: str(ad.link) || str(ad.tracking_link),
      displayedLink: str(ad.displayed_link) || undefined,
      trackingLink: str(ad.tracking_link) || undefined,
      description: str(ad.description) || str(ad.snippet) || undefined,
      source: str(ad.source) || undefined,
      sitelinks: parseSitelinks(ad.sitelinks),
    }))
    .filter((ad) => ad.title && ad.link);

  const organic: OrganicSearchResult[] = arr(data.organic_results)
    .slice(0, 10)
    .map((o, i) => {
      const link = str(o.link);
      return {
        position: num(o.position) ?? i + 1,
        title: str(o.title),
        link,
        snippet: str(o.snippet) || undefined,
        displayedLink: str(o.displayed_link) || undefined,
        domain: hostOfUrl(link),
      };
    })
    .filter((o) => o.title && o.link);

  const shopping: ShoppingProduct[] = (arr(data.shopping_results).length ? arr(data.shopping_results) : arr(data.inline_shopping))
    .slice(0, 6)
    .map((sp, i) => ({
      position: num(sp.position) ?? i + 1,
      title: str(sp.title),
      price: str(sp.price) || undefined,
      source: str(sp.source) || undefined,
      link: str(sp.link) || str(sp.product_link),
      rating: num(sp.rating),
      reviews: num(sp.reviews),
      thumbnail: httpUrl(sp.thumbnail),
    }))
    .filter((sp) => sp.title && sp.link);

  const localRaw = data.local_results;
  const places = Array.isArray(localRaw) ? arr(localRaw) : localRaw && typeof localRaw === "object" ? arr((localRaw as Json).places) : [];
  const local: LocalPlace[] = places
    .map((p, i) => ({
      position: num(p.position) ?? i + 1,
      title: str(p.title),
      address: str(p.address) || undefined,
      rating: num(p.rating),
      reviews: num(p.reviews),
      type: str(p.type) || undefined,
      website: httpUrl((p.links as Json | undefined)?.website) || httpUrl(p.website),
    }))
    .filter((p) => p.title);

  return {
    ads,
    peopleAlsoAsk: arr(data.related_questions).map(parsePaa).filter((q) => q.question),
    organic,
    shopping,
    local,
  };
}

/** Unix time (seconds, or milliseconds) → ISO date. */
function isoFromEpoch(v: unknown): string | undefined {
  const n = num(v) ?? (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined);
  if (n === undefined || n <= 0) return undefined;
  const d = new Date(n < 1e12 ? n * 1000 : n);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * A rendered ad preview we can show in an <img>. The Transparency Center's `link` is
 * sometimes a JavaScript preview (content.js), which isn't an image and isn't shown.
 */
export function previewImageUrl(creative: Json): string | undefined {
  const candidates = [creative.image, creative.link].map(httpUrl).filter((u): u is string => Boolean(u));
  return candidates.find(
    (u) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u) || /tpc\.googlesyndication\.com\/archive\/simgad\//i.test(u)
  );
}

export function parseAdLibrary(data: Json, collectedAt: string): AdLibraryData {
  const seen = new Set<string>();
  const creatives: AdvertiserAdCreative[] = [];
  for (const ad of arr(data.ad_creatives)) {
    const id = str(ad.ad_creative_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const format = str(ad.format).toLowerCase();
    creatives.push({
      id,
      advertiser: str(ad.advertiser),
      advertiserId: str(ad.advertiser_id) || undefined,
      targetDomain: "",
      format: format === "image" || format === "video" ? format : "text",
      image: previewImageUrl(ad),
      video: httpUrl(ad.video_link) || httpUrl(ad.video),
      firstShownAt: isoFromEpoch(ad.first_shown),
      lastShownAt: isoFromEpoch(ad.last_shown),
      totalDaysShown: num(ad.total_days_shown),
      detailsLink: httpUrl(ad.details_link),
      source: "serpapi_google_ads_transparency_center",
      collectedAt,
    });
  }
  return { creatives };
}

// ──────────────────────────────────────────────
// Client
// ──────────────────────────────────────────────

/** Near-duplicate searches ("best smartphone" / "best smartphones") share one cache entry. */
export function canonicalQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w : w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .sort()
    .join(" ");
}

function classifyError(message: string, status?: number): { kind: ProviderFailureKind; retry: boolean } {
  if (/run out of searches|upgrade your plan|plan limit|quota/i.test(message)) return { kind: "quota", retry: false };
  if (status === 429 || /rate limit|too many requests/i.test(message)) return { kind: "rate_limited", retry: true };
  if (status !== undefined && status >= 500) return { kind: "http", retry: true };
  return { kind: "provider_error", retry: false };
}

interface ClientOptions {
  apiKey?: string | null;
  cache: ResearchCache;
  config: ResearchConfig;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export function createSerpApiClient({ apiKey, cache, config, fetchImpl = fetch, sleep }: ClientOptions): SerpApiClient {
  const wait = sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  async function request<T>(
    operation: string,
    params: Record<string, string>,
    keyParams: Record<string, unknown>,
    parse: (data: Json, fetchedAt: string) => T,
    ctx: SerpCallContext,
    label: string
  ): Promise<ProviderResult<T>> {
    const started = Date.now();
    const log = (cacheHit: boolean, success: boolean, error?: string) =>
      ctx.ledger.record({ provider: "serpapi", operation, query: label, purpose: ctx.purpose, cacheHit, success, error, durationMs: Date.now() - started });

    if (!apiKey) {
      log(false, false, "not_configured");
      return { ok: false, kind: "not_configured", message: "SERPAPI_API_KEY is not set." };
    }

    const key = cacheKey("serpapi", operation, { ...keyParams, v: PARSER_VERSION });
    const cached = await cache.get<T>(key);
    if (cached) {
      log(true, true);
      return { ok: true, data: cached.value, fromCache: true, fetchedAt: cached.fetchedAt };
    }

    const url = new URL(ENDPOINT);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("api_key", apiKey);

    let failure: { kind: ProviderFailureKind; message: string } = { kind: "network", message: "No response" };
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      if (attempt > 0) await wait(1000 * attempt);
      let retry = false;
      try {
        const res = await fetchImpl(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        const body = (await res.json().catch(() => ({}))) as Json;
        const errText = str(body.error);
        if (res.ok && (!errText || NO_RESULTS.test(errText))) {
          const fetchedAt = new Date().toISOString();
          const parsed = parse(errText ? {} : body, fetchedAt);
          const entry = await cache.set(key, { provider: "serpapi", operation, params: keyParams }, parsed, config.cacheTtlHours);
          log(false, true);
          return { ok: true, data: parsed, fromCache: false, fetchedAt: entry.fetchedAt };
        }
        const classified = classifyError(errText || `HTTP ${res.status}`, res.status);
        failure = { kind: classified.kind, message: errText || `HTTP ${res.status}` };
        retry = classified.retry;
      } catch (e) {
        failure = { kind: "network", message: e instanceof Error ? e.message : String(e) };
        retry = true;
      }
      if (!retry) break;
    }

    // Never log the URL: it carries the API key.
    console.warn(`[SerpApi] ${operation} failed for "${label}": ${failure.kind} (${failure.message})`);
    log(false, false, `${failure.kind}: ${failure.message}`.slice(0, 300));
    return { ok: false, ...failure };
  }

  return {
    googleSearch(query, market, ctx) {
      const engine = config.searchEngine;
      return request(
        engine,
        // google_ads doesn't document `num`; it returns a full results page anyway.
        { engine, q: query, location: market.location, gl: market.gl, hl: "en", ...(engine === "google" ? { num: "10" } : {}) },
        { q: canonicalQuery(query), location: market.location, gl: market.gl },
        (data) => parseGoogleSearch(data),
        ctx,
        query
      );
    },

    adLibrary(domain, market, ctx) {
      return request(
        "google_ads_transparency_center",
        { engine: "google_ads_transparency_center", text: domain, region: market.region, num: "20" },
        { text: domain.toLowerCase(), region: market.region },
        (data, fetchedAt) => parseAdLibrary(data, fetchedAt),
        ctx,
        domain
      );
    },

    async resolveLocation(city, iso2, ctx) {
      const key = cacheKey("serpapi", "locations", { q: city.toLowerCase(), iso2 });
      const started = Date.now();
      const cached = await cache.get<string | null>(key);
      if (cached) {
        ctx?.ledger.record({ provider: "serpapi", operation: "locations", query: city, purpose: "location_lookup", cacheHit: true, success: true, durationMs: 0 });
        return cached.value;
      }
      try {
        const url = new URL("https://serpapi.com/locations.json");
        url.searchParams.set("q", city.split(",")[0].trim());
        url.searchParams.set("limit", "10");
        const res = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const list = res.ok ? arr(await res.json()) : [];
        const wanted = iso2.toUpperCase();
        const inCountry = list.filter((l) => str(l.country_code).toUpperCase() === wanted);
        const best = inCountry.find((l) => str(l.target_type) === "City") || inCountry[0];
        const canonical = best ? str(best.canonical_name) || null : null;
        await cache.set(key, { provider: "serpapi", operation: "locations", params: { q: city, iso2 } }, canonical, 24 * 30);
        ctx?.ledger.record({ provider: "serpapi", operation: "locations", query: city, purpose: "location_lookup", cacheHit: false, success: res.ok, durationMs: Date.now() - started });
        return canonical;
      } catch (e) {
        ctx?.ledger.record({ provider: "serpapi", operation: "locations", query: city, purpose: "location_lookup", cacheHit: false, success: false, error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - started });
        return null;
      }
    },
  };
}

/** Free Account API: is the key valid, and how many searches are left this month. */
export async function serpApiAccount(
  apiKey = process.env.SERPAPI_API_KEY,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: true; searchesLeft: number; usedThisMonth: number; perMonth: number } | { ok: false; message: string }> {
  if (!apiKey) return { ok: false, message: "SERPAPI_API_KEY is not set." };
  try {
    const res = await fetchImpl(`https://serpapi.com/account.json?api_key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok || body.error) return { ok: false, message: str(body.error) || `HTTP ${res.status}` };
    return {
      ok: true,
      searchesLeft: num(body.total_searches_left) ?? 0,
      usedThisMonth: num(body.this_month_usage) ?? 0,
      perMonth: num(body.searches_per_month) ?? 0,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
