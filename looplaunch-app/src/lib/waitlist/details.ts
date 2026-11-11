/**
 * The extra details the waitlist asks new people for: their role, and where their brand lives
 * online. Pure functions, shared by the form (to check as they type) and the API (to clean what
 * it stores), so both agree on what's valid.
 */

/** The roles offered as choices. "Other" lets them type their own. */
export const ROLE_OPTIONS = ["Founder", "Co-founder", "CEO", "CTO", "CMO", "Marketing lead", "Agency / Freelancer", "Other"] as const;

export const ROLE_MAX = 60;
export const BRAND_LINK_MAX = 300;

/** Where a brand link points, worked out from the address so the table can be filtered by it. */
export type BrandPlatform = "website" | "instagram" | "linkedin" | "facebook" | "x" | "youtube" | "tiktok" | "other";

export interface WaitlistDetails {
  role: string;
  brandLink: string;
  brandPlatform: BrandPlatform;
}

/** One line of text: trimmed, inner runs of whitespace made single spaces, control characters removed. */
function oneLine(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** A role as stored, or "" when there's none. A typed role ("Other") keeps the person's own words. */
export function cleanRole(raw: unknown): string {
  const role = oneLine(raw, ROLE_MAX);
  // "Other" on its own says nothing; the form asks them to type the role instead.
  return role.toLowerCase() === "other" ? "" : role;
}

const PLATFORMS: [BrandPlatform, RegExp][] = [
  ["instagram", /(^|\.)(instagram\.com|instagr\.am)$/],
  ["linkedin", /(^|\.)linkedin\.com$/],
  ["facebook", /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
  ["x", /(^|\.)(twitter\.com|x\.com)$/],
  ["youtube", /(^|\.)(youtube\.com|youtu\.be)$/],
  ["tiktok", /(^|\.)tiktok\.com$/],
];

/** The host name in a link typed with or without "https://" and "www.", or "" when there isn't one. */
function hostOf(link: string): string {
  const first = link.split(/[\s,]+/)[0] ?? "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(first) ? first : `https://${first}`;
  try {
    const host = new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "");
    // A real host has a dot and a top-level part of letters: "brand.com", not "brand" or "1.2".
    return /\.[a-z]{2,}$/.test(host) ? host : "";
  } catch {
    return "";
  }
}

export function brandPlatformOf(link: string): BrandPlatform {
  const host = hostOf(link);
  if (!host) return "other";
  return PLATFORMS.find(([, pattern]) => pattern.test(host))?.[0] ?? "website";
}

/**
 * The brand link as stored, or null when it doesn't look like a place online. Accepts a web
 * address with or without "https://" ("halfmoon.coffee", "instagram.com/halfmoon") or a handle
 * ("@halfmoon"). Several, separated by commas, are kept together; the first decides the platform.
 */
export function cleanBrandLink(raw: unknown): { link: string; platform: BrandPlatform } | null {
  const link = oneLine(raw, BRAND_LINK_MAX);
  if (!link) return null;
  const first = link.split(/[\s,]+/)[0] ?? "";
  const isHandle = /^@[\p{L}\p{N}._-]{2,}$/u.test(first);
  if (!isHandle && !hostOf(first)) return null;
  return { link, platform: brandPlatformOf(first) };
}

/** Both details cleaned, or null if either is missing or doesn't check out. */
export function parseDetails(role: unknown, brand: unknown): WaitlistDetails | null {
  const cleanedRole = cleanRole(role);
  const cleanedBrand = cleanBrandLink(brand);
  if (!cleanedRole || !cleanedBrand) return null;
  return { role: cleanedRole, brandLink: cleanedBrand.link, brandPlatform: cleanedBrand.platform };
}
