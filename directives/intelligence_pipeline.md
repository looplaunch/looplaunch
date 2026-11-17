# Intelligence Pipeline Backend

## Overview
Loop Launch's backend is a strategic marketing intelligence system that:
1. **Gathers** — crawls company/competitor websites + market research
2. **Structures** — uses Gemini to organize raw data into intelligence profiles
3. **Diagnoses** — generates SWOT, positioning, competitive analysis
4. **Answers** — responds to user questions using stored intelligence

## Architecture
```
Frontend (Onboarding) → POST /api/intelligence/gather
                            ├── Crawl4AI (company + competitor websites)
                            ├── Tavily (market research)
                            └── Gemini (structure + diagnose)
                        → IntelligenceStore (in-memory, keyed by session)

Frontend (Q&A)        → POST /api/intelligence/ask
                            ├── Tavily Search (real-time web research on user question)
                            ├── Retrieve stored intelligence
                            └── Gemini (reason + answer backed by Tavily sources)
                        → Structured Answer with Evidence & Verified Source URLs
```

## API Endpoints
- `POST /api/intelligence/gather` — Start intelligence pipeline (async)
- `GET /api/intelligence/status?sessionId=xxx` — Poll pipeline progress
- `POST /api/intelligence/ask` — Ask strategic questions

## Services
| Service | File | Status |
|---------|------|--------|
| Gemini AI | `lib/ai/gemini.ts` | ✅ Active |
| Prompt Templates | `lib/ai/prompts.ts` | ✅ Active |
| Website Crawler | `lib/crawler/website-crawler.ts` | ✅ Active (Crawl4AI + fetch fallback) |
| Tavily Search | `lib/research/tavily.ts` | ✅ Active (@tavily/core SDK) |
| Intelligence Store | `lib/intelligence/store.ts` | ✅ Active (MongoDB Atlas + In-memory cache) |
| Database Client | `lib/db/mongodb.ts` | ✅ Active (MongoDB Atlas singleton) |

## Environment Variables
Required in `looplaunch-app/.env.local`:
- `GEMINI_API_KEY` — Google Gemini API key ✅
- `CRAWL4AI_URL` — Crawl4AI service URL (never hardcoded)
- `TAVILY_API_KEY` — Tavily API key (optional for now)
- `MONGODB_URI` — MongoDB Atlas connection string ✅

## Key Principle
**"Research Once, Answer Many Times"**
Intelligence is gathered once per session and stored. The Q&A endpoint
reuses stored intelligence without re-crawling or re-researching.

## Crawl4AI Deployment
See `crawl4ai-service/README.md` for Docker and Render deployment steps.

## Edge Cases & Learnings
- Crawl4AI has cold-start delays on Render Starter plan (~30-60s)
- Gemini sometimes returns markdown-fenced JSON — parser strips fences
- Fallback fetch crawler can't render JavaScript-heavy sites
- In-memory store survives Next.js hot reloads via globalThis
- **Market is India (since 2026-11-07).** Every scan researches Google India: SerpApi `gl=in`, `location=India` (or the Indian city of a local business), Ads Transparency region `2356`, Tavily `country: "india"` with "in India" in the article query. The one exception is a local business (shop, salon, clinic) whose website places it in another country; it is searched in its own city. Logic lives in `lib/research/market.ts`.
  - Why not trust the website's country: the app runs on Render's default (US) region, so global sites serve their US store and prices to our crawler, and the profiler reads "United States". Before this change, any site that didn't state its country also fell back to the US.
  - Gemini writes for the market stored with each analysis (`research.market`): `marketBrief()` in `lib/ai/prompts.ts` goes into the market analysis, diagnosis, buyer-question answers and chat prompts (₹, Indian channels and rules). Old analyses keep the market they were researched in.
  - TikTok is banned in India: for Indian analyses the strategy prompt asks for Reels and Shorts scripts, never TikToks.
- Tavily's `country` takes a lowercase English country name ("india") and only works with `topic: "general"`. Cache keys (SerpApi and Tavily) include the market, so results cached for another country are never reused.
