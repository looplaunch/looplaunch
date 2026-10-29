import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

/** Signed-in and per-person pages: nothing for search engines there. */
const PRIVATE_PATHS = ["/api/", "/intelligence", "/ready", "/new", "/home", "/history", "/profile", "/reset-password"];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl().replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
