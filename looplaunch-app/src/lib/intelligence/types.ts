/**
 * Intelligence Pipeline — Core Type Definitions
 *
 * These types define the shape of data flowing through the
 * Research → Understand → Diagnose → Answer pipeline.
 */

// ──────────────────────────────────────────────
// Onboarding Input (from frontend)
// ──────────────────────────────────────────────

export interface OnboardingInput {
  /** Q1: Website or primary page URL */
  website: string;
  /** Q2: Role in the brand */
  role: string;
  /** Q3: Industry */
  industry: string;
  /** Q4: Business stage */
  stage: string;
  /** Q5: Core offer / product description */
  coreOffer: string;
  /** Q6: Who buys from you (up to 2) */
  audience: string[];
  /** Q7: Where do you sell (all that apply) */
  salesChannels: string[];
  /** Q8: Biggest marketing headache */
  biggestHeadache: string;
  /** Q9: 30-day goal */
  thirtyDayGoal: string;
  /** Derived: Company name extracted from website / crawl */
  companyName?: string;
}

// ──────────────────────────────────────────────
// Raw Crawl Data
// ──────────────────────────────────────────────

export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  mainContent: string;
  links: string[];
  crawledAt: string;
  success: boolean;
  error?: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  domain: string;
  totalPages: number;
  crawledAt: string;
}

// ──────────────────────────────────────────────
// Structured Intelligence (output from Gemini)
// ──────────────────────────────────────────────

export interface CompanyIntelligence {
  name: string;
  website: string;
  industry: string;
  subIndustry?: string;
  description: string;
  valueProposition: string;
  products: string[];
  businessModel?: string;
  targetSegments: string[];
  geography?: string;
  pricingAndPositioning?: string;
  brandTone: string;
  strengths: string[];
  weaknesses: string[];
  currentChannels: string[];
  contentThemes: string[];
  technologyStack: string[];
  rawCrawlData?: CrawlResult;
  /** Confidence score (0.0 to 1.0) for extracted attributes */
  attributeConfidence?: Record<string, number>;
  /** Exact quote evidence from the crawled website */
  evidenceSnippets?: Record<string, string>;
  /** What they sell in plain shopper words, e.g. "smartphones" or "thrift clothing" */
  category?: string;
  /** Searches real buyers type when they shop in this category */
  searchTerms?: string[];
  /** Competitors the profiler is confident about, checked against search results later */
  likelyCompetitors?: Array<{ name: string; domain?: string; type?: "direct" | "indirect" }>;
  /** True when the business sells physical goods (turns on Google Shopping research) */
  sellsPhysicalProducts?: boolean;
  /** Who they sell to geographically, from website evidence: a city's shops vs a whole country */
  marketScope?: "local" | "national" | "international" | "unknown";
  /** Country they sell in, when the website shows it ("India", "United States") */
  country?: string;
  /** City or area for local businesses ("Austin, Texas"), when the website shows it */
  city?: string;
}

export type CompetitorCategory =
  | "direct"
  | "indirect"
  | "marketplace"
  | "publisher"
  | "irrelevant";

export interface CompetitorScoreBreakdown {
  productSimilarity: number; // 0 - 30
  audienceOverlap: number; // 0 - 20
  businessModel: number; // 0 - 15
  geography: number; // 0 - 10
  searchIntent: number; // 0 - 15
  pricingPosition: number; // 0 - 10
}

/**
 * One ad from the Google Ads Transparency Center (via SerpApi). The Center does not return
 * the ad's words, only a rendered preview image for many text and image ads.
 */
export interface AdvertiserAdCreative {
  /** Transparency Center creative ID (stable) */
  id: string;
  advertiser: string;
  advertiserId?: string;
  /** The competitor domain we looked up */
  targetDomain: string;
  format: "text" | "image" | "video";
  /** Rendered preview of the ad (an image URL) when Google provides one */
  image?: string;
  video?: string;
  body?: string;
  /** Older records stored Unix seconds here; new ones store ISO dates in firstShownAt / lastShownAt */
  firstShown?: string | number;
  lastShown?: string | number;
  firstShownAt?: string;
  lastShownAt?: string;
  totalDaysShown?: number;
  /** The creative's page on adstransparency.google.com */
  detailsLink?: string;
  /** Country code the lookup was limited to, or undefined for anywhere */
  region?: string;
  competitorName?: string;
  /** True when the advertiser's name matches the competitor (not a reseller or agency) */
  advertiserMatchesCompetitor?: boolean;
  source?: "serpapi_google_ads_transparency_center";
  /** When we fetched it from the provider */
  collectedAt?: string;
}

/** Whose ad it is, relative to the business being analysed. */
export type AdRelation = "competitor" | "own" | "other";

/**
 * A sponsored result observed on a Google search. It shows the ad ran for that search;
 * it says nothing about budget, performance or the advertiser's full strategy.
 */
export interface KeywordAdResult {
  /** Stable fingerprint of advertiser domain + headline, so repeat sightings merge */
  id: string;
  position: number;
  blockPosition?: "top" | "bottom";
  title: string;
  link: string;
  displayedLink?: string;
  trackingLink?: string;
  snippet?: string;
  advertiserName?: string;
  sitelinks?: { title: string; link: string }[];
  /** First search this ad was seen on */
  query: string;
  location: string;
  collectedAt: string;
  advertiserDomain?: string;
  relation?: AdRelation;
  /** Verified competitor this ad belongs to */
  competitorDomain?: string;
  competitorName?: string;
  /** Every search this same ad was seen on */
  observations?: Array<{ query: string; position: number; blockPosition?: "top" | "bottom"; observedAt: string }>;
  source?: "serpapi_google";
}

export interface ShoppingProduct {
  position: number;
  title: string;
  price?: string;
  source?: string;
  link: string;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
}

export interface SearchQuerySignal {
  query: string;
  intent: "commercial" | "brand_alternative" | "category" | "solution_pain" | "pricing";
  totalOrganicResults?: number;
  totalAds?: number;
}

/** One documented part of a competitor's match score. */
export interface ScoreFactor {
  key: "product" | "search_overlap" | "ad_overlap";
  label: string;
  points: number;
  max: number;
  /** What the points are based on */
  basis: string;
}

export interface CompetitorIntelligence {
  name: string;
  website: string;
  domain?: string;
  description: string;
  valueProposition: string;
  products: string[];
  targetSegments: string[];
  strengths: string[];
  weaknesses: string[];
  marketingChannels: string[];
  contentStrategy: string;
  differentiators: string[];
  pricing?: string;
  rawCrawlData?: CrawlResult;
  /** Category classification */
  category?: CompetitorCategory;
  /** Match score (0 to 100), a similarity score, not a probability. Missing when there isn't enough evidence. */
  score?: number;
  /** Older analyses only */
  scoreBreakdown?: CompetitorScoreBreakdown;
  /** How the score was built (new analyses) */
  scoreFactors?: ScoreFactor[];
  /** Search results that confirm this company competes */
  evidence?: Array<{ kind: "organic" | "ad" | "article" | "local"; title: string; url?: string; domain?: string; query?: string }>;
  scoringRationale?: string;
  /** Search queries that surfaced this competitor */
  discoveryQueries?: string[];
  /** Observed organic rankings */
  organicRankings?: Array<{
    query: string;
    position: number;
    title: string;
    link: string;
    snippet?: string;
  }>;
  /** Observed sponsored / ad rankings */
  sponsoredRankings?: Array<{
    query: string;
    position: number;
    title: string;
    link: string;
    snippet?: string;
  }>;
  /** Google Ads Transparency Center verification status */
  transparencyStatus?:
    | "verified_has_ads"
    | "no_ads_found"
    | "not_verified"
    | "api_error"
    | "insufficient_evidence";
  /** Transparency Center ad creatives */
  creatives?: AdvertiserAdCreative[];
  /** Supporting text evidence quote */
  evidenceSnippet?: string;
  /** Verification timestamp */
  verifiedAt?: string;
}

export interface MarketIntelligence {
  industryOverview: string;
  marketSize: string;
  growthTrends: string[];
  keyPlayers: string[];
  emergingTrends: string[];
  customerBehaviors: string[];
  regulations: string[];
  opportunities: string[];
  threats: string[];
  searchResults?: TavilySearchResult[];
  /** Live SerpApi Intelligence */
  googleAds?: Array<{
    title: string;
    link: string;
    snippet?: string;
    displayedLink?: string;
  }>;
  /** Questions Google showed in "People also ask". `snippet`/`title`/`link` are Google's answer and its source. */
  peopleAlsoAsk?: Array<{
    id?: string;
    question: string;
    /** The search that showed this question */
    sourceQuery?: string;
    observedAt?: string;
    snippet?: string;
    link?: string;
    title?: string;
    /** Loopy's plain-language answer, prepared during the analysis or on first click */
    answer?: string;
    /** One way the brand can use this question in its marketing */
    tip?: string;
  }>;
  organicKeywords?: Array<{
    position: number;
    title: string;
    link: string;
    snippet?: string;
  }>;
  /** Comprehensive Search & Ad Intel additions */
  keywordAds?: KeywordAdResult[];
  shoppingResults?: ShoppingProduct[];
  generatedQueries?: SearchQuerySignal[];
  messagingPatterns?: Array<{ theme: string; frequency: number; examples: string[] }>;
  strategicOpportunities?: string[];
  strategicThreats?: string[];
  collectedAt?: string;
  /** How the research run went: what was searched, cache use, failures and limits */
  research?: ResearchRunInfo;
  /** True when the AI market analysis failed (fields above are empty, not invented) */
  analysisUnavailable?: boolean;
}

export type ResearchStatus = "complete" | "partial" | "empty" | "unavailable";

/** Facts about one research run, stored with the analysis and shown in Search Intel. */
export interface ResearchRunInfo {
  version: 2;
  status: ResearchStatus;
  /** When the run finished */
  completedAt: string;
  /** Oldest provider data used (older than completedAt when results came from the cache) */
  dataCollectedAt?: string;
  market: {
    scope: "local" | "national" | "international" | "unknown";
    country: string;
    /** SerpApi location the searches ran from */
    searchLocation: string;
    city?: string;
    /** True when the country was a guess (website didn't say) */
    assumed: boolean;
  };
  queries: Array<{
    query: string;
    purpose: "competitor_discovery" | "competitor_ads" | "ad_library" | "market_evidence";
    provider: "serpapi" | "tavily";
    fromCache: boolean;
    ok: boolean;
    observedAt?: string;
  }>;
  requests: Record<"serpapi" | "tavily", { network: number; cached: number; failed: number }>;
  limitations: string[];
  /** Names the AI suggested that no search result confirmed; never counted as competitors */
  unverifiedCompetitors?: Array<{ name: string; domain?: string }>;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  /** Date the source was published (ISO string or null if unavailable) */
  publishedDate: string | null;
  /** Domain/hostname of the source (e.g. "forbes.com") */
  source: string;
}

// ──────────────────────────────────────────────
// Strategic Diagnosis (Gemini reasoning layer)
// ──────────────────────────────────────────────

export interface StrategicDiagnosis {
  /** SWOT analysis */
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };

  /** Current market positioning */
  positioning: {
    current: string;
    ideal: string;
    gap: string;
  };

  /** Competitive advantages and disadvantages */
  competitiveAnalysis: {
    advantages: string[];
    disadvantages: string[];
    differentiationOpportunities: string[];
  };

  /** Key strategic insights */
  keyInsights: string[];

  /** Recommended strategic priorities (not a plan — just what to focus on) */
  strategicPriorities: string[];

  /** Marketing channel recommendations with reasoning */
  channelRecommendations: {
    channel: string;
    reasoning: string;
    priority: "high" | "medium" | "low";
  }[];

  /** Generated at timestamp */
  generatedAt: string;
}

// ──────────────────────────────────────────────
// Intelligence Store (session-keyed)
// ──────────────────────────────────────────────

export type PipelineStatus =
  | "idle"
  | "crawling_company"
  | "crawling_competitors"
  | "researching_market"
  | "analyzing_company"
  | "analyzing_competitors"
  | "analyzing_market"
  | "diagnosing"
  | "ready"
  | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  evidence?: StrategicEvidence[];
  sources?: ResearchSource[];
  confidence?: "high" | "medium" | "low";
  followUpQuestions?: string[];
  queryIntent?: string;
  researchStatus?: "success" | "no_results" | "failed" | "unconfigured";
}

export interface IntelligenceSession {
  id: string;
  status: PipelineStatus;
  statusMessage: string;
  onboardingInput: OnboardingInput;
  companyIntelligence?: CompanyIntelligence;
  competitorIntelligence?: CompetitorIntelligence[];
  marketIntelligence?: MarketIntelligence;
  diagnosis?: StrategicDiagnosis;
  /** Persistent chronological conversation history */
  messages?: ChatMessage[];
  /** Rolling executive summary of older messages when conversation becomes long */
  conversationSummary?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  /** Logged-in owner. Undefined for analyses made before login, or anonymous ones. */
  userId?: string;
}

// ──────────────────────────────────────────────
// Strategic Q&A
// ──────────────────────────────────────────────

export interface StrategicQuestion {
  sessionId: string;
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface StrategicEvidence {
  source: string;
  insight: string;
  url?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  source: string;
  score?: number;
  publishedDate?: string | null;
}

export interface StrategicAnswer {
  question: string;
  answer: string;
  /** Evidence items supporting the answer with insights and URLs (only when factually relevant) */
  evidence?: StrategicEvidence[];
  /** Normalized web research sources from Tavily (only when web research was performed) */
  sources?: ResearchSource[];
  /** Confidence level */
  confidence?: "high" | "medium" | "low";
  /** Optional contextual follow-up questions */
  followUpQuestions?: string[];
  generatedAt: string;
  /** Status of web research performed for this answer */
  researchStatus?: "success" | "no_results" | "failed" | "unconfigured";
  /** Internal classification of query intent */
  queryIntent?: string;
}

// ──────────────────────────────────────────────
// API Response Types
// ──────────────────────────────────────────────

export interface GatherResponse {
  sessionId: string;
  status: PipelineStatus;
  message: string;
}

export interface StatusResponse {
  sessionId: string;
  status: PipelineStatus;
  statusMessage: string;
  hasCompanyIntelligence: boolean;
  hasCompetitorIntelligence: boolean;
  hasMarketIntelligence: boolean;
  hasDiagnosis: boolean;
  companyName?: string;
  messages?: ChatMessage[];
  /** Search Intel for the sidebar, once the analysis is ready */
  searchIntel?: SearchIntelView;
  error?: string;
}

/** The numbers on the search intel sidebar's three tabs; each equals the length of the list it names. */
export interface SearchIntelCounts {
  questions: number;
  /** Competitor search ads + Ad Library records (the default Ads view) */
  ads: number;
  competitors: number;
}

/** One Ads Transparency Center record, ready to show. */
export interface AdLibraryEntry {
  id: string;
  competitorName: string;
  competitorDomain: string;
  advertiser: string;
  advertiserMatchesCompetitor?: boolean;
  format: "text" | "image" | "video";
  /** Real rendered preview from Google, when available */
  previewImageUrl?: string;
  /** The record on adstransparency.google.com */
  detailsUrl?: string;
  firstShownAt?: string;
  lastShownAt?: string;
  totalDaysShown?: number;
  region?: string;
}

/**
 * Everything the Search Intel sidebar shows, in one validated shape. Built on the server
 * from stored research (src/lib/intelligence/search-intel.ts); never triggers new searches.
 */
export interface SearchIntelView {
  /** "legacy" = made before research runs were recorded */
  status: ResearchStatus | "legacy";
  /** Signed-out visitors: lists are empty, counts are kept */
  locked: boolean;
  completedAt?: string;
  /** Oldest provider data used, when results were reused from the cache */
  dataCollectedAt?: string;
  cachedSearches: number;
  totalSearches: number;
  market?: ResearchRunInfo["market"];
  questions: Array<{
    id: string;
    question: string;
    sourceQuery?: string;
    observedAt?: string;
    /** Google's own answer text and its source */
    googleAnswer?: { text: string; sourceTitle?: string; sourceUrl?: string };
    /** Loopy's AI-written answer (not Google data) */
    aiAnswer?: { text: string; tip?: string };
  }>;
  ads: { competitor: KeywordAdResult[]; other: KeywordAdResult[]; own: KeywordAdResult[] };
  adLibrary: AdLibraryEntry[];
  competitors: CompetitorIntelligence[];
  searches: Array<{ query: string; purpose: string; fromCache: boolean; ok: boolean }>;
  organic: Array<{ position: number; title: string; link: string; domain: string }>;
  shopping: ShoppingProduct[];
  counts: SearchIntelCounts;
  limitations: string[];
}

export interface AskResponse {
  answer: StrategicAnswer;
  messages?: ChatMessage[];
}
