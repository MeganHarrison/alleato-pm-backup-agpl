-- Enforce minimum content quality for scenario test cases.
-- This prevents silent regressions in the testing runner by blocking incomplete scenarios.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'test_cases_scenario_quality_chk'
  ) THEN
    ALTER TABLE public.test_cases
      ADD CONSTRAINT test_cases_scenario_quality_chk
      CHECK (
        test_type <> 'scenario'
        OR (
          length(trim(coalesce(steps, ''))) > 0
          AND length(trim(coalesce(expected_result, ''))) > 0
          AND length(trim(coalesce(start_url, ''))) > 0
          AND left(trim(coalesce(start_url, '')), 1) = '/'
          AND position(' ' in trim(coalesce(start_url, ''))) = 0
          AND (
            scenario_depth <> 'detailed'
            OR length(trim(coalesce(setup_steps, ''))) > 0
          )
        )
      ) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.test_cases
  VALIDATE CONSTRAINT test_cases_scenario_quality_chk;
