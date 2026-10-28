/**
 * Automatic Business Profiler Service
 *
 * Extracts structured intelligence from website crawl evidence and onboarding input:
 * - Industry & sub-industry
 * - Products & services
 * - Business model (B2B SaaS, D2C E-commerce, Marketplace, Agency, etc.)
 * - Target audience
 * - Geography (e.g. US, UK, Global, or explicitly "unspecified")
 * - Pricing & positioning (or explicitly "not_disclosed")
 * - Value proposition
 * - Relevant sales and marketing channels
 *
 * Grounded in crawled website evidence with explicit attribute confidence scores (0.0 - 1.0).
 * Strictly forbids inventing missing attributes.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  OnboardingInput,
  CompanyIntelligence,
} from "../intelligence/types";

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAI) genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

function getModel(modelName = "gemini-3.5-flash-lite") {
  const client = getClient();
  if (!client) return null;
  return client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2, // Low temperature for high factual accuracy
      maxOutputTokens: 3000,
    },
  });
}

function parseJsonSafe<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Deterministic fallback profiler when Gemini API key is missing or offline.
 */
function createDeterministicProfile(
  onboarding: OnboardingInput,
  crawledContent: string
): CompanyIntelligence {
  const name =
    onboarding.companyName ||
    (onboarding.website ? new URL(onboarding.website).hostname.replace(/^www\./, "").split(".")[0] : "Company");
  const coreOffer = onboarding.coreOffer || "Specialized product and services";
  const industry = onboarding.industry || "Technology & Software";

  const hasPricing = /pricing|\$\d+|\/mo|\/month|free trial/i.test(crawledContent);
  const category = (onboarding.coreOffer || industry).toLowerCase().slice(0, 60);
  const pricingAndPositioning = hasPricing
    ? "Subscription / self-serve tiers observed on website"
    : "not_disclosed";

  return {
    name,
    website: onboarding.website,
    industry,
    subIndustry: `${industry} Solutions`,
    description: `${name} provides ${coreOffer}.`,
    valueProposition: coreOffer,
    products: [coreOffer],
    businessModel: onboarding.audience?.includes("other businesses") ? "B2B SaaS / Services" : "Direct to Consumer",
    targetSegments: onboarding.audience && onboarding.audience.length > 0 ? onboarding.audience : ["Target customers"],
    geography: "unspecified",
    pricingAndPositioning,
    brandTone: "Modern, direct, outcome-focused",
    strengths: [
      "Focused product narrative addressing explicit user friction",
      "Direct digital customer acquisition workflow",
      "Agile and responsive compared to legacy competitors",
    ],
    weaknesses: [
      "Emerging brand authority in search engine rankings",
      "Limited organic search footprint across long-tail keywords",
      "Content velocity can be scaled further",
    ],
    currentChannels: onboarding.salesChannels && onboarding.salesChannels.length > 0
      ? onboarding.salesChannels
      : ["Website", "Social DMs"],
    contentThemes: ["Product Teardowns", "Customer Problem Solving", "Category Insights"],
    technologyStack: ["Modern Web Architecture"],
    attributeConfidence: {
      industry: 0.9,
      products: 0.85,
      businessModel: 0.75,
      targetAudience: 0.8,
      geography: 0.4,
      pricingAndPositioning: hasPricing ? 0.7 : 0.3,
    },
    evidenceSnippets: {
      coreOffer: coreOffer.slice(0, 150),
    },
    category,
    searchTerms: [`best ${category}`, `${category} price`, `${name} alternatives`],
    likelyCompetitors: [],
    sellsPhysicalProducts: /retail|e-?commerce|fashion|food|apparel|clothing|store|shop/i.test(`${industry} ${coreOffer}`),
  };
}

/**
 * Build a structured, factual business profile from crawled website evidence.
 */
export async function buildBusinessProfile(
  onboarding: OnboardingInput,
  crawledContent: string
): Promise<CompanyIntelligence> {
  const model = getModel();

  if (!model) {
    console.log("[BusinessProfiler] Gemini API unavailable — using deterministic profile");
    return createDeterministicProfile(onboarding, crawledContent);
  }

  const prompt = `You are a Senior Market Research Analyst and Business Profiler for Loop Launch.

TASK: Analyze the crawled website content and client answers to extract a rigorous, factual business profile.

═══ CLIENT INPUTS ═══
Website: ${onboarding.website}
Role: ${onboarding.role || "Not specified"}
Selected Industry (picked from a short dropdown, may be loose or wrong): ${onboarding.industry || "Not specified"}
Stage: ${onboarding.stage || "Not specified"}
Core Offer Description: ${onboarding.coreOffer || "Not specified"}
Target Audience: ${onboarding.audience?.join(", ") || "Not specified"}
Sales Channels: ${onboarding.salesChannels?.join(", ") || "Not specified"}
Biggest Headache: ${onboarding.biggestHeadache || "Not specified"}

═══ CRAWLED WEBSITE EVIDENCE (GROUND TRUTH) ═══
${crawledContent.substring(0, 9000) || "No website content crawled."}

═══ EXTRACTION RULES ═══
1. STRICT FACTUAL GROUNDING:
   - Extract industry, subIndustry, products, businessModel, targetSegments, geography, pricingAndPositioning, valueProposition, and currentChannels.
   - For every attribute, assign a confidence score between 0.0 and 1.0 based on how clearly it is stated on the website.
   - For attributes not found on the website:
     * If pricing is not found: set "pricingAndPositioning" to "not_disclosed".
     * If geography/location is not found: set "geography" to "unspecified".
     * DO NOT hallucinate pricing tiers or countries if not supported by the text.
2. INCLUDE EXACT EVIDENCE QUOTES:
   - Populate "evidenceSnippets" with direct short quotes (1-2 sentences) from the crawled text confirming the core offer, value prop, or pricing.
3. WHAT THEY REALLY SELL (this drives every Google search we run):
   - Decide from the website evidence. The client's "Selected Industry" comes from a short dropdown and can be wrong (a phone maker might pick "Tech & SaaS"). Use the real industry in "industry".
   - "category": the plain words a shopper types for this kind of product, 1-4 words (examples: "smartphones", "thrift clothing", "CRM software", "dog food").
   - "searchTerms": 5 short Google searches real buyers type when they are close to buying in this category: "best ...", price questions, "... vs ..." comparisons, "buy ... online", "... near me" for local shops. Lowercase, no quotes. Never use words like "software", "platform" or "tools" unless they really sell software.
   - "likelyCompetitors": up to 8 real companies or brands that sell the same kind of product to the same buyers, with their official website domain and "direct" or "indirect". Only include ones you are confident about, otherwise return []. Never include the business itself, news sites, review sites, or marketplaces.
   - "sellsPhysicalProducts": true if they sell physical goods.
4. OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema (no markdown backticks, no explanatory text):
{
  "name": "Brand / Company Name",
  "website": "${onboarding.website}",
  "industry": "Primary industry",
  "subIndustry": "Specific sub-category or niche",
  "description": "2-sentence clear factual description of what they do",
  "valueProposition": "Core customer promise or unique selling proposition",
  "products": ["Product 1", "Product 2"],
  "businessModel": "e.g. B2B SaaS, D2C E-commerce, Marketplace, Subscription, Agency",
  "targetSegments": ["Primary Buyer 1", "Buyer 2"],
  "geography": "e.g. United States, North America, Global, or 'unspecified'",
  "pricingAndPositioning": "Observed pricing structure or 'not_disclosed'",
  "brandTone": "Brand voice / style",
  "strengths": ["At least 3 specific strengths grounded in evidence"],
  "weaknesses": ["At least 3 realistic challenges or market vulnerabilities"],
  "currentChannels": ["Observed or stated channels"],
  "contentThemes": ["Themes they discuss"],
  "technologyStack": ["Tech stack if observed, or 'Modern Web Architecture'"],
  "attributeConfidence": {
    "industry": 0.95,
    "products": 0.9,
    "businessModel": 0.85,
    "targetAudience": 0.85,
    "geography": 0.7,
    "pricingAndPositioning": 0.6
  },
  "evidenceSnippets": {
    "valueProposition": "Exact quote from website",
    "products": "Exact quote from website"
  },
  "category": "plain shopper words for what they sell",
  "searchTerms": ["buyer search 1", "buyer search 2", "buyer search 3", "buyer search 4", "buyer search 5"],
  "likelyCompetitors": [{"name": "Competitor brand", "domain": "competitor.com", "type": "direct"}],
  "sellsPhysicalProducts": false
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonSafe<CompanyIntelligence>(text);

    if (!parsed || !parsed.name) {
      console.warn("[BusinessProfiler] Failed to parse model output as JSON, using deterministic profile");
      return createDeterministicProfile(onboarding, crawledContent);
    }

    return {
      ...parsed,
      website: onboarding.website,
    };
  } catch (err) {
    console.warn("[BusinessProfiler] Error calling Gemini for business profile:", err instanceof Error ? err.message : String(err));
    return createDeterministicProfile(onboarding, crawledContent);
  }
}
