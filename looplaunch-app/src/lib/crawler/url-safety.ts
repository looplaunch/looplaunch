/**
 * Server-side request forgery (SSRF) protection for the crawler.
 *
 * The website URL comes from the user, so before the server fetches it (or any redirect
 * it leads to) we check that it points at the public internet: http(s) only, standard
 * ports, no credentials, and a hostname that doesn't resolve to a private, loopback,
 * link-local (e.g. cloud metadata 169.254.169.254) or reserved address.
 *
 * Known gap: DNS is checked just before each request, so a hostname that changes its
 * answer between the check and the connection (DNS rebinding) isn't fully covered.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeUrlError extends Error {}

/** True for addresses that aren't on the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast and reserved
    );
  }
  if (version === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7)); // IPv4-mapped
    return /^(fe[89ab]|fc|fd|ff)/.test(v); // link-local, unique-local, multicast
  }
  return true;
}

export async function assertPublicUrl(
  raw: string,
  resolve: (host: string) => Promise<string[]> = async (host) => (await lookup(host, { all: true, verbatim: true })).map((a) => a.address)
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That isn't a valid web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http and https addresses can be read.");
  if (url.username || url.password) throw new UnsafeUrlError("Addresses with a username or password can't be read.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Only standard web ports can be read.");

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || /\.(localhost|local|internal|home\.arpa)$/.test(host)) {
    throw new UnsafeUrlError("That address isn't on the public internet.");
  }
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await resolve(host);
  } catch {
    throw new UnsafeUrlError("That website's address couldn't be found.");
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new UnsafeUrlError("That address isn't on the public internet.");
  }
  return url;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - total;
    if (value.byteLength >= room) {
      chunks.push(value.subarray(0, room));
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** fetch() that checks the URL and every redirect hop, and reads at most `maxBytes`. */
export async function safeFetch(
  raw: string,
  init: RequestInit & { maxRedirects?: number; maxBytes?: number; fetchImpl?: typeof fetch; resolve?: (host: string) => Promise<string[]> } = {}
): Promise<{ response: Response; url: string; body: string }> {
  const { maxRedirects = 5, maxBytes = 2_000_000, fetchImpl = fetch, resolve, ...requestInit } = init;
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(current, resolve);
    const response = await fetchImpl(url.toString(), { ...requestInit, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    return { response, url: url.toString(), body: await readCapped(response, maxBytes) };
  }
  throw new UnsafeUrlError("That website redirected too many times.");
}
