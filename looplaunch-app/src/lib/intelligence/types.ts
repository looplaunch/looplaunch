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
  companyName: string;
  nameAndRole: string;
  whatTheySell: string;
  website: string;
  competitors: string;
  painPoint: string;
  whyTheyreHere: string[];
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
  description: string;
  valueProposition: string;
  products: string[];
  targetSegments: string[];
  brandTone: string;
  strengths: string[];
  weaknesses: string[];
  currentChannels: string[];
  contentThemes: string[];
  technologyStack: string[];
  rawCrawlData?: CrawlResult;
}

export interface CompetitorIntelligence {
  name: string;
  website: string;
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
  }>;
  organicKeywords?: Array<{
    position: number;
    title: string;
    link: string;
    snippet?: string;
  }>;
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
  error?: string;
}

export interface AskResponse {
  answer: StrategicAnswer;
  messages?: ChatMessage[];
}
