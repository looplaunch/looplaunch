-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Waitlist game: first names and snake times
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run more than once, and safe for the code from before the game.
--
-- The waitlist page asks for a first name, and people can play Loopy's snake before
-- they join. Each person keeps one row with their best time; the page shows the
-- fastest first names and times as a leaderboard.
--
-- To take someone off the leaderboard, clear their best_time_ms (or edit first_name)
-- in Table Editor → waitlist. They stay on the waitlist.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS first_name    TEXT,
  -- A run's time in milliseconds, replayed and checked by the server before it is saved
  ADD COLUMN IF NOT EXISTS best_time_ms  INTEGER CHECK (best_time_ms > 0),
  ADD COLUMN IF NOT EXISTS best_time_at  TIMESTAMPTZ,
  -- When they ticked "Email me about the launch" (it also allows the name and time on the board)
  ADD COLUMN IF NOT EXISTS consented_at  TIMESTAMPTZ;

-- The leaderboard: fastest first, equal times in the order they were set.
CREATE INDEX IF NOT EXISTS idx_waitlist_board
  ON waitlist (best_time_ms, best_time_at)
  WHERE best_time_ms IS NOT NULL;

-- How many people hold each time, so the page can rank a run that isn't in the top ten.
-- security_invoker keeps the table's row level security: only the server can read it.
CREATE OR REPLACE VIEW waitlist_time_counts
  WITH (security_invoker = true) AS
  SELECT best_time_ms AS time_ms, count(*)::int AS players
  FROM waitlist
  WHERE best_time_ms IS NOT NULL AND first_name IS NOT NULL
  GROUP BY best_time_ms;

-- Let the Supabase API see the new columns and view straight away.
NOTIFY pgrst, 'reload schema';

-- Verification: Table Editor → waitlist has first_name, best_time_ms, best_time_at and
-- consented_at, and Database → Views lists waitlist_time_counts.
