import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assertPublicUrl, isPrivateAddress, safeFetch, UnsafeUrlError } from "../url-safety";

const publicDns = async () => ["93.184.216.34"];

describe("crawler URL safety (SSRF)", () => {
  test("private, loopback, link-local and reserved addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      assert.ok(isPrivateAddress(ip), ip);
    }
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111"]) assert.ok(!isPrivateAddress(ip), ip);
  });

  test("refuses unsafe URLs before any request", async () => {
    const cases = [
      "http://localhost:3000/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "file:///etc/passwd",
      "http://user:pass@example.com/",
      "http://example.com:8080/",
      "http://printer.local/",
    ];
    for (const url of cases) {
      await assert.rejects(assertPublicUrl(url, publicDns), UnsafeUrlError, url);
    }
    await assert.rejects(assertPublicUrl("https://sneaky.example", async () => ["10.0.0.5"]), UnsafeUrlError);
    assert.equal((await assertPublicUrl("https://example.com/about", publicDns)).hostname, "example.com");
  });

  test("a redirect to an internal address is refused", async () => {
    const asked: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      asked.push(String(input));
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    }) as typeof fetch;
    await assert.rejects(safeFetch("https://example.com/", { fetchImpl, resolve: publicDns }), UnsafeUrlError);
    assert.deepEqual(asked, ["https://example.com/"], "the internal address is never requested");
  });

  test("follows public redirects and caps the body", async () => {
    const fetchImpl = (async (input: string | URL | Request) =>
      String(input).endsWith("/old")
        ? new Response(null, { status: 301, headers: { location: "/new" } })
        : new Response("x".repeat(5000), { status: 200 })) as typeof fetch;
    const { url, body } = await safeFetch("https://example.com/old", { fetchImpl, resolve: publicDns, maxBytes: 1000 });
    assert.equal(url, "https://example.com/new");
    assert.equal(body.length, 1000);
  });
});
