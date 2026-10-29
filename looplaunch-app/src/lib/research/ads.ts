/**
 * Search ads seen while researching: merge repeat sightings, then label each ad as the
 * business's own, a verified competitor's, or another advertiser's (uncertain, kept apart).
 * Only domain matches count as a competitor; a similar-sounding name isn't enough.
 */

import { createHash } from "node:crypto";
import type { CompetitorCategory, KeywordAdResult } from "../intelligence/types";
import { adAdvertiserDomain, registrableDomain } from "./domains";
import type { RawSearchAd } from "./serpapi";

export interface AdSighting {
  ad: RawSearchAd;
  query: string;
  observedAt: string;
  location: string;
}

export interface AdCompetitor {
  name: string;
  domain?: string;
  category?: CompetitorCategory;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Same advertiser + same headline = the same ad, wherever it showed up. */
export function adFingerprint(advertiserDomain: string, title: string): string {
  return `ad_${createHash("sha1").update(`${advertiserDomain}|${normalizeTitle(title)}`).digest("hex").slice(0, 16)}`;
}

/** One record per distinct ad, with every search it was seen on. */
export function mergeAdSightings(sightings: AdSighting[]): KeywordAdResult[] {
  const byId = new Map<string, KeywordAdResult>();
  for (const { ad, query, observedAt, location } of sightings) {
    const advertiserDomain = adAdvertiserDomain(ad);
    const id = adFingerprint(advertiserDomain || ad.displayedLink || ad.source || "", ad.title);
    const sighting = { query, position: ad.position, blockPosition: ad.blockPosition, observedAt };
    const existing = byId.get(id);
    if (existing) {
      if (!existing.observations?.some((o) => o.query === query)) existing.observations?.push(sighting);
      if (ad.position < existing.position) existing.position = ad.position;
      continue;
    }
    byId.set(id, {
      id,
      position: ad.position,
      blockPosition: ad.blockPosition,
      title: ad.title,
      link: ad.link,
      displayedLink: ad.displayedLink,
      trackingLink: ad.trackingLink,
      snippet: ad.description,
      advertiserName: ad.source,
      sitelinks: ad.sitelinks,
      query,
      location,
      collectedAt: observedAt,
      advertiserDomain: advertiserDomain || undefined,
      observations: [sighting],
      source: "serpapi_google",
    });
  }
  return [...byId.values()];
}

export function classifyAds(ads: KeywordAdResult[], ownDomain: string, competitors: AdCompetitor[]): KeywordAdResult[] {
  const own = registrableDomain(ownDomain);
  const byDomain = new Map(
    competitors.filter((c) => c.domain).map((c) => [registrableDomain(c.domain), c] as const)
  );
  return ads.map((ad) => {
    const domain = registrableDomain(ad.advertiserDomain || adAdvertiserDomain(ad));
    const competitor = domain ? byDomain.get(domain) : undefined;
    const relation = domain && domain === own ? "own" : competitor ? "competitor" : "other";
    return {
      ...ad,
      advertiserDomain: domain || undefined,
      relation,
      competitorDomain: relation === "competitor" ? competitor?.domain : undefined,
      competitorName: relation === "competitor" ? competitor?.name : undefined,
    };
  });
}

/**
 * The ads to keep: up to `max` per group. Competitor ads follow the competitor order
 * (direct first, strongest first), with at most `perAdvertiser` from one advertiser so a
 * single brand's headline variants can't fill the list.
 */
export function selectAds(
  ads: KeywordAdResult[],
  competitorOrder: string[],
  max: number,
  perAdvertiser = 3
): { competitor: KeywordAdResult[]; other: KeywordAdResult[]; own: KeywordAdResult[] } {
  const rank = (ad: KeywordAdResult) => {
    const i = competitorOrder.indexOf(ad.competitorDomain || "");
    return i === -1 ? competitorOrder.length : i;
  };
  const strength = (a: KeywordAdResult, b: KeywordAdResult) =>
    (b.observations?.length ?? 1) - (a.observations?.length ?? 1) || a.position - b.position;

  // First pass spreads the slots across advertisers; the second fills any slots left over.
  const pick = (list: KeywordAdResult[]) => {
    const perDomain = new Map<string, number>();
    const out: KeywordAdResult[] = [];
    const skipped: KeywordAdResult[] = [];
    for (const ad of list) {
      if (out.length >= max) break;
      const key = ad.advertiserDomain || ad.id;
      const used = perDomain.get(key) ?? 0;
      if (used >= perAdvertiser) {
        skipped.push(ad);
        continue;
      }
      perDomain.set(key, used + 1);
      out.push(ad);
    }
    const order = new Map(list.map((ad, i) => [ad.id, i]));
    return [...out, ...skipped.slice(0, Math.max(0, max - out.length))].sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );
  };

  return {
    competitor: pick(ads.filter((a) => a.relation === "competitor").sort((a, b) => rank(a) - rank(b) || strength(a, b))),
    other: pick(ads.filter((a) => a.relation === "other").sort(strength)),
    own: pick(ads.filter((a) => a.relation === "own").sort(strength)),
  };
}
