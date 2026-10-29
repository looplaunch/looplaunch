import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createMemoryCache } from "../cache";
import { researchConfig } from "../config";
import { ResearchLedger } from "../ledger";
import { resolveMarket } from "../market";
import { runResearch } from "../orchestrator";
import { createSerpApiClient } from "../serpapi";
import { deps, profile } from "./helpers";

type Reply = { status: number; body: unknown } | "network";

/** A fetch that answers from a script and records every URL it was asked for. */
function scriptedFetch(script: (url: URL) => Reply) {
  const urls: URL[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    urls.push(url);
    const reply = script(url);
    if (reply === "network") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { fetchImpl, urls };
}

const googleBody = {
  ads: [{ position: 1, title: "Galaxy deals", link: "https://www.samsung.com/deals", displayed_link: "https://www.samsung.com" }],
  organic_results: [{ position: 1, title: "Samsung Galaxy", link: "https://www.samsung.com/phones" }],
  related_questions: [{ question: "Which phone is best?" }],
};

async function setup(script: (url: URL) => Reply, overrides: Parameters<typeof researchConfig>[0] = {}) {
  const config = researchConfig({ maxRetries: 1, cacheTtlHours: 72, ...overrides });
  const cache = createMemoryCache();
  const { fetchImpl, urls } = scriptedFetch(script);
  const client = createSerpApiClient({ apiKey: "test-key-123", cache, config, fetchImpl, sleep: async () => {} });
  const market = await resolveMarket(profile());
  const ledger = new ResearchLedger("s_test", {});
  return { client, cache, urls, market, ledger, config, fetchImpl };
}

describe("SerpApi client", () => {
  test("a repeated (or near-identical) search is served from the cache", async () => {
    const { client, urls, market, ledger } = await setup(() => ({ status: 200, body: googleBody }));
    const first = await client.googleSearch("best smartphones", market, { ledger, purpose: "competitor_discovery" });
    const second = await client.googleSearch("Best Smartphone", market, { ledger, purpose: "competitor_discovery" });
    assert.equal(urls.length, 1);
    assert.ok(first.ok && !first.fromCache);
    assert.ok(second.ok && second.fromCache);
    assert.equal(second.ok && second.fetchedAt, first.ok && first.fetchedAt, "cached data keeps its original collection time");
    assert.deepEqual(ledger.counts("serpapi"), { network: 1, cached: 1, failed: 0 });
  });

  test("sends the parameters each engine expects", async () => {
    const { client, urls, ledger } = await setup(() => ({ status: 200, body: { ad_creatives: [] } }));
    const india = await resolveMarket(profile({ country: "India" }));
    await client.adLibrary("samsung.com", india, { ledger, purpose: "ad_library" });
    await client.googleSearch("best phones", india, { ledger, purpose: "competitor_discovery" });
    const [library, google] = urls;
    assert.equal(library.searchParams.get("engine"), "google_ads_transparency_center");
    assert.equal(library.searchParams.get("text"), "samsung.com");
    assert.equal(library.searchParams.get("region"), "2356");
    assert.equal(library.searchParams.get("gl"), null);
    assert.equal(google.searchParams.get("gl"), "in");
    assert.equal(google.searchParams.get("location"), "India");
  });

  test("rate limit: one retry, then a typed failure (not an empty result)", async () => {
    const { client, urls, market, ledger } = await setup(() => ({ status: 429, body: { error: "Too many requests" } }));
    const result = await client.googleSearch("best phones", market, { ledger, purpose: "competitor_discovery" });
    assert.equal(urls.length, 2);
    assert.ok(!result.ok && result.kind === "rate_limited");
    assert.equal(ledger.counts("serpapi").failed, 1);
  });

  test("a retry that succeeds counts once", async () => {
    let n = 0;
    const { client, market, ledger } = await setup(() => (n++ === 0 ? "network" : { status: 200, body: googleBody }));
    const result = await client.googleSearch("best phones", market, { ledger, purpose: "competitor_discovery" });
    assert.ok(result.ok);
    assert.deepEqual(ledger.counts("serpapi"), { network: 1, cached: 0, failed: 0 });
  });

  test("out of searches: no retry", async () => {
    const { client, urls, market, ledger } = await setup(() => ({ status: 429, body: { error: "Your account has run out of searches." } }));
    const result = await client.googleSearch("best phones", market, { ledger, purpose: "competitor_discovery" });
    assert.equal(urls.length, 1);
    assert.ok(!result.ok && result.kind === "quota");
  });

  test("'no results' is an empty success, and it's cached", async () => {
    const { client, urls, market, ledger } = await setup(() => ({ status: 200, body: { error: "Google hasn't returned any results for this query." } }));
    const result = await client.googleSearch("zzqx obscure", market, { ledger, purpose: "competitor_discovery" });
    assert.ok(result.ok && result.data.ads.length === 0 && result.data.organic.length === 0);
    await client.googleSearch("zzqx obscure", market, { ledger, purpose: "competitor_discovery" });
    assert.equal(urls.length, 1);
  });

  test("no API key: typed failure without any request", async () => {
    const config = researchConfig();
    const { fetchImpl, urls } = scriptedFetch(() => ({ status: 200, body: googleBody }));
    const client = createSerpApiClient({ apiKey: undefined, cache: createMemoryCache(), config, fetchImpl });
    const ledger = new ResearchLedger(undefined, {});
    const result = await client.googleSearch("x", await resolveMarket(profile()), { ledger, purpose: "competitor_discovery" });
    assert.ok(!result.ok && result.kind === "not_configured");
    assert.equal(urls.length, 0);
  });

  test("the API key never appears in the request log", async () => {
    const { client, market, ledger } = await setup(() => ({ status: 500, body: { error: "boom" } }));
    await client.googleSearch("best phones", market, { ledger, purpose: "competitor_discovery" });
    assert.ok(!JSON.stringify(ledger.entries).includes("test-key-123"));
  });
});

describe("Cache reuse across analyses", () => {
  test("analysing the same business again makes no new SerpApi requests", async () => {
    const config = researchConfig({ maxRetries: 0 });
    const cache = createMemoryCache();
    const { fetchImpl, urls } = scriptedFetch((url) =>
      url.searchParams.get("engine") === "google_ads_transparency_center" ? { status: 200, body: { ad_creatives: [] } } : { status: 200, body: googleBody }
    );
    const business = profile({ name: "Apple", website: "https://apple.com", category: "smartphones", searchTerms: ["buy smartphone online"] });
    const run = () =>
      runResearch(business, {
        config,
        deps: deps({ serp: createSerpApiClient({ apiKey: "k", cache, config, fetchImpl, sleep: async () => {} }), competitors: [{ name: "Samsung", domain: "samsung.com" }] }),
      });

    const first = await run();
    const networkFirst = urls.length;
    const second = await run();
    assert.ok(networkFirst > 0);
    assert.equal(urls.length, networkFirst, "second run is served entirely from the cache");
    assert.equal(second.research.requests.serpapi.network, 0);
    assert.ok(second.research.queries.filter((q) => q.provider === "serpapi").every((q) => q.fromCache));
    assert.equal(second.competitors.length, first.competitors.length);
  });
});
