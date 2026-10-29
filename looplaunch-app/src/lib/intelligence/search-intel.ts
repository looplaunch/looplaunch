/**
 * Builds the Search Intel view the sidebar shows, from what's already stored on the
 * session. Read-only: it never calls a provider, so opening the page or switching tabs
 * costs no searches. Server-only (uses the ad classifier, which hashes with node:crypto).
 *
 * Older analyses (made before research runs were recorded) are converted the same way:
 * ads are sorted into competitor / other / own by domain, and the per-category limits apply.
 */

import { classifyAds, selectAds } from "../research/ads";
import { researchConfig } from "../research/config";
import type {
  AdLibraryEntry,
  AdvertiserAdCreative,
  IntelligenceSession,
  KeywordAdResult,
  SearchIntelCounts,
  SearchIntelView,
} from "./types";

/** Older records stored Unix seconds (as numbers or strings); new ones store ISO dates. */
function isoDate(value: string | number | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "string" && !/^\d+$/.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(n < 1e12 ? n * 1000 : n).toISOString();
}

function libraryEntry(cr: AdvertiserAdCreative, competitorName: string, competitorDomain: string): AdLibraryEntry {
  return {
    id: cr.id,
    competitorName: cr.competitorName || competitorName,
    competitorDomain: cr.targetDomain || competitorDomain,
    advertiser: cr.advertiser,
    advertiserMatchesCompetitor: cr.advertiserMatchesCompetitor,
    format: cr.format,
    previewImageUrl: cr.image,
    detailsUrl: cr.detailsLink,
    firstShownAt: cr.firstShownAt || isoDate(cr.firstShown),
    lastShownAt: cr.lastShownAt || isoDate(cr.lastShown),
    totalDaysShown: cr.totalDaysShown,
    region: cr.region,
  };
}

export function countsOf(view: Pick<SearchIntelView, "questions" | "ads" | "adLibrary" | "competitors">): SearchIntelCounts {
  return {
    questions: view.questions.length,
    ads: view.ads.competitor.length + view.adLibrary.length,
    competitors: view.competitors.length,
  };
}

export function buildSearchIntelView(
  session: Pick<IntelligenceSession, "marketIntelligence" | "competitorIntelligence" | "onboardingInput" | "companyIntelligence">,
  options: { locked: boolean }
): SearchIntelView {
  const limits = researchConfig();
  const market = session.marketIntelligence;
  const research = market?.research;
  const ownDomain = session.companyIntelligence?.website || session.onboardingInput?.website || "";
  // Everything below uses the same (limited) competitor list the sidebar shows.
  const shown = (session.competitorIntelligence || []).slice(0, limits.maxCompetitors);
  const competitors = shown.map((c) => ({ ...c, creatives: undefined }));

  // Ads: new runs store their classification; older ones are classified here by domain.
  const storedAds: KeywordAdResult[] =
    market?.keywordAds ||
    (market?.googleAds || []).map((a, i) => ({
      id: `legacy_${i}`,
      position: i + 1,
      title: a.title,
      link: a.link,
      displayedLink: a.displayedLink,
      snippet: a.snippet,
      query: "",
      location: "",
      collectedAt: market?.collectedAt || "",
    }));
  const classified = classifyAds(storedAds, ownDomain, shown);
  const ads = selectAds(
    // Google click-tracking links aren't needed in the browser.
    classified.map((a) => ({ ...a, trackingLink: undefined })),
    shown.map((c) => c.domain || ""),
    limits.maxAds
  );

  const adLibrary = shown
    .flatMap((c) => (c.creatives || []).map((cr) => libraryEntry(cr, c.name, c.domain || "")))
    .slice(0, limits.maxAds);

  const questions = (market?.peopleAlsoAsk || []).slice(0, limits.maxQuestions).map((q, i) => ({
    id: q.id || `q_legacy_${i}`,
    question: q.question,
    sourceQuery: q.sourceQuery,
    observedAt: q.observedAt,
    googleAnswer: q.snippet ? { text: q.snippet, sourceTitle: q.title, sourceUrl: q.link } : undefined,
    aiAnswer: q.answer ? { text: q.answer, tip: q.tip } : undefined,
  }));

  const searches = research
    ? research.queries.map((q) => ({ query: q.query, purpose: q.purpose, fromCache: q.fromCache, ok: q.ok }))
    : (market?.generatedQueries || []).map((q) => ({ query: q.query, purpose: "competitor_discovery", fromCache: false, ok: true }));

  const organic = (market?.organicKeywords || []).slice(0, 6).map((o) => {
    let domain = "";
    try {
      domain = new URL(o.link).hostname.replace(/^www\./, "");
    } catch {
      domain = "";
    }
    return { position: o.position, title: o.title, link: o.link, domain };
  });

  const full = {
    questions,
    ads,
    adLibrary,
    competitors,
  };
  const counts = countsOf(full);
  const empty = { questions: [], ads: { competitor: [], other: [], own: [] }, adLibrary: [], competitors: [] };

  return {
    status: research?.status ?? "legacy",
    locked: options.locked,
    completedAt: research?.completedAt,
    dataCollectedAt: research?.dataCollectedAt || market?.collectedAt,
    cachedSearches: searches.filter((s) => s.fromCache).length,
    totalSearches: searches.length,
    market: research?.market,
    ...(options.locked ? empty : full),
    searches: options.locked ? [] : searches,
    organic: options.locked ? [] : organic,
    shopping: options.locked ? [] : (market?.shoppingResults || []).slice(0, 4),
    counts,
    limitations: research?.limitations ?? [
      "This analysis was made with an earlier version of the research. Run a new analysis for competitor-only ads, sources and limits.",
    ],
  };
}

/** Problems with a view's shape; empty when valid. Used by tests and before responding. */
export function validateSearchIntelView(view: SearchIntelView): string[] {
  const problems: string[] = [];
  const counts = countsOf(view);
  if (!view.locked) {
    if (counts.questions !== view.counts.questions) problems.push("questions count doesn't match the list");
    if (counts.ads !== view.counts.ads) problems.push("ads count doesn't match the lists");
    if (counts.competitors !== view.counts.competitors) problems.push("competitors count doesn't match the list");
  }
  if (view.ads.competitor.some((a) => a.relation === "own")) problems.push("an own ad is in the competitor list");
  if (view.ads.own.some((a) => a.relation !== "own")) problems.push("a non-own ad is in the own list");
  const ids = [...view.ads.competitor, ...view.ads.other, ...view.ads.own].map((a) => a.id);
  if (new Set(ids).size !== ids.length) problems.push("duplicate ad ids");
  if (new Set(view.questions.map((q) => q.id)).size !== view.questions.length) problems.push("duplicate question ids");
  for (const entry of view.adLibrary) {
    if (entry.previewImageUrl && !/^https:\/\//.test(entry.previewImageUrl)) problems.push(`ad library preview isn't https: ${entry.id}`);
    for (const date of [entry.firstShownAt, entry.lastShownAt]) {
      if (date && Number.isNaN(new Date(date).getTime())) problems.push(`bad date on ${entry.id}`);
    }
  }
  return problems;
}
