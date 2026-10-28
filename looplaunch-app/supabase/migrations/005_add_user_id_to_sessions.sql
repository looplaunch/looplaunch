-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Link analyses (sessions) to logged-in users
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run more than once.
--
-- user_id is empty for analyses made before login existed, and for anyone
-- who never signs in. Those keep working by session ID as before.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- History page: "this user's analyses, newest first"
CREATE INDEX IF NOT EXISTS idx_sessions_user_updated
  ON sessions (user_id, updated_at DESC);

-- Turn row-level security on for sessions. The app reads and writes sessions with
-- the service_role key, which bypasses RLS, so nothing in the app changes. The public
-- anon key gets no access at all.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Verification: Table Editor → sessions should now have a user_id column.
