-- Add depth controls for scenario-based manual testing
-- Allows broad human testing now while preserving detailed scenarios for later.

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS scenario_depth TEXT NOT NULL DEFAULT 'detailed'
    CHECK (scenario_depth IN ('broad', 'detailed'));
ALTER TABLE public.test_runs
  ADD COLUMN IF NOT EXISTS scenario_depth TEXT NOT NULL DEFAULT 'detailed'
    CHECK (scenario_depth IN ('broad', 'detailed', 'all'));
CREATE INDEX IF NOT EXISTS idx_test_cases_suite_type_depth
  ON public.test_cases (suite_id, test_type, scenario_depth);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite_depth_date
  ON public.test_runs (suite_id, scenario_depth, run_date DESC);
