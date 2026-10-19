-- ══════════════════════════════════════════════════════════════
-- Loop Launch — User Leads & Questions View Migration
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This transforms the nested JSON in `sessions` into clean, user-friendly
-- spreadsheet tables and rows right inside your Supabase Table Editor!
-- ══════════════════════════════════════════════════════════════

-- 1. Main Leads View: One clean row per user / company
CREATE OR REPLACE VIEW user_leads AS
SELECT
  s.id AS session_id,
  s.created_at,
  COALESCE(s.onboarding_input->>'companyName', 'Unknown') AS company_name,
  COALESCE(s.onboarding_input->>'nameAndRole', 'Anonymous') AS contact_name,
  COALESCE(s.onboarding_input->>'website', '') AS website,
  COALESCE(s.onboarding_input->>'whatTheySell', '') AS what_they_sell,
  COALESCE(s.onboarding_input->>'painPoint', '') AS pain_point,
  COALESCE(s.onboarding_input->>'competitors', '') AS competitors,
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

-- 2. Granular Questions View: One clean row per user query asked
CREATE OR REPLACE VIEW user_queries_log AS
SELECT
  (elem->>'timestamp')::timestamptz AS asked_at,
  COALESCE(s.onboarding_input->>'companyName', 'Unknown') AS company_name,
  COALESCE(s.onboarding_input->>'nameAndRole', 'Anonymous') AS contact_name,
  COALESCE(s.onboarding_input->>'website', '') AS website,
  elem->>'content' AS user_query,
  s.id AS session_id
FROM sessions s,
LATERAL jsonb_array_elements(COALESCE(s.messages, '[]'::jsonb)) elem
WHERE elem->>'role' = 'user'
ORDER BY asked_at DESC;

-- Verification comment:
-- After running this, click Table Editor in Supabase to see `user_leads` and `user_queries_log`!
