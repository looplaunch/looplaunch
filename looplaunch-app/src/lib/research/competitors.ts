/**
 * Competitor evidence, validation and scoring.
 *
 * Gemini proposes competitors from numbered search results; a candidate counts only when
 * the evidence confirms it (its own site appears in the results, or a result names it).
 * Anything else is kept aside as "unverified" and never counted.
 *
 * Match score (0-100, a similarity score, not a probability):
 *   Similar product   up to 50 = Gemini's 0-100 similarity judgement of the evidence × 0.5
 *   Same searches     up to 35 = share of our Google searches where they appeared × 35
 *   Advertises there  15 when they ran ads on those searches, else 0
 * No score is shown when similarity is unknown or no Google search ran.
 */

import type {
  CompanyIntelligence,
  CompetitorCategory,
  CompetitorIntelligence,
  KeywordAdResult,
  ScoreFactor,
  TavilySearchResult,
} from "../intelligence/types";
import { hostOf, registrableDomain } from "./domains";
import type { LocalPlace, OrganicSearchResult } from "./serpapi";

/** Stores and marketplaces where buyers compare and buy. */
export const KNOWN_MARKETPLACES = new Set([
  "amazon.com", "amazon.in", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.com.au",
  "flipkart.com", "myntra.com", "ajio.com", "meesho.com", "nykaa.com",
  "etsy.com", "ebay.com", "walmart.com", "target.com", "bestbuy.com", "costco.com",
  "aliexpress.com", "temu.com", "shein.com", "zalando.com", "asos.com",
  "doordash.com", "ubereats.com", "grubhub.com", "zomato.com", "swiggy.com", "deliveroo.co.uk",
  "capterra.com", "g2.com", "softwareadvice.com", "getapp.com", "producthunt.com", "appsumo.com", "apps.shopify.com",
]);

/** News, review and reference sites: they mention products but don't sell them. */
const KNOWN_PUBLISHERS = new Set([
  "forbes.com", "techcrunch.com", "theverge.com", "wired.com", "businessinsider.com", "nerdwallet.com",
  "investopedia.com", "zdnet.com", "pcmag.com", "cnet.com", "techradar.com", "tomsguide.com", "engadget.com",
  "mashable.com", "digitaltrends.com", "yahoo.com", "msn.com", "reuters.com", "bloomberg.com", "cnbc.com",
  "bbc.com", "bbc.co.uk", "cnn.com", "nytimes.com", "theguardian.com", "medium.com", "substack.com",
  "trustpilot.com", "tripadvisor.com", "timeout.com", "eater.com", "vogue.com", "elle.com", "gq.com",
]);

const PUBLISHER_HINT = /\b(news|blog|magazine|journal|tribune|gazette|herald|reviews?|wiki|forum)\b/i;

/** Platforms that show up everywhere but are never someone's competitor. */
const IGNORED_DOMAINS = new Set([
  "google.com", "youtube.com", "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
  "reddit.com", "pinterest.com", "tiktok.com", "wikipedia.org", "github.com", "quora.com", "yelp.com",
  "glassdoor.com", "indeed.com",
]);

/** Sites whose subdomains are separate products (store.google.com sells phones; google.com is search). */
const SUBDOMAINS_ARE_PRODUCTS = new Set(["google.com"]);

/** Publisher brands by name, so country editions count too (vogue.in, vogue.co.uk). */
const PUBLISHER_NAMES = new Set([...KNOWN_PUBLISHERS].map((d) => d.split(".")[0]));
const LIST_ARTICLE = /^(the )?\d+ best|\btop \d+\b|\bbest .* (of|in) 20\d\d\b/i;

export function isPublisher(domain: string): boolean {
  const label = domain.split(".")[0] || "";
  return KNOWN_PUBLISHERS.has(domain) || PUBLISHER_NAMES.has(label) || PUBLISHER_HINT.test(label);
}

function isIgnored(host: string): boolean {
  const bare = host.replace(/^www\./, "");
  const site = registrableDomain(bare);
  if (SUBDOMAINS_ARE_PRODUCTS.has(site)) return bare === site;
  return IGNORED_DOMAINS.has(bare) || IGNORED_DOMAINS.has(site);
}

/** Identity used to merge duplicates: the registrable domain, or the host for product subdomains. */
function siteKey(host: string): string {
  const bare = host.replace(/^www\./, "");
  const site = registrableDomain(bare);
  return SUBDOMAINS_ARE_PRODUCTS.has(site) ? bare : site;
}

export interface EvidenceItem {
  n: number;
  kind: "organic" | "ad" | "article" | "local";
  title: string;
  /** Host of the result (keeps subdomains: store.google.com) */
  host: string;
  url?: string;
  snippet: string;
  /** Full text checked when validating a candidate */
  text: string;
  query?: string;
}

const clip = (text: string | undefined, max: number) => {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Numbered evidence for Gemini. The business's own pages are left out. */
export function buildEvidence(
  sources: {
    organic: Array<OrganicSearchResult & { query: string }>;
    ads: KeywordAdResult[];
    articles: TavilySearchResult[];
    local: Array<LocalPlace & { query: string }>;
  },
  ownDomain: string,
  max = 60
): EvidenceItem[] {
  const own = registrableDomain(ownDomain);
  const items: EvidenceItem[] = [];
  const seen = new Set<string>();
  const push = (item: Omit<EvidenceItem, "n">) => {
    const key = `${item.kind}|${item.host}|${item.title.toLowerCase()}`;
    if (items.length >= max || seen.has(key) || (item.host && registrableDomain(item.host) === own)) return;
    seen.add(key);
    items.push({ ...item, n: items.length + 1 });
  };

  for (const ad of sources.ads) {
    push({ kind: "ad", title: clip(ad.title, 110), host: ad.advertiserDomain || "", url: ad.link, snippet: clip(ad.snippet, 180), text: `${ad.title} ${ad.snippet || ""}`, query: ad.query });
  }
  for (const o of sources.organic) {
    push({ kind: "organic", title: clip(o.title, 110), host: hostOf(o.link), url: o.link, snippet: clip(o.snippet, 180), text: `${o.title} ${o.snippet || ""}`, query: o.query });
  }
  for (const p of sources.local) {
    push({ kind: "local", title: clip(p.title, 110), host: hostOf(p.website), url: p.website, snippet: clip([p.type, p.address, p.rating ? `${p.rating}★ (${p.reviews ?? 0} reviews)` : ""].filter(Boolean).join(" · "), 180), text: `${p.title} ${p.type || ""} ${p.address || ""}`, query: p.query });
  }
  for (const a of sources.articles) {
    push({ kind: "article", title: clip(a.title, 110), host: hostOf(a.url), url: a.url, snippet: clip(a.content, 180), text: `${a.title} ${a.content || ""}` });
  }
  return items;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function namedIn(text: string, name: string, domain: string): boolean {
  const t = text.toLowerCase();
  if (domain && t.includes(domain)) return true;
  const words = [name.toLowerCase().trim(), (domain.split(".")[0] || "").toLowerCase()].filter((w) => w.length >= 3);
  return words.some((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(w)}($|[^\\p{L}\\p{N}])`, "u").test(t));
}

export interface ValidatedCompetitor {
  name: string;
  /** Host as found (store.google.com) or the candidate's domain; "" for local places without a site */
  domain: string;
  type: CompetitorCategory;
  /** Gemini's 0-100 similarity, when Gemini picked it */
  similarity?: number;
  why?: string;
  /** Evidence items that confirm it */
  confirmedBy: EvidenceItem[];
}

/**
 * Keep candidates the evidence confirms; merge duplicates (www., subdomains, same name);
 * drop the business itself, publishers and platforms.
 */
/** A proposed competitor, from Gemini or from the search-appearance fallback. */
export interface CompetitorCandidate {
  name: string;
  domain: string;
  type: CompetitorCategory;
  similarity?: number;
  why?: string;
}

export function validateCandidates(
  candidates: CompetitorCandidate[],
  evidence: EvidenceItem[],
  own: { domain: string; name: string }
): { verified: ValidatedCompetitor[]; unverified: Array<{ name: string; domain?: string }> } {
  const ownSite = registrableDomain(own.domain);
  const ownName = own.name.toLowerCase().trim();
  const verified: ValidatedCompetitor[] = [];
  const unverified: Array<{ name: string; domain?: string }> = [];

  for (const c of candidates) {
    const name = (c.name || "").trim();
    const host = hostOf(c.domain).replace(/^www\./, "");
    const site = registrableDomain(host);
    if (!name || (site && site === ownSite) || name.toLowerCase() === ownName) continue;
    if (host && (isIgnored(host) || isPublisher(site))) continue;

    const key = (host && siteKey(host)) || name.toLowerCase();
    if (verified.some((v) => (v.domain ? siteKey(v.domain) : v.name.toLowerCase()) === key)) continue;

    const confirmedBy = evidence.filter(
      (e) => (site && e.host && registrableDomain(e.host) === site) || namedIn(e.text, name, site)
    );
    if (confirmedBy.length === 0) {
      unverified.push({ name, domain: site || undefined });
      continue;
    }

    // A site whose only results are list articles ("10 best...") is a publisher, not a seller.
    const ownResults = confirmedBy.filter((e) => site && e.host && registrableDomain(e.host) === site);
    if (ownResults.length > 0 && ownResults.every((e) => e.kind !== "ad" && LIST_ARTICLE.test(e.title))) continue;

    const type: CompetitorCategory = site && KNOWN_MARKETPLACES.has(site) ? "marketplace" : c.type;
    verified.push({ name, domain: host || site, type, similarity: c.similarity, why: c.why, confirmedBy });
  }
  return { verified, unverified };
}

/**
 * Without Gemini: sellers whose own site keeps appearing (2+ searches) or who advertise,
 * minus publishers and platforms. No similarity, so no score.
 */
export function heuristicCandidates(evidence: EvidenceItem[]): CompetitorCandidate[] {
  const bySite = new Map<string, { host: string; title: string; queries: Set<string>; ads: number }>();
  for (const e of evidence) {
    if (!e.host || e.kind === "article") continue;
    const site = registrableDomain(e.host);
    if (!site || isIgnored(e.host) || isPublisher(site)) continue;
    const entry = bySite.get(site) ?? { host: e.host.replace(/^www\./, ""), title: e.title, queries: new Set<string>(), ads: 0 };
    if (e.query) entry.queries.add(e.query);
    if (e.kind === "ad") entry.ads++;
    bySite.set(site, entry);
  }
  return [...bySite.entries()]
    .filter(([site, s]) => KNOWN_MARKETPLACES.has(site) || s.queries.size >= 2 || s.ads > 0)
    .map(([site, s]) => {
      const fromTitle = s.title.split(/[|\-–—:]/)[0].trim();
      const name = fromTitle.length >= 2 && fromTitle.length <= 35 ? fromTitle : site.split(".")[0].replace(/^./, (ch) => ch.toUpperCase());
      return { name, domain: s.host, type: (KNOWN_MARKETPLACES.has(site) ? "marketplace" : "indirect") as CompetitorCategory };
    });
}

export function scoreCompetitor(
  similarity: number | undefined,
  searchesSeenOn: number,
  totalSearches: number,
  advertises: boolean
): { score?: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];
  if (similarity !== undefined) {
    factors.push({ key: "product", label: "Similar product", points: Math.round(similarity * 0.5), max: 50, basis: "Gemini's reading of the search results about them" });
  }
  factors.push({
    key: "search_overlap",
    label: "Same searches",
    points: totalSearches > 0 ? Math.round((Math.min(searchesSeenOn, totalSearches) / totalSearches) * 35) : 0,
    max: 35,
    basis: `Appeared on ${searchesSeenOn} of ${totalSearches} Google searches`,
  });
  factors.push({ key: "ad_overlap", label: "Advertises there", points: advertises ? 15 : 0, max: 15, basis: advertises ? "Ran ads on these searches" : "No ads seen on these searches" });
  const score = similarity !== undefined && totalSearches > 0 ? factors.reduce((n, f) => n + f.points, 0) : undefined;
  return { score, factors };
}

/** First price-looking phrase ("From $799", "$12/month") in text from their own pages or ads. */
export function findPrice(snippets: string[]): string | undefined {
  const re = /(?:(?:from|starting at|starts at)\s+)?(?:US|Rs\.?)?\s?[$₹£€]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:\/|per)\s*(?:month|mo|year|yr))?/gi;
  // "Save up to $540", "$100 off", "$200 trade-in credit" are discounts, not prices.
  const discountBefore = /\b(save|saving|savings|off|up to|discount|credit|trade[- ]?in|bonus|reward|cash ?back|get)\s*$/i;
  const discountAfter = /^\s*(off|in savings|savings|credit|trade[- ]?in|back|bonus)\b/i;
  for (const s of snippets) {
    for (const m of s.matchAll(re)) {
      const at = m.index ?? 0;
      if (discountBefore.test(s.slice(Math.max(0, at - 25), at)) || discountAfter.test(s.slice(at + m[0].length, at + m[0].length + 20))) continue;
      return m[0].trim().replace(/^./, (ch) => ch.toUpperCase());
    }
  }
  return undefined;
}

const CATEGORY_ORDER: Record<CompetitorCategory, number> = { direct: 0, indirect: 1, marketplace: 2, publisher: 3, irrelevant: 4 };

/** Final competitor records, strongest first, at most `max`. */
export function toCompetitors(
  validated: ValidatedCompetitor[],
  context: { searches: string[]; ads: KeywordAdResult[]; profile: Pick<CompanyIntelligence, "category">; collectedAt: string },
  max: number
): CompetitorIntelligence[] {
  const records = validated.map((v) => {
    const site = registrableDomain(v.domain);
    const fromThem = v.confirmedBy.filter((e) => site && e.host && registrableDomain(e.host) === site);
    const theirAds = context.ads.filter((a) => site && registrableDomain(a.advertiserDomain) === site);
    const seenOn = new Set<string>([
      ...fromThem.map((e) => e.query).filter((q): q is string => Boolean(q)),
      ...theirAds.flatMap((a) => (a.observations || []).map((o) => o.query)),
    ]);
    const advertises = theirAds.length > 0;
    const { score, factors } = scoreCompetitor(v.similarity, [...seenOn].filter((q) => context.searches.includes(q)).length, context.searches.length, advertises);

    const strengths: string[] = [];
    if (seenOn.size > 0) strengths.push(`Shows up on ${seenOn.size} of the Google searches your buyers make`);
    if (advertises) strengths.push("Runs Google ads on those searches");

    const competitor: CompetitorIntelligence = {
      name: v.name,
      domain: v.domain || undefined,
      website: v.domain ? `https://${v.domain}` : "",
      description: clip(v.why || fromThem[0]?.snippet || v.confirmedBy[0]?.snippet, 260),
      valueProposition: clip(fromThem[0]?.title || theirAds[0]?.title || "", 140),
      products: [],
      targetSegments: [],
      strengths,
      weaknesses: [],
      marketingChannels: [...(advertises ? ["Google Search Ads"] : []), ...(fromThem.some((e) => e.kind === "organic") ? ["Organic search"] : [])],
      contentStrategy: "",
      differentiators: [],
      pricing: findPrice([...fromThem.map((e) => e.text), ...theirAds.map((a) => `${a.title} ${a.snippet || ""}`)]),
      category: v.type,
      score,
      scoreFactors: factors,
      scoringRationale: factors.map((f) => `${f.label}: ${f.points}/${f.max} (${f.basis})`).join("; "),
      discoveryQueries: [...seenOn],
      organicRankings: [],
      sponsoredRankings: theirAds.flatMap((a) =>
        (a.observations || []).map((o) => ({ query: o.query, position: o.position, title: a.title, link: a.link, snippet: a.snippet }))
      ),
      transparencyStatus: "not_verified",
      creatives: [],
      evidence: v.confirmedBy.slice(0, 3).map((e) => ({ kind: e.kind, title: e.title, url: e.url, domain: e.host || undefined, query: e.query })),
      evidenceSnippet: v.confirmedBy[0]?.snippet || "",
      verifiedAt: context.collectedAt,
    };
    return { competitor, seenOn: seenOn.size };
  });

  return records
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.competitor.category || "indirect"] - CATEGORY_ORDER[b.competitor.category || "indirect"] ||
        (b.competitor.score ?? -1) - (a.competitor.score ?? -1) ||
        b.seenOn - a.seenOn
    )
    .slice(0, max)
    .map((r) => r.competitor);
}
