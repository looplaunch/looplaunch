-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Rebuild user_leads & user_queries_log for the 9-question onboarding
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Replaces 003_create_user_leads_view.sql. Safe to run more than once.
--
-- The onboarding now saves these keys in sessions.onboarding_input:
--   website, role, industry, stage, coreOffer, audience[], salesChannels[],
--   biggestHeadache, thirtyDayGoal, companyName (optional)
-- Older sessions used: companyName, nameAndRole, whatTheySell, painPoint, competitors.
-- The views below read the new keys first and fall back to the old ones.
-- ══════════════════════════════════════════════════════════════

-- Views have to be dropped first: CREATE OR REPLACE can't remove or rename columns.
DROP VIEW IF EXISTS user_leads;
DROP VIEW IF EXISTS user_queries_log;

-- 1. Main Leads View: one row per session (company + onboarding answers + queries)
CREATE VIEW user_leads AS
SELECT
  s.id AS session_id,
  s.created_at,
  COALESCE(NULLIF(s.onboarding_input->>'companyName', ''), 'Unknown') AS company_name,
  COALESCE(s.onboarding_input->>'website', '') AS website,
  COALESCE(s.onboarding_input->>'role', '') AS role,
  COALESCE(s.onboarding_input->>'industry', '') AS industry,
  COALESCE(s.onboarding_input->>'stage', '') AS stage,
  COALESCE(
    NULLIF(s.onboarding_input->>'coreOffer', ''),
    s.onboarding_input->>'whatTheySell',
    ''
  ) AS core_offer,
  COALESCE(
    (
      SELECT string_agg(v, ', ')
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(s.onboarding_input->'audience') = 'array'
             THEN s.onboarding_input->'audience' ELSE '[]'::jsonb END
      ) AS v
    ),
    ''
  ) AS audience,
  COALESCE(
    (
      SELECT string_agg(v, ', ')
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(s.onboarding_input->'salesChannels') = 'array'
             THEN s.onboarding_input->'salesChannels' ELSE '[]'::jsonb END
      ) AS v
    ),
    ''
  ) AS sales_channels,
  COALESCE(
    NULLIF(s.onboarding_input->>'biggestHeadache', ''),
    s.onboarding_input->>'painPoint',
    ''
  ) AS biggest_headache,
  COALESCE(s.onboarding_input->>'thirtyDayGoal', '') AS thirty_day_goal,
  COALESCE(
    (
      SELECT string_agg('• ' || (elem->>'content'), E'\n')
      FROM jsonb_array_elements(COALESCE(s.messages, '[]'::jsonb)) elem
      WHERE elem->>'role' = 'user'
    ),
    'No queries asked yet'
  ) AS user_queries,
  COALESCE(
    (
      SELECT count(*)
      FROM jsonb_array_elements(COALESCE(s.messages, '[]'::jsonb)) elem
      WHERE elem->>'role' = 'user'
    ),
    0
  )::integer AS total_queries,
  s.status AS pipeline_status
FROM sessions s
ORDER BY s.created_at DESC;

-- 2. Granular Questions View: one row per question a user asked
CREATE VIEW user_queries_log AS
SELECT
  (elem->>'timestamp')::timestamptz AS asked_at,
  COALESCE(NULLIF(s.onboarding_input->>'companyName', ''), 'Unknown') AS company_name,
  COALESCE(s.onboarding_input->>'website', '') AS website,
  elem->>'content' AS user_query,
  s.id AS session_id
FROM sessions s,
LATERAL jsonb_array_elements(COALESCE(s.messages, '[]'::jsonb)) elem
WHERE elem->>'role' = 'user'
ORDER BY asked_at DESC;

-- 3. Lock the views down. Views run with the owner's rights, so without this the
--    public anon key could read every lead through the Supabase API.
--    The app reads sessions with the service_role key, so it is not affected.
REVOKE ALL ON user_leads FROM anon, authenticated;
REVOKE ALL ON user_queries_log FROM anon, authenticated;

-- Verification: open Table Editor → user_leads and user_queries_log.
