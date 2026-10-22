/**
 * SerpApi Search & Google Intelligence Service
 *
 * Powers:
 * 1. Competitor Google Ads intelligence (Ad copy, headlines, displayed links)
 * 2. "People Also Ask" (PAA) search questions directly from Google
 * 3. Organic search ranking & keyword landscape
 *
 * Uses native fetch with timeout & comprehensive error handling.
 */

export interface GoogleAd {
  position: number;
  title: string;
  link: string;
  snippet?: string;
  displayedLink?: string;
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
}

export interface SerpApiIntelligence {
  query: string;
  ads: GoogleAd[];
  peopleAlsoAsk: PeopleAlsoAskQuestion[];
  organicResults: OrganicSearchResult[];
  relatedSearches: string[];
  totalAds: number;
  totalQuestions: number;
}

function getApiKey(): string | null {
  return process.env.SERPAPI_API_KEY || null;
}

/**
 * Perform a live Google Search via SerpApi to gather competitive ad and search intelligence.
 */
export async function searchGoogleIntelligence(
  query: string,
  options: { location?: string; num?: number } = {}
): Promise<SerpApiIntelligence | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[SerpApi] SERPAPI_API_KEY is not configured.");
    return null;
  }

  const location = options.location || "United States";
  const num = options.num || 10;

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("location", location);
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", "us");
    url.searchParams.set("num", num.toString());
    url.searchParams.set("api_key", apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
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
      title: (ad.title as string) || "",
      link: (ad.link as string) || (ad.tracking_link as string) || "",
      snippet: (ad.description as string) || (ad.snippet as string) || "",
      displayedLink: (ad.displayed_link as string) || "",
      sitelinks: Array.isArray(ad.sitelinks)
        ? (ad.sitelinks as Array<{ title?: string; link?: string }>).map((s) => ({
            title: s.title || "",
            link: s.link || "",
          }))
        : [],
    }));

    // 2. Extract People Also Ask questions
    const rawPaa = Array.isArray(data.related_questions) ? data.related_questions : [];
    const peopleAlsoAsk: PeopleAlsoAskQuestion[] = rawPaa.map((paa: Record<string, unknown>) => ({
      question: (paa.question as string) || "",
      snippet: (paa.snippet as string) || "",
      title: (paa.title as string) || "",
      link: (paa.link as string) || "",
    }));

    // 3. Extract Organic Results
    const rawOrganic = Array.isArray(data.organic_results) ? data.organic_results : [];
    const organicResults: OrganicSearchResult[] = rawOrganic.slice(0, 8).map((org: Record<string, unknown>, idx: number) => ({
      position: (org.position as number) || idx + 1,
      title: (org.title as string) || "",
      link: (org.link as string) || "",
      snippet: (org.snippet as string) || "",
      displayedLink: (org.displayed_link as string) || "",
    }));

    // 4. Extract Related Searches
    const rawRelated = Array.isArray(data.related_searches) ? data.related_searches : [];
    const relatedSearches: string[] = rawRelated
      .map((r: Record<string, unknown>) => (r.query as string) || "")
      .filter(Boolean);

    return {
      query,
      ads,
      peopleAlsoAsk,
      organicResults,
      relatedSearches,
      totalAds: ads.length,
      totalQuestions: peopleAlsoAsk.length,
    };
  } catch (err) {
    console.warn(`[SerpApi] Failed to fetch intelligence for "${query}":`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Fetch competitor advertising & search footprint.
 */
export async function getCompetitorSearchFootprint(
  competitorName: string
): Promise<SerpApiIntelligence | null> {
  const query = `${competitorName} pricing alternatives`;
  return await searchGoogleIntelligence(query);
}
