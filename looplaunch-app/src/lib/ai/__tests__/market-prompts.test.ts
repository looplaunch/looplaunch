import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { MarketIntelligence, OnboardingInput, ResearchRunInfo } from "../../intelligence/types";
import { profile } from "../../research/__tests__/helpers";
import { buildConversationalAdvisorPrompt, buildDiagnosisPrompt, buildMarketAnalysisPrompt, marketBrief } from "../prompts";

function research(country: string, city?: string): ResearchRunInfo {
  return {
    version: 2,
    status: "complete",
    completedAt: "2026-11-07T00:00:00.000Z",
    market: { scope: city ? "local" : "national", country, searchLocation: country, city, assumed: false },
    queries: [],
    requests: { serpapi: { network: 0, cached: 0, failed: 0 }, tavily: { network: 0, cached: 0, failed: 0 } },
    limitations: [],
  };
}

function marketIntel(run?: ResearchRunInfo): MarketIntelligence {
  return {
    industryOverview: "",
    marketSize: "",
    growthTrends: [],
    keyPlayers: [],
    emergingTrends: [],
    customerBehaviors: [],
    regulations: [],
    opportunities: [],
    threats: [],
    research: run,
  };
}

const onboarding: OnboardingInput = {
  website: "https://brand.example",
  role: "",
  industry: "",
  stage: "",
  coreOffer: "",
  audience: [],
  salesChannels: [],
  biggestHeadache: "",
  thirtyDayGoal: "",
};

const strategyPrompt = (market: MarketIntelligence) =>
  buildConversationalAdvisorPrompt({
    question: "Give me a 7-day strategy",
    companyIntel: profile(),
    competitorIntel: [],
    marketIntel: market,
    diagnosis: null,
    onboardingInput: onboarding,
  });

describe("Gemini writes for the market the analysis researched", () => {
  test("India: rupees, Indian channels and rules, no TikTok", () => {
    const brief = marketBrief(research("India").market);
    assert.match(brief, /MARKET: INDIA/);
    assert.match(brief, /rupees \(₹\)/);
    assert.match(brief, /Flipkart/);
    assert.match(brief, /ASCI/);
    assert.match(brief, /TikTok is banned in India/);
    assert.match(marketBrief(research("India", "Pune").market), /buyers in Pune, India/);
  });

  test("an Indian 7-day strategy asks for Reels and Shorts scripts, never TikToks", () => {
    const prompt = strategyPrompt(marketIntel(research("India")));
    assert.match(prompt, /MARKET: INDIA/);
    assert.match(prompt, /Generate scripts for the recommended Reels and Shorts/);
    assert.doesNotMatch(prompt.replace("TikTok is banned in India", ""), /tiktok/i);
  });

  test("another market gets its own block; analyses without research get none", () => {
    const us = strategyPrompt(marketIntel(research("United States", "Austin")));
    assert.match(us, /MARKET: UNITED STATES/);
    assert.match(us, /buyers in Austin, United States/);
    assert.match(us, /Generate scripts for the recommended Reels and TikToks/);
    assert.doesNotMatch(us, /₹/);

    assert.doesNotMatch(strategyPrompt(marketIntel(undefined)), /═══ MARKET/);
    assert.equal(marketBrief(undefined), "");
  });

  test("the market analysis and diagnosis prompts carry the market too", () => {
    const india = research("India").market;
    assert.match(buildMarketAnalysisPrompt(onboarding, "", india), /MARKET: INDIA/);
    assert.match(buildDiagnosisPrompt("{}", "", "", onboarding, india), /MARKET: INDIA/);
  });
});
