-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Research cache and request ledger
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run more than once.
--
-- research_cache: provider results (SerpApi searches, Ad Library lookups, Tavily
-- searches) kept for a few days, so analysing the same market again reuses them
-- instead of spending search credits.
--
-- research_requests: one row per provider request an analysis made, with its
-- purpose, whether it came from the cache, and whether it worked.
--
-- The app works without these tables (it just won't reuse results across restarts).
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS research_cache (
  key         TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  operation   TEXT NOT NULL,
  params      JSONB NOT NULL,
  response    JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_cache_expires ON research_cache (expires_at);

CREATE TABLE IF NOT EXISTS research_requests (
  id           BIGSERIAL PRIMARY KEY,
  session_id   TEXT,
  provider     TEXT NOT NULL,
  operation    TEXT NOT NULL,
  query        TEXT,
  purpose      TEXT NOT NULL,
  cache_hit    BOOLEAN NOT NULL,
  success      BOOLEAN NOT NULL,
  error        TEXT,
  duration_ms  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_requests_session ON research_requests (session_id, created_at);

-- Only the server (service_role key) reads and writes these.
ALTER TABLE research_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_requests ENABLE ROW LEVEL SECURITY;

-- Verification: Table Editor should now list research_cache and research_requests.
