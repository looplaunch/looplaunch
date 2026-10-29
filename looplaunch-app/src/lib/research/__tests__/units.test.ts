import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { classifyAds, mergeAdSightings, selectAds } from "../ads";
import { buildEvidence, findPrice, scoreCompetitor, validateCandidates } from "../competitors";
import { adAdvertiserDomain, registrableDomain } from "../domains";
import { resolveMarket } from "../market";
import { adQueries, discoveryQueries } from "../plan";
import { isNearDuplicate, selectQuestions } from "../questions";
import { canonicalQuery, parseAdLibrary, parseGoogleSearch } from "../serpapi";
import { ad, NOW, profile } from "./helpers";

const at = NOW.toISOString();

describe("parsers read SerpApi's real response shapes", () => {
  test("Google search: ads, sitelink objects, AI-overview questions, organic, local places", () => {
    const parsed = parseGoogleSearch({
      ads: [
        { position: 1, block_position: "top", title: "Galaxy S26", link: "https://www.samsung.com/s26", displayed_link: "https://www.samsung.com", description: "Pre-order", sitelinks: { inline: [{ title: "Deals", link: "https://www.samsung.com/deals" }] } },
        { title: "", link: "https://broken.example" },
      ],
      related_questions: [
        { question: "Is iPhone worth it?", text_blocks: [{ snippet: "Yes, for most people." }, { list: [{ title: "Camera", snippet: "great" }] }], references: [{ title: "Ref", link: "https://ref.example" }] },
      ],
      organic_results: [{ position: 1, title: "Samsung Phones", link: "https://www.samsung.com/phones", snippet: "From $799" }],
      local_results: { places: [{ position: 1, title: "Home Slice", address: "Austin", rating: 4.6, links: { website: "https://homeslice.example" } }] },
    });
    assert.equal(parsed.ads.length, 1, "ads without a title are dropped");
    assert.deepEqual(parsed.ads[0].sitelinks, [{ title: "Deals", link: "https://www.samsung.com/deals" }]);
    assert.equal(parsed.peopleAlsoAsk[0].snippet, "Yes, for most people.\n• Camera great");
    assert.equal(parsed.peopleAlsoAsk[0].link, "https://ref.example");
    assert.equal(parsed.organic[0].domain, "samsung.com");
    assert.equal(parsed.local[0].website, "https://homeslice.example");
  });

  test("Ad Library: Unix times become ISO dates; only real images become previews", () => {
    const parsed = parseAdLibrary(
      {
        ad_creatives: [
          { ad_creative_id: "CR1", advertiser: "Samsung", format: "text", image: "https://tpc.googlesyndication.com/archive/simgad/123", first_shown: 1788513216, last_shown: 1793241912, total_days_shown: 30, details_link: "https://adstransparency.google.com/x" },
          { ad_creative_id: "CR2", advertiser: "Samsung", format: "image", link: "https://displayads-formats.googleusercontent.com/ads/preview/content.js?client=x" },
          { ad_creative_id: "CR2", advertiser: "Samsung", format: "image" },
          { advertiser: "No id" },
        ],
      },
      at
    );
    assert.equal(parsed.creatives.length, 2, "duplicates and records without an ID are dropped");
    assert.equal(parsed.creatives[0].firstShownAt, new Date(1788513216 * 1000).toISOString());
    assert.equal(parsed.creatives[0].image, "https://tpc.googlesyndication.com/archive/simgad/123");
    assert.equal(parsed.creatives[1].image, undefined, "a JavaScript preview is not an image");
    assert.equal(parsed.creatives[0].totalDaysShown, 30);
  });

  test("near-identical searches share a cache key", () => {
    assert.equal(canonicalQuery("Best Smartphones"), canonicalQuery("best smartphone"));
    assert.notEqual(canonicalQuery("best smartphone"), canonicalQuery("best laptop"));
  });
});

describe("domains", () => {
  test("registrable domains", () => {
    assert.equal(registrableDomain("https://www.samsung.com/us/phones"), "samsung.com");
    assert.equal(registrableDomain("store.google.com"), "google.com");
    assert.equal(registrableDomain("shop.brand.co.uk"), "brand.co.uk");
    assert.equal(registrableDomain("cool-tees.myshopify.com"), "cool-tees.myshopify.com");
    assert.equal(registrableDomain("not a url"), "");
  });

  test("advertiser comes from the landing page, or the displayed link behind a tracking URL", () => {
    assert.equal(adAdvertiserDomain({ link: "https://www.samsung.com/x" }), "samsung.com");
    assert.equal(adAdvertiserDomain({ link: "https://www.googleadservices.com/pagead/aclk?x", displayedLink: "https://www.bestbuy.com › phones" }), "bestbuy.com");
    assert.equal(adAdvertiserDomain({ link: "", source: "chatgpt.com" }), "chatgpt.com");
  });
});

describe("ads", () => {
  const sightings = [
    { ad: ad("samsung.com", "Galaxy S26 - Pre-order"), query: "best smartphones", observedAt: at, location: "United States" },
    { ad: ad("samsung.com", "Galaxy S26 – Pre-order!", { position: 3 }), query: "buy smartphone online", observedAt: at, location: "United States" },
    { ad: ad("apple.com", "iPhone 17"), query: "best smartphones", observedAt: at, location: "United States" },
    { ad: ad("verizon.com", "Switch to Verizon"), query: "best smartphones", observedAt: at, location: "United States" },
  ];

  test("the same ad seen on two searches is one record with two sightings", () => {
    const merged = mergeAdSightings(sightings);
    assert.equal(merged.length, 3);
    const samsung = merged.find((a) => a.advertiserDomain === "samsung.com");
    assert.deepEqual(samsung?.observations?.map((o) => o.query), ["best smartphones", "buy smartphone online"]);
    assert.match(samsung!.id, /^ad_[0-9a-f]{16}$/);
  });

  test("own / competitor / other", () => {
    const classified = classifyAds(mergeAdSightings(sightings), "https://www.apple.com", [{ name: "Samsung", domain: "samsung.com" }]);
    const byDomain = Object.fromEntries(classified.map((a) => [a.advertiserDomain, a.relation]));
    assert.deepEqual(byDomain, { "samsung.com": "competitor", "apple.com": "own", "verizon.com": "other" });
  });

  test("selection caps each group and spreads slots across advertisers before filling", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ad: ad("samsung.com", `Samsung ad ${i}`), query: "q", observedAt: at, location: "US" }))
      .concat(Array.from({ length: 6 }, (_, i) => ({ ad: ad("google.com", `Pixel ad ${i}`, { link: "https://store.google.com/p" }), query: "q", observedAt: at, location: "US" })))
      .concat([{ ad: ad("apple.com", "Own ad"), query: "q", observedAt: at, location: "US" }]);
    const classified = classifyAds(mergeAdSightings(many), "apple.com", [
      { name: "Samsung", domain: "samsung.com" },
      { name: "Pixel", domain: "store.google.com" },
    ]);
    const picked = selectAds(classified, ["samsung.com", "store.google.com"], 5);
    assert.equal(picked.competitor.length, 5);
    assert.ok(picked.competitor.some((a) => a.competitorName === "Pixel"), "one brand can't take every slot");
    assert.equal(picked.own.length, 1);
    assert.ok(picked.competitor.every((a) => a.relation === "competitor"));

    const onlyOne = selectAds(classified.filter((a) => a.competitorName !== "Pixel"), ["samsung.com"], 5);
    assert.equal(onlyOne.competitor.length, 5, "free slots are filled when only one competitor advertised");
  });
});

describe("competitor validation and scoring", () => {
  const evidence = buildEvidence(
    {
      organic: [
        { position: 1, title: "Samsung Galaxy phones", link: "https://www.samsung.com/phones", snippet: "From $799", query: "best smartphones" },
        { position: 2, title: "Apple iPhone", link: "https://www.apple.com/iphone", snippet: "", query: "best smartphones" },
        { position: 3, title: "Best phones 2026", link: "https://www.techradar.com/best", snippet: "OnePlus and Google Pixel are great", query: "best smartphones" },
      ],
      ads: [],
      articles: [],
      local: [],
    },
    "apple.com"
  );

  test("the business's own pages are not evidence", () => {
    assert.ok(evidence.every((e) => !e.host.includes("apple.com")));
  });

  test("verified by its own site or by being named; otherwise unverified", () => {
    const { verified, unverified } = validateCandidates(
      [
        { name: "Samsung", domain: "www.samsung.com", type: "direct", similarity: 90 },
        { name: "Samsung Electronics", domain: "samsung.com/us", type: "direct", similarity: 90 },
        { name: "OnePlus", domain: "oneplus.com", type: "direct", similarity: 80 },
        { name: "Xiaomi", domain: "mi.com", type: "direct", similarity: 70 },
        { name: "TechRadar", domain: "techradar.com", type: "indirect" },
        { name: "Apple", domain: "apple.com", type: "direct" },
        { name: "Amazon", domain: "amazon.com", type: "direct" },
      ],
      evidence,
      { domain: "apple.com", name: "Apple" }
    );
    assert.deepEqual(verified.map((v) => v.name), ["Samsung", "OnePlus"]);
    assert.deepEqual(unverified.map((u) => u.name), ["Xiaomi", "Amazon"]);
  });

  test("known marketplaces are classified as marketplaces", () => {
    const withStore = buildEvidence(
      { organic: [{ position: 1, title: "Best Buy phones", link: "https://www.bestbuy.com/phones", query: "q" }], ads: [], articles: [], local: [] },
      "apple.com"
    );
    const { verified } = validateCandidates([{ name: "Best Buy", domain: "bestbuy.com", type: "direct" }], withStore, { domain: "apple.com", name: "Apple" });
    assert.equal(verified[0].type, "marketplace");
  });

  test("prices, not discounts", () => {
    assert.equal(findPrice(["Buy Galaxy S25 & Save Up To $540 On Your Purchase!"]), undefined);
    assert.equal(findPrice(["Get $200 off today. Plans from $12/month"]), "From $12/month");
    assert.equal(findPrice(["Galaxy S26 Ultra starts at $1,299"]), "Starts at $1,299");
  });

  test("score is documented arithmetic, and missing evidence means no score", () => {
    const scored = scoreCompetitor(80, 2, 4, true);
    assert.equal(scored.score, 40 + 18 + 15);
    assert.deepEqual(scored.factors.map((f) => f.max), [50, 35, 15]);
    assert.equal(scoreCompetitor(undefined, 2, 4, true).score, undefined);
    assert.equal(scoreCompetitor(80, 0, 0, false).score, undefined);
  });
});

describe("questions", () => {
  test("near-duplicates merge, different questions stay", () => {
    assert.ok(isNearDuplicate("Is the iPhone worth it?", "is iphone worth it"));
    assert.ok(!isNearDuplicate("What is the best phone?", "What is the best phone for gaming?"));
  });

  test("drops questions unrelated to the search and the business", () => {
    const found = ["What do people do 144 times a day?", "What is the most hacked phone?", "Which iPhone to stay away from?"].map((q) => ({
      question: q,
      sourceQuery: "best smartphones",
      observedAt: at,
    }));
    const picked = selectQuestions(found, 10, ["smartphones", "Apple", "iPhone"]);
    assert.deepEqual(picked.map((q) => q.question), ["What is the most hacked phone?", "Which iPhone to stay away from?"]);
  });

  test("keeps Google's order and the limit", () => {
    const found = ["Which fruit is best, apples?", "which fruit is best apples", "Is fruit like bananas healthy?", "Do cherries count as fruit?"].map((q) => ({
      question: q,
      sourceQuery: "fruit",
      observedAt: at,
    }));
    const picked = selectQuestions(found, 2);
    assert.deepEqual(picked.map((q) => q.question), ["Which fruit is best, apples?", "Is fruit like bananas healthy?"]);
    assert.ok(picked.every((q) => q.id.startsWith("q_") && q.sourceQuery === "fruit"));
  });
});

describe("search plan and market", () => {
  test("discovery searches come from the business's category, not a fixed list", async () => {
    const market = await resolveMarket(profile({ country: "India" }));
    assert.deepEqual(discoveryQueries(profile({ category: "thrift clothing" }), market, 2).map((q) => q.query), ["best thrift clothing"]);
    assert.deepEqual(
      discoveryQueries(profile({ name: "Apple", category: "smartphones", likelyCompetitors: [{ name: "A" }, { name: "B" }] }), market, 2).map((q) => q.query),
      ["best smartphones", "apple alternatives"]
    );
    assert.deepEqual(discoveryQueries(profile({ category: "" }), market, 2), []);
  });

  test("ad searches skip the own brand and target competitors not yet seen advertising", async () => {
    const market = await resolveMarket(profile());
    const queries = adQueries(
      profile({ name: "Apple", category: "smartphones", searchTerms: ["apple iphone price", "buy smartphone online"] }),
      market,
      [
        { name: "Samsung", domain: "samsung.com", category: "direct" },
        { name: "OnePlus", domain: "oneplus.com", category: "direct" },
        { name: "Best Buy", domain: "bestbuy.com", category: "marketplace" },
      ],
      { alreadyRun: ["best smartphones"], advertisingDomains: new Set(["samsung.com"]), max: 3 }
    );
    assert.deepEqual(queries, ["buy smartphone online", "oneplus smartphones"]);

    // Profile terms that name the business's own product ("iphone") would mostly show its own ads.
    const ownProductOnly = adQueries(
      profile({ name: "Apple", category: "smartphones", searchTerms: ["buy new iphone online", "macbook pro deals"] }),
      market,
      [],
      { alreadyRun: [], advertisingDomains: new Set(), max: 3 }
    );
    assert.deepEqual(ownProductOnly, ["buy smartphones"]);
  });

  test("market: stated country, domain hint, default, local city", async () => {
    assert.equal((await resolveMarket(profile({ country: "United Kingdom" }))).gl, "uk");
    const hinted = await resolveMarket(profile({ country: "", website: "https://shop.example.in" }));
    assert.equal(hinted.country, "India");
    assert.equal(hinted.region, "2356");
    assert.equal(hinted.assumed, true);
    const fallback = await resolveMarket(profile({ country: "", website: "https://shop.example.com" }));
    assert.equal(fallback.country, "United States");
    assert.ok(fallback.notes.length === 1);
    const local = await resolveMarket(profile({ marketScope: "local", city: "Austin, Texas" }), async () => "Austin,Texas,United States");
    assert.equal(local.location, "Austin,Texas,United States");
    assert.equal(local.city, "Austin");
  });
});
