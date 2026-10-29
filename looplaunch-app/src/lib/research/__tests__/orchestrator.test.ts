import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runResearch } from "../orchestrator";
import { ad, article, creative, deps, fakeSerp, organic, profile, questions, serp } from "./helpers";

const apple = profile({
  name: "Apple",
  website: "https://www.apple.com",
  category: "smartphones",
  searchTerms: ["buy smartphone online", "iphone vs samsung", "apple iphone price"],
  likelyCompetitors: [
    { name: "Samsung", domain: "samsung.com" },
    { name: "Google Pixel", domain: "store.google.com" },
  ],
  sellsPhysicalProducts: true,
});

describe("Apple: competitor ads, not Apple's own", () => {
  const discovery = serp({
    ads: [
      ad("apple.com", "iPhone 17 Pro - Buy Now at Apple"),
      ad("samsung.com", "Galaxy S26 Ultra - Pre-order Today", { position: 2 }),
      ad("store.google.com", "Pixel 11 - The Best of Google AI", { position: 3, link: "https://store.google.com/pixel", displayedLink: "https://store.google.com" }),
      ad("t-mobile.com", "Switch to T-Mobile and Get a Free Phone", { position: 4 }),
    ],
    organic: [organic("samsung.com", "Samsung Galaxy Phones", 1), organic("techradar.com", "The best phones 2026", 2, "Samsung, Google Pixel and OnePlus lead")],
    peopleAlsoAsk: questions("What is the best smartphone?", "Is iPhone better than Samsung?"),
  });

  async function run() {
    const fake = fakeSerp({
      searches: { "best smartphones": discovery, "apple alternatives": serp({ organic: [organic("store.google.com", "Pixel phones", 1)] }) },
      library: {
        "samsung.com": [
          creative("CR1", { advertiser: "Samsung Electronics" }),
          creative("CR2", { advertiser: "Samsung Electronics", image: undefined, format: "text" }),
          creative("CR3", { advertiser: "Some Phone Repair Shop" }),
        ],
      },
    });
    const d = deps({
      serp: fake.client,
      competitors: [
        { name: "Samsung", domain: "samsung.com", similarity: 90 },
        { name: "Google Pixel", domain: "store.google.com", similarity: 85 },
      ],
    });
    const result = await runResearch(apple, { sessionId: "s_apple", deps: d });
    return { result, fake };
  }

  test("own ads are kept apart and never counted as competitor ads", async () => {
    const { result } = await run();
    const competitorAds = result.ads.filter((a) => a.relation === "competitor");
    const own = result.ads.filter((a) => a.relation === "own");
    assert.ok(competitorAds.length >= 2);
    assert.ok(competitorAds.every((a) => a.advertiserDomain !== "apple.com"));
    assert.deepEqual(own.map((a) => a.advertiserDomain), ["apple.com"]);
    assert.deepEqual(new Set(competitorAds.map((a) => a.competitorName)), new Set(["Samsung", "Google Pixel"]));
  });

  test("advertisers that aren't verified competitors go to 'other'", async () => {
    const { result } = await run();
    const other = result.ads.filter((a) => a.relation === "other");
    assert.deepEqual(other.map((a) => a.advertiserDomain), ["t-mobile.com"]);
  });

  test("ad searches never use the business's own brand", async () => {
    const { fake } = await run();
    const adSearches = fake.calls.search.slice(2);
    assert.ok(adSearches.every((q) => !/\bapple\b/i.test(q)), `searched: ${adSearches.join(" | ")}`);
  });

  test("Ad Library records keep real previews and dates, and say who ran them", async () => {
    const { result } = await run();
    const samsung = result.competitors.find((c) => c.name === "Samsung");
    assert.equal(samsung?.transparencyStatus, "verified_has_ads");
    assert.equal(samsung?.creatives?.length, 2);
    assert.ok(samsung?.creatives?.every((c) => c.competitorName === "Samsung" && c.advertiserMatchesCompetitor === true));
    assert.ok(samsung?.creatives?.[0].image?.startsWith("https://tpc.googlesyndication.com/"));
  });

  test("Ad Library records from other advertisers linking to the domain are not shown as the competitor's", async () => {
    const { result } = await run();
    const samsung = result.competitors.find((c) => c.name === "Samsung");
    assert.ok(samsung?.creatives?.every((c) => c.advertiser === "Samsung Electronics"));
    assert.ok(result.research.limitations.some((l) => l.includes("1 record linking to samsung.com")));
  });

  test("stays within the search budget and records every request", async () => {
    const { result, fake } = await run();
    assert.ok(fake.calls.search.length <= 2 + 3, `searches: ${fake.calls.search.length}`);
    assert.ok(fake.calls.library.length <= 2);
    assert.equal(result.ledger.entries.length, fake.calls.search.length + fake.calls.library.length + 1 /* tavily */);
    assert.ok(result.ledger.entries.every((e) => e.purpose));
    assert.equal(result.ledger.sessionId, "s_apple");
  });
});

describe("Every business gets research about its own market", () => {
  test("fashion store in India: fashion searches on Google India, fashion competitors", async () => {
    const fake = fakeSerp({
      searches: {
        "best ethnic wear for women": serp({
          organic: [organic("biba.in", "BIBA - Ethnic Wear for Women", 1), organic("libas.in", "Libas Kurtas", 2), organic("vogue.in", "10 best ethnic wear brands", 3)],
        }),
      },
    });
    const d = deps({ serp: fake.client, competitors: [{ name: "Biba", domain: "biba.in" }, { name: "Libas", domain: "libas.in" }, { name: "Vogue India", domain: "vogue.in" }] });
    const result = await runResearch(
      profile({ name: "Nishorama", website: "https://nishorama.com", category: "ethnic wear for women", country: "India", searchTerms: ["buy kurta sets online"] }),
      { deps: d }
    );
    assert.equal(fake.calls.search[0], "best ethnic wear for women");
    assert.equal(result.research.market.country, "India");
    assert.deepEqual(result.competitors.map((c) => c.name).sort(), ["Biba", "Libas"]);
  });

  test("local restaurant: searches name the city and run from that city", async () => {
    const fake = fakeSerp({
      location: "Austin,Texas,United States",
      searches: {
        "best pizza restaurant in austin": serp({
          local: [
            { position: 1, title: "Home Slice Pizza", address: "1415 S Congress Ave", rating: 4.6, reviews: 5000, type: "Pizza", website: "https://homeslicepizza.com" },
            { position: 2, title: "Via 313", address: "Austin", rating: 4.5, type: "Pizza" },
          ],
        }),
      },
    });
    const d = deps({ serp: fake.client, competitors: [{ name: "Home Slice Pizza", domain: "homeslicepizza.com" }, { name: "Via 313", domain: "" }] });
    const result = await runResearch(
      profile({ name: "Tony's", website: "https://tonys.example", category: "pizza restaurant", marketScope: "local", city: "Austin, Texas", country: "United States" }),
      { deps: d }
    );
    assert.deepEqual(fake.calls.location, ["Austin, Texas"]);
    assert.equal(result.research.market.searchLocation, "Austin,Texas,United States");
    assert.ok(fake.calls.search[0].includes("austin"));
    assert.deepEqual(result.competitors.map((c) => c.name).sort(), ["Home Slice Pizza", "Via 313"]);
  });

  test("B2B SaaS in the UK: software searches; a name no result mentions is not counted", async () => {
    const fake = fakeSerp({
      searches: {
        "best crm software": serp({ organic: [organic("hubspot.com", "HubSpot CRM", 1), organic("pipedrive.com", "Pipedrive CRM", 2)], ads: [ad("salesforce.com", "Salesforce CRM - Free Trial")] }),
      },
    });
    const d = deps({
      serp: fake.client,
      competitors: [
        { name: "HubSpot", domain: "hubspot.com" },
        { name: "Pipedrive", domain: "pipedrive.com" },
        { name: "Salesforce", domain: "salesforce.com" },
        { name: "Zoho CRM", domain: "zoho.com" },
      ],
    });
    const result = await runResearch(
      profile({ name: "CloseCRM", website: "https://closecrm.co.uk", category: "crm software", country: "United Kingdom" }),
      { deps: d }
    );
    assert.equal(result.research.market.country, "United Kingdom");
    assert.deepEqual(result.competitors.map((c) => c.name).sort(), ["HubSpot", "Pipedrive", "Salesforce"]);
    assert.deepEqual(result.research.unverifiedCompetitors?.map((u) => u.name), ["Zoho CRM"]);
    assert.ok(result.ads.some((a) => a.relation === "competitor" && a.competitorName === "Salesforce"));
  });

  test("unknown market: assumed country is stated, not hidden", async () => {
    const fake = fakeSerp();
    const result = await runResearch(profile({ name: "Mystery", website: "https://mystery.in", category: "tea", country: "", geography: "unspecified" }), {
      deps: deps({ serp: fake.client }),
    });
    assert.equal(result.research.market.country, "India");
    assert.equal(result.research.market.assumed, true);
    assert.ok(result.research.limitations.some((l) => l.includes(".in")));
  });

  test("unknown category: no competitor searches are spent", async () => {
    const fake = fakeSerp();
    const result = await runResearch(profile({ name: "Vague", category: "", products: [] }), { deps: deps({ serp: fake.client }) });
    assert.equal(fake.calls.search.length, 0);
    assert.equal(result.research.status, "empty");
    assert.equal(result.competitors.length, 0);
  });
});

describe("Limits, failures and honesty", () => {
  test("at most 10 questions, 10 competitor ads and 10 competitors", async () => {
    const domains = Array.from({ length: 13 }, (_, i) => `rival${i}.com`);
    const fake = fakeSerp({
      searches: {
        "best widgets": serp({
          peopleAlsoAsk: questions(...Array.from({ length: 15 }, (_, i) => `Which widget ${i} has the best ${["price", "size", "color", "speed", "warranty"][i % 5]}?`)),
          organic: domains.map((d, i) => organic(d, `Rival ${i} widgets`, i + 1)),
          ads: domains.flatMap((d, i) => [ad(d, `Rival ${i} sale`), ad(d, `Rival ${i} new range`)]),
        }),
      },
    });
    const result = await runResearch(profile({ category: "widgets" }), {
      deps: deps({ serp: fake.client, competitors: domains.map((d, i) => ({ name: `Rival ${i}`, domain: d })) }),
    });
    assert.equal(result.questions.length, 10);
    assert.equal(result.competitors.length, 10);
    assert.equal(result.ads.filter((a) => a.relation === "competitor").length, 10);
    // Already 10 competitor ads after discovery: no extra ad searches were bought.
    assert.equal(fake.calls.search.filter((q) => q !== "best widgets").length, 0);
  });

  test("a failed search keeps the others' results and marks the run partial", async () => {
    const fake = fakeSerp({
      searches: {
        "best smartphones": serp({ organic: [organic("samsung.com", "Samsung Galaxy", 1)] }),
        "apple alternatives": "rate_limited",
      },
    });
    const result = await runResearch(apple, { deps: deps({ serp: fake.client, competitors: [{ name: "Samsung", domain: "samsung.com" }] }) });
    assert.equal(result.research.status, "partial");
    assert.equal(result.competitors[0]?.name, "Samsung");
    assert.ok(result.research.limitations.some((l) => l.includes("rate limited")));
    assert.ok(result.research.queries.some((q) => q.query === "apple alternatives" && !q.ok));
  });

  test("every provider down: unavailable, nothing invented", async () => {
    const fake = fakeSerp({ searches: { "best smartphones": "not_configured", "apple alternatives": "not_configured" } });
    const d = deps({ serp: fake.client, tavily: "not_configured", competitors: [{ name: "Samsung", domain: "samsung.com" }] });
    const result = await runResearch(apple, { deps: d });
    assert.equal(result.research.status, "unavailable");
    assert.equal(result.competitors.length, 0);
    assert.equal(result.ads.length, 0);
    assert.equal(result.questions.length, 0);
    assert.equal(d.geminiCalls, 0, "Gemini isn't asked to name competitors without evidence");
  });

  test("searches that return nothing: empty, not failed", async () => {
    const fake = fakeSerp();
    const result = await runResearch(apple, { deps: deps({ serp: fake.client }) });
    assert.equal(result.research.status, "empty");
    assert.equal(result.research.queries.filter((q) => q.provider === "serpapi").every((q) => q.ok), true);
  });

  test("without Gemini, competitors come from search appearances and have no score", async () => {
    const fake = fakeSerp({
      searches: {
        "best smartphones": serp({ organic: [organic("samsung.com", "Samsung Galaxy", 1)], ads: [ad("samsung.com", "Galaxy deals")] }),
        "apple alternatives": serp({ organic: [organic("samsung.com", "Samsung phones", 1)] }),
      },
    });
    const result = await runResearch(apple, { deps: deps({ serp: fake.client, competitors: null }) });
    const samsung = result.competitors.find((c) => c.domain?.includes("samsung.com"));
    assert.ok(samsung);
    assert.equal(samsung?.score, undefined);
    assert.ok(result.research.limitations.some((l) => l.includes("Gemini was unavailable")));
  });

  test("Tavily articles help confirm competitors but are never ads", async () => {
    const fake = fakeSerp({ searches: { "best smartphones": serp({ organic: [organic("samsung.com", "Samsung", 1)] }) } });
    const result = await runResearch(apple, {
      deps: deps({
        serp: fake.client,
        tavily: [article("Best phones 2026", "OnePlus 15 is the value pick, ahead of Samsung.")],
        competitors: [{ name: "Samsung", domain: "samsung.com" }, { name: "OnePlus", domain: "oneplus.com" }],
      }),
    });
    assert.ok(result.competitors.some((c) => c.name === "OnePlus"));
    assert.equal(result.ads.length, 0);
  });
});
