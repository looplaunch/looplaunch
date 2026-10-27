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

export interface AdvertiserAdCreative {
  id: string;
  advertiser: string;
  advertiserId?: string;
  targetDomain: string;
  format: "text" | "image" | "video";
  image?: string;
  video?: string;
  body?: string;
  firstShown?: string;
  lastShown?: string;
  detailsLink?: string;
}

export interface KeywordAdResult {
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
  query: string;
  location: string;
  collectedAt: string;
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
  /** Heuristic score (0 to 100) */
  score?: number;
  scoreBreakdown?: CompetitorScoreBreakdown;
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
  peopleAlsoAsk?: Array<{
    question: string;
    snippet?: string;
    link?: string;
    title?: string;
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
  marketIntelligence?: MarketIntelligence;
  competitorIntelligence?: CompetitorIntelligence[];
  error?: string;
}

export interface AskResponse {
  answer: StrategicAnswer;
  messages?: ChatMessage[];
}
