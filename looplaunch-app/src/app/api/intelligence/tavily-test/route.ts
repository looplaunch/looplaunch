/**
 * GET /api/intelligence/tavily-test
 * POST /api/intelligence/tavily-test
 *
 * Test endpoint for verifying the Tavily integration.
 *
 * GET  — Runs a default test query ("Analyze the SaaS CRM market in the United States")
 * POST — Accepts a custom query in the request body: { "query": "your search query" }
 *
 * Returns the raw Tavily search response for inspection.
 * This endpoint is for backend verification only — do not expose in production.
 */

import { NextResponse } from "next/server";
import { rejectIfNoAccess } from "@/lib/auth/team-guard";
import { isTavilyAvailable, testTavilyIntegration, searchTavily } from "@/lib/research/tavily";

const DEFAULT_TEST_QUERY = "Analyze the SaaS CRM market in the United States";

export async function GET() {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  if (!isTavilyAvailable()) {
    return NextResponse.json(
      {
        success: false,
        error: "TAVILY_API_KEY is not configured in .env.local",
        hint: "Add TAVILY_API_KEY=your_key_here to looplaunch-app/.env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await testTavilyIntegration();
    return NextResponse.json({
      success: result.success,
      query: DEFAULT_TEST_QUERY,
      resultCount: result.results.length,
      durationMs: result.durationMs,
      fromCache: result.fromCache,
      answer: result.answer || null,
      results: result.results,
      error: result.error || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Tavily Test] Unexpected error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = await rejectIfNoAccess();
  if (denied) return denied;

  if (!isTavilyAvailable()) {
    return NextResponse.json(
      {
        success: false,
        error: "TAVILY_API_KEY is not configured in .env.local",
        hint: "Add TAVILY_API_KEY=your_key_here to looplaunch-app/.env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const query = typeof body.query === "string" && body.query.trim()
      ? body.query.trim()
      : DEFAULT_TEST_QUERY;

    const result = await searchTavily({
      query,
      searchDepth: body.searchDepth || "basic",
      topic: body.topic || "general",
      maxResults: body.maxResults || 5,
      includeDomains: Array.isArray(body.includeDomains) ? body.includeDomains : undefined,
      excludeDomains: Array.isArray(body.excludeDomains) ? body.excludeDomains : undefined,
    });

    return NextResponse.json({
      success: result.success,
      query,
      resultCount: result.results.length,
      durationMs: result.durationMs,
      fromCache: result.fromCache,
      answer: result.answer || null,
      results: result.results,
      error: result.error || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Tavily Test] Unexpected error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
