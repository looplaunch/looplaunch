/**
 * Website Crawler Service
 *
 * Uses Crawl4AI (Docker/Render service) as the primary crawler.
 * Falls back to a lightweight fetch-based extractor if Crawl4AI is unavailable.
 *
 * CRAWL4AI_URL is read from environment — never hardcoded.
 */

import type { CrawledPage, CrawlResult } from "../intelligence/types";

// ──────────────────────────────────────────────
// Crawl4AI Client
// ──────────────────────────────────────────────

/**
 * Get the Crawl4AI service URL from environment.
 */
function getCrawl4AIUrl(): string | undefined {
  return process.env.CRAWL4AI_URL || undefined;
}

/**
 * Crawl a URL using the Crawl4AI service.
 * Returns the extracted content or null if the service is unavailable.
 */
async function crawlWithCrawl4AI(url: string): Promise<CrawledPage | null> {
  const baseUrl = getCrawl4AIUrl();
  if (!baseUrl) {
    console.log("[Crawler] CRAWL4AI_URL not set, skipping Crawl4AI");
    return null;
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiToken = process.env.CRAWL4AI_API_TOKEN;
    if (apiToken) {
      headers["Authorization"] = `Bearer ${apiToken}`;
    }

    const response = await fetch(`${baseUrl}/crawl`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        urls: [url],
        word_count_threshold: 10,
        extraction_strategy: "NoExtractionStrategy",
        chunking_strategy: "RegexChunking",
        css_selector: "body",
        verbose: false,
      }),
      signal: AbortSignal.timeout(45000), // 45s timeout (Crawl4AI can be slow on cold start)
    });

    if (!response.ok) {
      console.warn(`[Crawler] Crawl4AI returned ${response.status} for ${url}`);
      return null;
    }

    const data = await response.json();

    // Crawl4AI response format
    const result = Array.isArray(data) ? data[0] : data?.results?.[0] || data;

    if (!result) {
      console.warn(`[Crawler] Crawl4AI returned empty result for ${url}`);
      return null;
    }

    // In modern Crawl4AI, result.markdown is an object containing { raw_markdown, fit_markdown, etc. }
    const rawMarkdown: string =
      typeof result.markdown === "string"
        ? result.markdown
        : result.markdown?.raw_markdown ||
          result.markdown?.fit_markdown ||
          (typeof result.extracted_content === "string" ? result.extracted_content : "") ||
          (typeof result.cleaned_html === "string" ? result.cleaned_html : "") ||
          (typeof result.html === "string" ? result.html : "");

    return {
      url,
      title: result.metadata?.title || result.title || "",
      metaDescription: result.metadata?.description || result.meta_description || "",
      headings: extractHeadingsFromMarkdown(rawMarkdown),
      mainContent: truncateContent(rawMarkdown),
      links: (result.links?.internal || []).map((l: any) => (typeof l === "string" ? l : l?.href || "")).filter(Boolean),
      crawledAt: new Date().toISOString(),
      success: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Crawler] Crawl4AI error for ${url}: ${msg}`);
    return null;
  }
}

// ──────────────────────────────────────────────
// Fetch-Based Fallback Crawler
// ──────────────────────────────────────────────

/**
 * Simple fetch-based crawler as a fallback when Crawl4AI is unavailable.
 * Limited capability (no JavaScript rendering) but works without Docker.
 */
async function crawlWithFetch(url: string): Promise<CrawledPage> {
  try {
    console.log(`[Crawler] Fetching (fallback): ${url}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LoopLaunchBot/1.0; +https://looplaunch.co)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      return {
        url,
        title: "",
        metaDescription: "",
        headings: [],
        mainContent: "",
        links: [],
        crawledAt: new Date().toISOString(),
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    return parseHtml(url, html);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Crawler] Fetch error for ${url}: ${msg}`);
    return {
      url,
      title: "",
      metaDescription: "",
      headings: [],
      mainContent: "",
      links: [],
      crawledAt: new Date().toISOString(),
      success: false,
      error: msg,
    };
  }
}

// ──────────────────────────────────────────────
// HTML Parser (uses cheerio on server)
// ──────────────────────────────────────────────

/**
 * Parse HTML into a CrawledPage using cheerio.
 */
async function parseHtml(url: string, html: string): Promise<CrawledPage> {
  // Dynamic import — cheerio is only used server-side
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // Remove script, style, nav, footer elements
  $("script, style, nav, footer, header, iframe, noscript").remove();

  const title = $("title").text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || "";

  // Extract headings
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  // Extract main content
  const mainContent = $("main, article, [role='main'], .content, #content, body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  // Extract internal links
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      try {
        const absoluteUrl = new URL(href, url).toString();
        if (absoluteUrl.startsWith("http")) {
          links.push(absoluteUrl);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return {
    url,
    title,
    metaDescription,
    headings: headings.slice(0, 20), // Cap at 20 headings
    mainContent: truncateContent(mainContent),
    links: [...new Set(links)].slice(0, 50), // Dedupe, cap at 50
    crawledAt: new Date().toISOString(),
    success: true,
  };
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Crawl a single website URL.
 * Tries Crawl4AI first, falls back to fetch.
 */
export async function crawlUrl(url: string): Promise<CrawledPage> {
  // Try Crawl4AI first
  const crawl4aiResult = await crawlWithCrawl4AI(url);
  if (crawl4aiResult && crawl4aiResult.success) {
    return crawl4aiResult;
  }

  // Fallback to fetch
  return crawlWithFetch(url);
}

/**
 * Crawl a website and its key subpages (about, pricing, etc.).
 */
export async function crawlWebsite(websiteUrl: string): Promise<CrawlResult> {
  if (!websiteUrl || !websiteUrl.trim().startsWith("http")) {
    return {
      pages: [],
      domain: "",
      totalPages: 0,
      crawledAt: new Date().toISOString(),
    };
  }

  let domain = "";
  try {
    domain = new URL(websiteUrl).hostname;
  } catch {
    return {
      pages: [],
      domain: "",
      totalPages: 0,
      crawledAt: new Date().toISOString(),
    };
  }

  console.log(`[Crawler] Starting website crawl: ${domain}`);

  // Crawl the main page first
  const mainPage = await crawlUrl(websiteUrl);

  // Identify important subpages to crawl
  const subpagePaths = ["/about", "/pricing", "/features", "/products", "/services"];
  const subpageUrls = subpagePaths.map(
    (path) => new URL(path, websiteUrl).toString()
  );

  // Also check links from the main page for common subpages
  if (mainPage.success && mainPage.links.length > 0) {
    const sameDomainLinks = mainPage.links.filter((link) => {
      try {
        return new URL(link).hostname === domain;
      } catch {
        return false;
      }
    });

    // Add links that look like important pages
    const importantPatterns = /\/(about|pricing|features|products|services|team|contact|blog|solutions|platform)/i;
    for (const link of sameDomainLinks) {
      if (importantPatterns.test(link) && !subpageUrls.includes(link)) {
        subpageUrls.push(link);
      }
    }
  }

  // Crawl subpages (max 5 to stay fast)
  const subpagesToCrawl = subpageUrls.slice(0, 5);
  const subpageResults = await Promise.allSettled(
    subpagesToCrawl.map((url) => crawlUrl(url))
  );

  const allPages: CrawledPage[] = [mainPage];
  for (const result of subpageResults) {
    if (result.status === "fulfilled" && result.value.success) {
      allPages.push(result.value);
    }
  }

  console.log(
    `[Crawler] Crawled ${allPages.length} pages for ${domain} (${allPages.filter((p) => p.success).length} successful)`
  );

  return {
    pages: allPages,
    domain,
    totalPages: allPages.length,
    crawledAt: new Date().toISOString(),
  };
}

/**
 * Convert a CrawlResult into a text summary suitable for Gemini.
 */
export function crawlResultToText(result: CrawlResult): string {
  if (!result.pages.length) {
    return "No website content was successfully crawled.";
  }

  const sections: string[] = [];
  for (const page of result.pages) {
    if (!page.success) continue;

    sections.push(`
--- PAGE: ${page.url} ---
Title: ${page.title}
Description: ${page.metaDescription}
Headings: ${page.headings.join(" | ")}
Content: ${page.mainContent.substring(0, 3000)}
`);
  }

  return sections.join("\n") || "No website content was successfully crawled.";
}

/**
 * Check if Crawl4AI service is available.
 */
export async function checkCrawl4AIHealth(): Promise<boolean> {
  const baseUrl = getCrawl4AIUrl();
  if (!baseUrl) return false;

  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function truncateContent(content: string, maxLength = 8000): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + "... [truncated]";
}

function extractHeadingsFromMarkdown(markdown: string): string[] {
  const headings: string[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)/);
    if (match) {
      headings.push(match[1].trim());
    }
  }
  return headings.slice(0, 20);
}
