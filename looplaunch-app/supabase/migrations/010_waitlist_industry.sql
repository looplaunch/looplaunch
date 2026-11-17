-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Waitlist: the industry each person picked
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once. Needs migration 006 first.
--
-- The join form asks which industry the brand is in: Fashion, Food & Beverage,
-- Beauty & Personal Care or Something else. It's optional, so it can be empty.
-- Until this is run, people still join; their industry just isn't saved.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS industry TEXT CHECK (char_length(industry) <= 40);

-- Who's waiting for which industry's version, for the launch emails.
CREATE INDEX IF NOT EXISTS idx_waitlist_industry ON public.waitlist (industry);
