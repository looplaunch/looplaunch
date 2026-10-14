-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Supabase Schema Migration
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This creates the `sessions` table that replaces the MongoDB sessions collection.
-- ══════════════════════════════════════════════════════════════

-- Drop table if it exists (safe for first-time setup)
DROP TABLE IF EXISTS sessions;

-- Main sessions table
-- Uses JSONB columns for deeply nested intelligence data (SWOT, competitors, etc.)
-- Top-level fields are explicit columns for clean indexing and querying.
CREATE TABLE sessions (
  id                      TEXT PRIMARY KEY,
  status                  TEXT NOT NULL DEFAULT 'idle',
  status_message          TEXT,
  onboarding_input        JSONB NOT NULL,
  company_intelligence    JSONB,
  competitor_intelligence JSONB,
  market_intelligence     JSONB,
  diagnosis               JSONB,
  messages                JSONB DEFAULT '[]'::jsonb,
  conversation_summary    TEXT,
  error                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for sorting by most recently updated
CREATE INDEX idx_sessions_updated_at ON sessions (updated_at DESC);

-- Index for filtering by status (useful for monitoring active pipelines)
CREATE INDEX idx_sessions_status ON sessions (status);

-- ──────────────────────────────────────────────
-- Row Level Security (RLS)
-- ──────────────────────────────────────────────
-- Disabled for now since we use service_role key server-side.
-- Enable RLS and add policies later when adding client-side auth.
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Auto-update `updated_at` on row changes
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- Verification: run this to confirm the table was created
-- ══════════════════════════════════════════════════════════════
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'sessions' ORDER BY ordinal_position;
