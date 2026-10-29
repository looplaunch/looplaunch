import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildResearchBrief } from "../../ai/research-brief";
import { runResearch } from "../../research/orchestrator";
import { ad, creative, deps, fakeSerp, organic, profile, questions, serp } from "../../research/__tests__/helpers";
import { buildSearchIntelView, validateSearchIntelView } from "../search-intel";
import type { IntelligenceSession, MarketIntelligence } from "../types";

const emptyAnalysis = {
  industryOverview: "",
  marketSize: "",
  growthTrends: [],
  keyPlayers: [],
  emergingTrends: [],
  customerBehaviors: [],
  regulations: [],
  opportunities: [],
  threats: [],
};

/** A session as the gather route stores it, from a mocked research run. */
async function storedSession(): Promise<Pick<IntelligenceSession, "marketIntelligence" | "competitorIntelligence" | "onboardingInput" | "companyIntelligence">> {
  const company = profile({ name: "Apple", website: "https://www.apple.com", category: "smartphones", products: ["iPhone"] });
  const fake = fakeSerp({
    searches: {
      "best smartphones": serp({
        ads: [ad("apple.com", "iPhone 17 Pro"), ad("samsung.com", "Galaxy S26"), ad("verizon.com", "Verizon deals")],
        organic: [organic("samsung.com", "Samsung Galaxy", 1)],
        peopleAlsoAsk: questions("Which phone is best?", "Is iPhone worth it?"),
      }),
    },
    library: { "samsung.com": [creative("CR9", { advertiser: "Samsung Electronics" })] },
  });
  const research = await runResearch(company, { deps: deps({ serp: fake.client, competitors: [{ name: "Samsung", domain: "samsung.com" }] }) });
  const market: MarketIntelligence = {
    ...emptyAnalysis,
    keywordAds: research.ads,
    peopleAlsoAsk: research.questions.map((q, i) => ({ id: q.id, question: q.question, sourceQuery: q.sourceQuery, snippet: q.snippet, title: q.title, link: q.link, ...(i === 0 ? { answer: "AI answer", tip: "AI tip" } : {}) })),
    research: research.research,
  };
  return { companyIntelligence: company, competitorIntelligence: research.competitors, marketIntelligence: market, onboardingInput: undefined as never };
}

describe("Search Intel view", () => {
  test("counts equal the lists, own ads are separate, and the view validates", async () => {
    const view = buildSearchIntelView(await storedSession(), { locked: false });
    assert.deepEqual(validateSearchIntelView(view), []);
    assert.equal(view.counts.questions, view.questions.length);
    assert.equal(view.counts.ads, view.ads.competitor.length + view.adLibrary.length);
    assert.equal(view.counts.competitors, view.competitors.length);
    assert.deepEqual(view.ads.own.map((a) => a.advertiserDomain), ["apple.com"]);
    assert.ok(view.ads.competitor.every((a) => a.advertiserDomain === "samsung.com"));
    assert.equal(view.adLibrary[0].previewImageUrl?.startsWith("https://"), true);
  });

  test("Google's answer and Loopy's AI answer are labelled separately; sources are kept", async () => {
    const view = buildSearchIntelView(await storedSession(), { locked: false });
    const first = view.questions[0];
    assert.equal(first.googleAnswer?.sourceUrl, "https://source.example/a");
    assert.equal(first.aiAnswer?.text, "AI answer");
    assert.equal(first.sourceQuery, "best smartphones");
    assert.equal(view.questions[1].aiAnswer, undefined);
  });

  test("signed out: same counts, no records", async () => {
    const session = await storedSession();
    const open = buildSearchIntelView(session, { locked: false });
    const locked = buildSearchIntelView(session, { locked: true });
    assert.deepEqual(locked.counts, open.counts);
    assert.equal(locked.questions.length + locked.ads.competitor.length + locked.adLibrary.length + locked.competitors.length + locked.organic.length, 0);
  });

  test("older analyses: own ads separated, 10-record limits, readable dates", () => {
    const legacy = {
      companyIntelligence: profile({ name: "Apple", website: "https://www.apple.com" }),
      competitorIntelligence: Array.from({ length: 12 }, (_, i) => ({
        name: `Rival ${i}`,
        domain: `rival${i}.com`,
        website: `https://rival${i}.com`,
        description: "",
        valueProposition: "",
        products: [],
        targetSegments: [],
        strengths: [],
        weaknesses: [],
        marketingChannels: [],
        contentStrategy: "",
        differentiators: [],
        creatives: i === 0 ? [{ id: "CR1", advertiser: "Rival", targetDomain: "rival0.com", format: "image" as const, lastShown: 1793241912 }] : [],
      })),
      marketIntelligence: {
        ...emptyAnalysis,
        keywordAds: [
          { id: "x1", position: 1, title: "iPhone", link: "https://www.apple.com/iphone", query: "q", location: "US", collectedAt: "" },
          { id: "x2", position: 2, title: "Rival deal", link: "https://rival1.com/deal", query: "q", location: "US", collectedAt: "" },
        ],
        peopleAlsoAsk: Array.from({ length: 20 }, (_, i) => ({ question: `Old question ${i}?` })),
      },
      onboardingInput: undefined as never,
    };
    const view = buildSearchIntelView(legacy, { locked: false });
    assert.equal(view.status, "legacy");
    assert.equal(view.questions.length, 10);
    assert.equal(view.competitors.length, 10);
    assert.deepEqual(view.ads.own.map((a) => a.id), ["x1"]);
    assert.deepEqual(view.ads.competitor.map((a) => a.id), ["x2"]);
    assert.equal(view.adLibrary[0].lastShownAt, new Date(1793241912 * 1000).toISOString());
    assert.deepEqual(validateSearchIntelView(view), []);
  });

  test("building the view never calls a provider", async () => {
    const session = await storedSession();
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error("no network in the view");
    }) as typeof fetch;
    try {
      for (const tab of ["questions", "ads", "competitors"]) {
        assert.ok(tab && buildSearchIntelView(session, { locked: false }));
      }
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.equal(calls, 0);
  });

  test("the validator catches own ads in the competitor list and count mismatches", async () => {
    const view = buildSearchIntelView(await storedSession(), { locked: false });
    const broken = { ...view, ads: { ...view.ads, competitor: [...view.ads.competitor, ...view.ads.own] } };
    const problems = validateSearchIntelView(broken);
    assert.ok(problems.some((p) => p.includes("own ad")));
    assert.ok(problems.some((p) => p.includes("ads count")));
  });
});

describe("Research brief for the strategy model", () => {
  test("observed competitor ads with IDs and dates; own ads and unconfirmed names kept apart", async () => {
    const session = await storedSession();
    session.marketIntelligence!.research!.unverifiedCompetitors = [{ name: "Xiaomi", domain: "mi.com" }];
    const brief = buildResearchBrief({ company: session.companyIntelligence!, competitors: session.competitorIntelligence, market: session.marketIntelligence });
    assert.match(brief, /\[C1\] Samsung \(samsung\.com\)/);
    assert.match(brief, /\[A1\] Samsung: "Galaxy S26"/);
    assert.match(brief, /id ad_[0-9a-f]{16}/);
    assert.match(brief, /Apple's own ads seen: 1 \(not competitor ads\)/);
    assert.ok(!/\[A\d\][^\n]*iPhone/.test(brief), "own ads aren't listed as competitor ads");
    assert.match(brief, /unconfirmed[^\n]*Xiaomi/);
    assert.match(brief, /\[Q1\] "Which phone is best\?"/);
  });
});
