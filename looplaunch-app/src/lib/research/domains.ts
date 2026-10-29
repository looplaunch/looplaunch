/**
 * Domain helpers for the research pipeline. Pure functions, no I/O.
 *
 * Competitors, ads and the business itself are all matched by domain, so these decide
 * whether "store.google.com", "www.samsung.com/us" and "samsung.com" are the same company.
 */

/** Country-code second levels where the registrable name sits one level deeper ("brand.co.uk"). */
const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "ltd.uk", "plc.uk",
  "com.au", "net.au", "org.au", "co.nz", "org.nz",
  "co.in", "net.in", "org.in", "firm.in", "gen.in",
  "com.sg", "com.my", "co.id", "com.ph", "com.vn", "co.th",
  "co.za", "com.ng", "co.ke", "com.eg", "com.sa", "com.tr",
  "com.br", "com.mx", "com.ar", "com.co", "com.pe",
  "co.jp", "co.kr", "com.cn", "com.hk", "com.tw", "com.pk", "com.bd",
]);

/**
 * Shared hosting platforms: "brand.myshopify.com" is the brand, not Shopify, so the
 * subdomain is kept as the identity.
 */
const PLATFORM_SUFFIXES = [
  "myshopify.com", "wixsite.com", "squarespace.com", "webflow.io", "framer.website",
  "github.io", "vercel.app", "netlify.app", "pages.dev", "blogspot.com", "wordpress.com",
  "carrd.co", "notion.site", "substack.com", "business.site",
];

/** "https://www.Example.com/path" → "www.example.com"; "" when it isn't a usable host. */
export function hostOf(urlOrHost: string | undefined | null): string {
  const raw = (urlOrHost || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return host.includes(".") ? host : "";
  } catch {
    return "";
  }
}

/** "https://www.samsung.com/us" → "samsung.com", "store.google.com" → "google.com", "x.myshopify.com" stays. */
export function registrableDomain(urlOrHost: string | undefined | null): string {
  const host = hostOf(urlOrHost).replace(/^www\d?\./, "");
  if (!host) return "";
  const platform = PLATFORM_SUFFIXES.find((p) => host === p || host.endsWith(`.${p}`));
  if (platform) {
    if (host === platform) return host;
    const sub = host.slice(0, -platform.length - 1).split(".").pop();
    return `${sub}.${platform}`;
  }
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

/** True when both point at the same registrable domain. */
export function sameSite(a: string | undefined | null, b: string | undefined | null): boolean {
  const ra = registrableDomain(a);
  return Boolean(ra) && ra === registrableDomain(b);
}

/** "https://www.bestbuy.com › iphone" → "bestbuy.com" */
export function domainFromDisplayedLink(displayed: string | undefined | null): string {
  const first = (displayed || "").replace(/^https?:\/\//i, "").split(/[\s›/]/)[0] || "";
  return registrableDomain(first);
}

const TRACKING_HOSTS = /(^|\.)(google|googleadservices|doubleclick|googlesyndication)\./;

/**
 * Who placed an ad. Ad links are often Google tracking URLs, so the landing page,
 * then the displayed link, then SerpApi's `source` (a domain on the google_ads engine) name it.
 */
export function adAdvertiserDomain(ad: { link?: string; displayedLink?: string; source?: string }): string {
  const fromLink = hostOf(ad.link);
  if (fromLink && !TRACKING_HOSTS.test(fromLink)) return registrableDomain(fromLink);
  const fromDisplayed = domainFromDisplayedLink(ad.displayedLink);
  if (fromDisplayed) return fromDisplayed;
  const source = (ad.source || "").trim();
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(source) ? registrableDomain(source) : "";
}
