/**
 * Which Google market to research: country, SerpApi location and Ads Transparency region.
 *
 * Loop Launch researches the Indian market: every analysis searches Google India, so founders
 * see the competitors, ads and buyer questions of India. That holds when the website points
 * elsewhere too, because our servers read websites from the US, where global sites show their
 * US store and prices. The one exception is a local business (a shop, salon or clinic) that
 * the website places in another country: results from India would be no use to it, so it is
 * searched where it is. Whenever the website doesn't confirm the market, a note says so and
 * travels with the results.
 */

import type { CompanyIntelligence } from "../intelligence/types";

interface Country {
  name: string;
  /** Google `gl` code */
  gl: string;
  /** ISO 3166 alpha-2, as SerpApi's Locations API reports it */
  iso2: string;
  /** Ads Transparency Center region: Google's country criterion ID (2000 + ISO numeric) */
  region: string;
  aliases: RegExp;
}

const COUNTRIES: Country[] = [
  { name: "India", gl: "in", iso2: "IN", region: "2356", aliases: /\bindia\b/i },
  { name: "United States", gl: "us", iso2: "US", region: "2840", aliases: /\b(united states|usa)\b|^\s*u\.?s\.?a?\.?\s*$/i },
  { name: "United Kingdom", gl: "uk", iso2: "GB", region: "2826", aliases: /\b(united kingdom|uk|great britain|britain|england|scotland|wales)\b/i },
  { name: "Canada", gl: "ca", iso2: "CA", region: "2124", aliases: /\bcanada\b/i },
  { name: "Australia", gl: "au", iso2: "AU", region: "2036", aliases: /\baustralia\b/i },
  { name: "Germany", gl: "de", iso2: "DE", region: "2276", aliases: /\b(germany|deutschland)\b/i },
  { name: "France", gl: "fr", iso2: "FR", region: "2250", aliases: /\bfrance\b/i },
  { name: "Singapore", gl: "sg", iso2: "SG", region: "2702", aliases: /\bsingapore\b/i },
  { name: "United Arab Emirates", gl: "ae", iso2: "AE", region: "2784", aliases: /\b(united arab emirates|uae|dubai|abu dhabi)\b/i },
  { name: "Ireland", gl: "ie", iso2: "IE", region: "2372", aliases: /\bireland\b/i },
  { name: "New Zealand", gl: "nz", iso2: "NZ", region: "2554", aliases: /\bnew zealand\b/i },
  { name: "Netherlands", gl: "nl", iso2: "NL", region: "2528", aliases: /\b(netherlands|holland)\b/i },
  { name: "Spain", gl: "es", iso2: "ES", region: "2724", aliases: /\bspain\b/i },
  { name: "Italy", gl: "it", iso2: "IT", region: "2380", aliases: /\bitaly\b/i },
  { name: "Brazil", gl: "br", iso2: "BR", region: "2076", aliases: /\bbrazil\b/i },
  { name: "Mexico", gl: "mx", iso2: "MX", region: "2484", aliases: /\bmexico\b/i },
  { name: "Japan", gl: "jp", iso2: "JP", region: "2392", aliases: /\bjapan\b/i },
  { name: "South Africa", gl: "za", iso2: "ZA", region: "2710", aliases: /\bsouth africa\b/i },
  { name: "Nigeria", gl: "ng", iso2: "NG", region: "2566", aliases: /\bnigeria\b/i },
  { name: "Kenya", gl: "ke", iso2: "KE", region: "2404", aliases: /\bkenya\b/i },
  { name: "Pakistan", gl: "pk", iso2: "PK", region: "2586", aliases: /\bpakistan\b/i },
  { name: "Bangladesh", gl: "bd", iso2: "BD", region: "2050", aliases: /\bbangladesh\b/i },
  { name: "Philippines", gl: "ph", iso2: "PH", region: "2608", aliases: /\bphilippines\b/i },
  { name: "Indonesia", gl: "id", iso2: "ID", region: "2360", aliases: /\bindonesia\b/i },
  { name: "Malaysia", gl: "my", iso2: "MY", region: "2458", aliases: /\bmalaysia\b/i },
  { name: "Saudi Arabia", gl: "sa", iso2: "SA", region: "2682", aliases: /\bsaudi arabia\b/i },
  { name: "Sweden", gl: "se", iso2: "SE", region: "2752", aliases: /\bsweden\b/i },
];

/** The market Loop Launch researches (see the note at the top). */
const HOME_COUNTRY = COUNTRIES[0];
export const HOME_MARKET = HOME_COUNTRY.name;

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
  /** Short city name used in local searches ("Pune"), when known */
  city?: string;
  /** True when the website doesn't confirm this market: it doesn't say, or it points elsewhere */
  assumed: boolean;
  /** Plain notes about guesses or gaps, shown with the results */
  notes: string[];
}

function findCountry(text: string | undefined): Country | undefined {
  if (!text || /^(unspecified|unknown|global|worldwide|international)$/i.test(text.trim())) return undefined;
  return COUNTRIES.find((c) => c.aliases.test(text));
}

/** "Pune, Maharashtra" → "Pune" */
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
  const scope: MarketScope = profile.marketScope || "unknown";
  const stated = findCountry(profile.country) || findCountry(profile.geography);
  const country = scope === "local" && stated ? stated : HOME_COUNTRY;

  if (!stated) {
    notes.push(`The website doesn't say where it sells, so searches ran on Google ${country.name}.`);
  } else if (stated !== country) {
    notes.push(`The website points to ${stated.name}, but searches ran on Google ${country.name}, the market Loop Launch researches.`);
  }

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

  return { scope, country: country.name, gl: country.gl, iso2: country.iso2, region: country.region, location, city, assumed: stated !== country, notes };
}
