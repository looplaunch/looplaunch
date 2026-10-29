import { NextResponse } from "next/server";
import { checkSupabaseConnection } from "@/lib/db/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { tavily } from "@tavily/core";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check Supabase
  try {
    const sb = await checkSupabaseConnection();
    results.supabase = {
      status: sb.ok ? "ok" : "error",
      message: sb.message,
    };
  } catch (err) {
    results.supabase = {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Check Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    results.gemini = {
      status: "error",
      message: "GEMINI_API_KEY is not set",
    };
  } else {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
      const ping = await model.generateContent("ping");
      results.gemini = {
        status: ping.response.text() ? "ok" : "error",
        message: "Gemini 3.5 Flash Lite is connected and responding",
      };
    } catch (err) {
      results.gemini = {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 3. Check Tavily
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    results.tavily = {
      status: "error",
      message: "TAVILY_API_KEY is not set",
    };
  } else {
    try {
      const tv = tavily({ apiKey: tavilyKey });
      const searchRes = await tv.search("test", { maxResults: 1 });
      results.tavily = {
        status: searchRes.results.length >= 0 ? "ok" : "error",
        message: "Tavily search API is connected and responding",
      };
    } catch (err) {
      results.tavily = {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 4. Check SerpApi
  const serpKey = process.env.SERPAPI_API_KEY;
  if (!serpKey) {
    results.serpapi = {
      status: "notice",
      message: "SERPAPI_API_KEY not configured",
    };
  } else {
    try {
      // The Account API is free; a real test search here would spend a credit on every health check.
      const { serpApiAccount } = await import("@/lib/research/serpapi");
      const account = await serpApiAccount(serpKey);
      results.serpapi = account.ok
        ? { status: "ok", message: `SerpApi key works (${account.searchesLeft} searches left this month)` }
        : { status: "error", message: `SerpApi check failed: ${account.message}` };
    } catch (err) {
      results.serpapi = {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 5. Check Crawl4AI
  const crawlUrl = process.env.CRAWL4AI_URL;
  if (!crawlUrl) {
    results.crawl4ai = {
      status: "notice",
      message: "CRAWL4AI_URL not configured (using built-in fetch crawler)",
    };
  } else {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${crawlUrl.replace(/\/+$/, "")}/health`, {
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(crawlUrl, { signal: controller.signal });
      });
      clearTimeout(timeout);
      results.crawl4ai = {
        status: res.ok ? "ok" : "error",
        statusCode: res.status,
        message: res.ok
          ? "Crawl4AI service reachable"
          : `Crawl4AI returned HTTP status ${res.status}`,
      };
    } catch (err) {
      results.crawl4ai = {
        status: "warning",
        message: `Crawl4AI unreachable at ${crawlUrl} (${err instanceof Error ? err.message : String(err)}). App will use fetch-based fallback crawler.`,
      };
    }
  }

  const allOk =
    results.supabase &&
    (results.supabase as { status: string }).status === "ok" &&
    results.gemini &&
    (results.gemini as { status: string }).status === "ok";

  return NextResponse.json(
    {
      overall: allOk ? "healthy" : "action_required",
      timestamp: new Date().toISOString(),
      services: results,
    },
    { status: 200 }
  );
}
