-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Waitlist details, and a log of every login
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run more than once. Needs migrations 006 and 008 first.
--
-- 1. The waitlist form now also asks for the person's role (Founder, CEO, … or their own words)
--    and where their brand lives online (a website, Instagram, LinkedIn, Facebook, …).
-- 2. login_events gets a row every time someone logs in (email, Google or a code), written by
--    Supabase itself, so it needs no app code and catches every way of signing in.
-- ══════════════════════════════════════════════════════════════


-- ─── 1. Waitlist: role and brand link ───────────────────────────

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS role            TEXT CHECK (char_length(role) <= 60),
  -- As typed: "halfmoon.coffee", "instagram.com/halfmoon", "@halfmoon"…
  ADD COLUMN IF NOT EXISTS brand_link      TEXT CHECK (char_length(brand_link) <= 300),
  -- Worked out from brand_link: website, instagram, linkedin, facebook, x, youtube, tiktok or other
  ADD COLUMN IF NOT EXISTS brand_platform  TEXT;


-- ─── 2. Login log ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.login_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email         TEXT,
  logged_in_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_time ON public.login_events (logged_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_user ON public.login_events (user_id, logged_in_at DESC);

-- Row level security with no policies: only the dashboard and the server's service key can read it.
-- Nobody can read the log from a browser.
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

-- Supabase sets auth.users.last_sign_in_at each time someone logs in. This copies that moment into
-- the log. It never blocks a login: if anything here fails, the login goes ahead without a log row.
CREATE OR REPLACE FUNCTION public.record_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.last_sign_in_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at) THEN
    BEGIN
      -- One row per login, even if Supabase touches last_sign_in_at twice for it (e.g. sign-up then sign-in).
      IF NOT EXISTS (
        SELECT 1 FROM public.login_events e
        WHERE e.user_id = NEW.id AND e.logged_in_at > NEW.last_sign_in_at - interval '10 seconds'
      ) THEN
        INSERT INTO public.login_events (user_id, email, logged_in_at)
        VALUES (NEW.id, NEW.email, NEW.last_sign_in_at);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'record_login: % (%)', SQLERRM, SQLSTATE;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER INSERT OR UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_login();

-- Start the log with everyone's most recent login so far (once: skipped if it's already there).
INSERT INTO public.login_events (user_id, email, logged_in_at)
SELECT u.id, u.email, u.last_sign_in_at
FROM auth.users u
WHERE u.last_sign_in_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.login_events e
    WHERE e.user_id = u.id AND e.logged_in_at = u.last_sign_in_at
  );

-- One row per person: their email, last login and how many times they've logged in.
-- security_invoker keeps the table's row level security, so this is dashboard and server only too.
CREATE OR REPLACE VIEW public.user_logins
  WITH (security_invoker = true) AS
  SELECT
    e.email,
    max(e.logged_in_at) AS last_login_at,
    min(e.logged_in_at) AS first_login_at,
    count(*)::int       AS logins
  FROM public.login_events e
  GROUP BY e.user_id, e.email
  ORDER BY last_login_at DESC;

-- Let the Supabase API see the new columns, table and view straight away.
NOTIFY pgrst, 'reload schema';

-- ─── Where to look ─────────────────────────────────────────────
-- Table Editor → waitlist: the new role, brand_link and brand_platform columns.
-- Table Editor → login_events: every login, newest first when sorted by logged_in_at.
-- Database → Views → user_logins: each person's last login and login count.
-- Or in the SQL Editor:
--   SELECT email, logged_in_at FROM login_events ORDER BY logged_in_at DESC LIMIT 50;
