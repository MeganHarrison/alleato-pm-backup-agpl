-- Add scenario support columns to test_cases
-- Extends the test tracking system (20260406000002_test_tracking.sql) with:
--   test_type    — 'feature' (exhaustive matrix) | 'scenario' (guided user journey)
--   start_url    — relative URL to open in app for this test (e.g. /67/budget)
--   context_note — plain-English "what this tests" blurb for non-technical testers
--   setup_steps  — "Before you start" prerequisites

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS test_type TEXT NOT NULL DEFAULT 'feature'
    CHECK (test_type IN ('feature', 'scenario')),
  ADD COLUMN IF NOT EXISTS start_url TEXT,
  ADD COLUMN IF NOT EXISTS context_note TEXT,
  ADD COLUMN IF NOT EXISTS setup_steps TEXT;

CREATE INDEX IF NOT EXISTS idx_test_cases_type
  ON public.test_cases (suite_id, test_type);
