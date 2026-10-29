/**
 * Which Google market to research: country, SerpApi location and Ads Transparency region.
 * Built from what the website showed (the profiler's country / city / scope), never assumed
 * silently: when the market is a guess, a note says so and travels with the results.
 */

import type { CompanyIntelligence } from "../intelligence/types";
import { hostOf } from "./domains";

interface Country {
  name: string;
  /** Google `gl` code */
  gl: string;
  /** ISO 3166 alpha-2, as SerpApi's Locations API reports it */
  iso2: string;
  /** Ads Transparency Center region: Google's country criterion ID (2000 + ISO numeric) */
  region: string;
  aliases: RegExp;
  /** Country-code domain endings that hint at the market */
  tlds: string[];
}

const COUNTRIES: Country[] = [
  { name: "United States", gl: "us", iso2: "US", region: "2840", aliases: /\b(united states|usa)\b|^\s*u\.?s\.?a?\.?\s*$/i, tlds: ["us"] },
  { name: "United Kingdom", gl: "uk", iso2: "GB", region: "2826", aliases: /\b(united kingdom|uk|great britain|britain|england|scotland|wales)\b/i, tlds: ["uk"] },
  { name: "India", gl: "in", iso2: "IN", region: "2356", aliases: /\bindia\b/i, tlds: ["in"] },
  { name: "Canada", gl: "ca", iso2: "CA", region: "2124", aliases: /\bcanada\b/i, tlds: ["ca"] },
  { name: "Australia", gl: "au", iso2: "AU", region: "2036", aliases: /\baustralia\b/i, tlds: ["au"] },
  { name: "Germany", gl: "de", iso2: "DE", region: "2276", aliases: /\b(germany|deutschland)\b/i, tlds: ["de"] },
  { name: "France", gl: "fr", iso2: "FR", region: "2250", aliases: /\bfrance\b/i, tlds: ["fr"] },
  { name: "Singapore", gl: "sg", iso2: "SG", region: "2702", aliases: /\bsingapore\b/i, tlds: ["sg"] },
  { name: "United Arab Emirates", gl: "ae", iso2: "AE", region: "2784", aliases: /\b(united arab emirates|uae|dubai|abu dhabi)\b/i, tlds: ["ae"] },
  { name: "Ireland", gl: "ie", iso2: "IE", region: "2372", aliases: /\bireland\b/i, tlds: ["ie"] },
  { name: "New Zealand", gl: "nz", iso2: "NZ", region: "2554", aliases: /\bnew zealand\b/i, tlds: ["nz"] },
  { name: "Netherlands", gl: "nl", iso2: "NL", region: "2528", aliases: /\b(netherlands|holland)\b/i, tlds: ["nl"] },
  { name: "Spain", gl: "es", iso2: "ES", region: "2724", aliases: /\bspain\b/i, tlds: ["es"] },
  { name: "Italy", gl: "it", iso2: "IT", region: "2380", aliases: /\bitaly\b/i, tlds: ["it"] },
  { name: "Brazil", gl: "br", iso2: "BR", region: "2076", aliases: /\bbrazil\b/i, tlds: ["br"] },
  { name: "Mexico", gl: "mx", iso2: "MX", region: "2484", aliases: /\bmexico\b/i, tlds: ["mx"] },
  { name: "Japan", gl: "jp", iso2: "JP", region: "2392", aliases: /\bjapan\b/i, tlds: ["jp"] },
  { name: "South Africa", gl: "za", iso2: "ZA", region: "2710", aliases: /\bsouth africa\b/i, tlds: ["za"] },
  { name: "Nigeria", gl: "ng", iso2: "NG", region: "2566", aliases: /\bnigeria\b/i, tlds: ["ng"] },
  { name: "Kenya", gl: "ke", iso2: "KE", region: "2404", aliases: /\bkenya\b/i, tlds: ["ke"] },
  { name: "Pakistan", gl: "pk", iso2: "PK", region: "2586", aliases: /\bpakistan\b/i, tlds: ["pk"] },
  { name: "Bangladesh", gl: "bd", iso2: "BD", region: "2050", aliases: /\bbangladesh\b/i, tlds: ["bd"] },
  { name: "Philippines", gl: "ph", iso2: "PH", region: "2608", aliases: /\bphilippines\b/i, tlds: ["ph"] },
  { name: "Indonesia", gl: "id", iso2: "ID", region: "2360", aliases: /\bindonesia\b/i, tlds: ["id"] },
  { name: "Malaysia", gl: "my", iso2: "MY", region: "2458", aliases: /\bmalaysia\b/i, tlds: ["my"] },
  { name: "Saudi Arabia", gl: "sa", iso2: "SA", region: "2682", aliases: /\bsaudi arabia\b/i, tlds: ["sa"] },
  { name: "Sweden", gl: "se", iso2: "SE", region: "2752", aliases: /\bsweden\b/i, tlds: ["se"] },
];

const DEFAULT_COUNTRY = COUNTRIES[0];

export type MarketScope = "local" | "national" | "international" | "unknown";

export interface SearchMarket {
  scope: MarketScope;
  country: string;
  gl: string;
  iso2: string;
  /** Ads Transparency Center region code */
  region: string;
  /** SerpApi `location` for Google searches: a canonical city name, or the country */
  location: string;
  /** Short city name used in local searches ("Austin"), when known */
  city?: string;
  /** True when the website didn't say which country it sells in */
  assumed: boolean;
  /** Plain notes about guesses or gaps, shown with the results */
  notes: string[];
}

function findCountry(text: string | undefined): Country | undefined {
  if (!text || /^(unspecified|unknown|global|worldwide|international)$/i.test(text.trim())) return undefined;
  return COUNTRIES.find((c) => c.aliases.test(text));
}

function countryFromDomain(website: string | undefined): { country: Country; tld: string } | undefined {
  const tld = hostOf(website).split(".").pop() || "";
  const country = COUNTRIES.find((c) => c.tlds.includes(tld));
  return country ? { country, tld } : undefined;
}

/** "Austin, Texas" → "Austin" */
function shortCity(city: string): string {
  return city.split(",")[0].trim();
}

/** Free SerpApi Locations lookup: a city name → SerpApi's canonical location string. */
export type CityResolver = (city: string, iso2: string) => Promise<string | null>;

export async function resolveMarket(
  profile: Pick<CompanyIntelligence, "website" | "geography" | "country" | "city" | "marketScope">,
  resolveCity?: CityResolver
): Promise<SearchMarket> {
  const notes: string[] = [];
  const stated = findCountry(profile.country) || findCountry(profile.geography);
  const hinted = stated ? undefined : countryFromDomain(profile.website);
  const country = stated || hinted?.country || DEFAULT_COUNTRY;

  if (!stated) {
    notes.push(
      hinted
        ? `The website doesn't say where it sells, so searches ran on Google ${country.name} (its domain ends in .${hinted.tld}).`
        : `The website doesn't say where it sells, so searches ran on Google ${country.name}.`
    );
  }

  const scope: MarketScope = profile.marketScope || "unknown";
  let location = country.name;
  let city: string | undefined;

  if (scope === "local") {
    const cityName = (profile.city || "").trim();
    if (!cityName) {
      notes.push(`This looks like a local business, but the website doesn't name its city, so searches covered all of ${country.name}.`);
    } else {
      city = shortCity(cityName);
      const canonical = resolveCity ? await resolveCity(cityName, country.iso2).catch(() => null) : null;
      if (canonical) location = canonical;
      else if (resolveCity) notes.push(`Google couldn't place "${cityName}" exactly, so searches ran from ${country.name} with the city in the search words.`);
    }
  }

  return { scope, country: country.name, gl: country.gl, iso2: country.iso2, region: country.region, location, city, assumed: !stated, notes };
}
