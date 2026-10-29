/**
 * Centralized SEO configuration and site metadata.
 */

// Fallback to production domain if NEXT_PUBLIC_SITE_URL is not set
const DEFAULT_SITE_URL = "https://looplaunch.co";

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  return DEFAULT_SITE_URL;
}

export const siteConfig = {
  name: "Loop Launch",
  title: "Loop Launch — AI-Powered Strategic Marketing Intelligence",
  description:
    "Loop Launch diagnoses your marketing, analyzes competitors, evaluates positioning, and delivers actionable strategic intelligence powered by AI.",
  url: getSiteUrl(),
  ogImage: `${getSiteUrl()}/og-image.png`,
  keywords: [
    "strategic marketing AI",
    "competitor research AI",
    "marketing intelligence platform",
    "AI market analysis",
    "marketing diagnosis",
    "brand positioning audit",
    "strategic marketing assistant",
    "SaaS marketing strategy",
    "Loop Launch",
  ],
  links: {
    twitter: "https://twitter.com/looplaunch",
    // Shown in the footer and the legal pages. looplaunch.ai has no mail set up, so this is on .co.
    contact: "work@looplaunch.co",
  },
};
