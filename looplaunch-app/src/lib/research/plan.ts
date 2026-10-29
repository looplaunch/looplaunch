/**
 * Which Google searches to run, built from the business itself (its category, brand,
 * market and the searches its buyers type), never from a fixed list of industries or brands.
 */

import type { CompanyIntelligence, CompetitorIntelligence, SearchQuerySignal } from "../intelligence/types";
import type { SearchMarket } from "./market";
import { canonicalQuery } from "./serpapi";

export type PlannedQuery = Pick<SearchQuerySignal, "query" | "intent">;

/** What they sell in shopper words, or "" when the website didn't make it clear. */
export function categoryOf(profile: Pick<CompanyIntelligence, "category" | "subIndustry" | "products">): string {
  return (profile.category || profile.subIndustry || profile.products?.[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function intentOf(query: string): SearchQuerySignal["intent"] {
  if (/\b(price|prices|pricing|cost|cheap|deal|deals|discount|offer|buy|order)\b|[$₹£€]/.test(query)) return "pricing";
  if (/\b(vs|versus|alternatives?|competitors?|like)\b/.test(query)) return "brand_alternative";
  if (/\bbest\b|\btop\b/.test(query)) return "category";
  return "commercial";
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function brandPattern(brand: string): RegExp | null {
  const b = brand.trim();
  return b.length >= 2 ? new RegExp(`(^|\\s)${escapeRe(b.toLowerCase())}(\\s|$)`, "i") : null;
}

function collector(alreadyRun: Iterable<string> = []) {
  const seen = new Set([...alreadyRun].map(canonicalQuery));
  const out: PlannedQuery[] = [];
  const add = (raw: string | undefined, intent?: SearchQuerySignal["intent"]) => {
    const query = (raw || "").toLowerCase().replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
    if (query.length < 3) return;
    const key = canonicalQuery(query);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ query, intent: intent ?? intentOf(query) });
  };
  return { out, add };
}

/**
 * Searches that reveal who competes: the category's "best of" results (brand lists,
 * shopping, People Also Ask) and, for brands buyers already compare, "<brand> alternatives".
 * Returns [] when the category is unknown: we'd rather search less than search the wrong market.
 */
export function discoveryQueries(profile: CompanyIntelligence, market: SearchMarket, max: number): PlannedQuery[] {
  const category = categoryOf(profile);
  if (!category || max <= 0) return [];
  const { out, add } = collector();
  const brand = (profile.name || "").trim();

  if (market.scope === "local" && market.city) {
    add(`best ${category} in ${market.city}`.toLowerCase(), "category");
  } else {
    add(`best ${category}`, "category");
    // Only worth a credit when the brand is known enough to have known rivals.
    if (brand && (profile.likelyCompetitors?.length ?? 0) >= 2) add(`${brand} alternatives`, "brand_alternative");
  }
  for (const term of profile.searchTerms || []) add(term);
  return out.slice(0, max);
}

/**
 * Searches aimed at competitors' ads: one buying-intent category search, then the top
 * direct competitors not yet seen advertising. The business's own brand is never searched
 * here, since brand searches mostly return its own ads.
 */
export function adQueries(
  profile: CompanyIntelligence,
  market: SearchMarket,
  competitors: Pick<CompetitorIntelligence, "name" | "domain" | "category">[],
  options: { alreadyRun: string[]; advertisingDomains: Set<string>; max: number }
): string[] {
  if (options.max <= 0) return [];
  const category = categoryOf(profile);
  const own = brandPattern(profile.name || "");
  const { out, add } = collector(options.alreadyRun);
  const local = market.scope === "local" && market.city ? market.city.toLowerCase() : "";

  // A buyer's search about the category itself: profile search terms often name the
  // business's own products ("buy new iphone"), which mostly shows its own ads.
  const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  const categoryWords = category.split(" ").filter((w) => w.length >= 3).map(singular);
  const buying = (profile.searchTerms || []).find((t) => {
    const lower = t.toLowerCase();
    const intent = intentOf(lower);
    const aboutCategory = lower.split(/\s+/).map(singular).some((w) => categoryWords.includes(w));
    return (intent === "pricing" || intent === "commercial") && aboutCategory && !own?.test(lower);
  });
  if (buying) add(buying);
  else if (category) add(local ? `${category} ${local}` : `buy ${category}`);

  for (const c of competitors) {
    if (c.category !== "direct" || (c.domain && options.advertisingDomains.has(c.domain))) continue;
    add(`${c.name} ${category}`.trim());
  }

  return out
    .map((q) => q.query)
    .filter((q) => !own?.test(q))
    .slice(0, options.max);
}
