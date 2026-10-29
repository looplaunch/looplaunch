-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Waitlist emails
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run more than once.
--
-- One row per person who joins the waitlist on looplaunch.co.
-- Emails are stored lower-cased, so the same address can't be added twice.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source      TEXT,
  user_agent  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email
  ON waitlist (lower(email));

-- Only the server (service_role key, which bypasses RLS) can read or add rows.
-- The public anon key gets no access, so nobody can download the list from the browser.
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Verification: Table Editor → waitlist should exist with the columns above.
