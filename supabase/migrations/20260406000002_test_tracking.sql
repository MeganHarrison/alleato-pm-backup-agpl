-- Test tracking tables for Procore feature test matrices
-- Tracks test suites, cases, runs, results, and screenshots per tool

-- ─── test_suites ─────────────────────────────────────────────────────────────
-- One row per tool (photos, budget, commitments, etc.)
CREATE TABLE IF NOT EXISTS public.test_suites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name     TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  source_doc_count INTEGER NOT NULL DEFAULT 0,
  total_cases   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ─── test_cases ──────────────────────────────────────────────────────────────
-- Individual test items extracted from the Procore docs matrix
CREATE TABLE IF NOT EXISTS public.test_cases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id      UUID NOT NULL REFERENCES public.test_suites(id) ON DELETE CASCADE,
  test_number   TEXT NOT NULL,           -- e.g. "1.1.1"
  category      TEXT NOT NULL,           -- e.g. "Core Upload Actions"
  subcategory   TEXT,                    -- e.g. "Single Photo Upload"
  test_name     TEXT NOT NULL,
  steps         TEXT,                    -- markdown / newline-separated steps
  expected_result TEXT,
  priority      TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH','MEDIUM','LOW')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (suite_id, test_number)
);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite_id
  ON public.test_cases (suite_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_priority
  ON public.test_cases (suite_id, priority);
-- ─── test_runs ───────────────────────────────────────────────────────────────
-- A single testing session
CREATE TABLE IF NOT EXISTS public.test_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id      UUID NOT NULL REFERENCES public.test_suites(id) ON DELETE CASCADE,
  run_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  tester        TEXT,
  environment   TEXT NOT NULL DEFAULT 'localhost:3000',
  branch        TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite_id
  ON public.test_runs (suite_id, run_date DESC);
-- ─── test_results ────────────────────────────────────────────────────────────
-- Outcome of a single test case within a run
CREATE TABLE IF NOT EXISTS public.test_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  case_id       UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'not_tested'
                  CHECK (status IN ('pass','fail','skip','not_tested')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, case_id)
);
CREATE INDEX IF NOT EXISTS idx_test_results_run_id
  ON public.test_results (run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status
  ON public.test_results (run_id, status);
-- ─── test_screenshots ────────────────────────────────────────────────────────
-- Screenshots attached to test results (stored in Supabase Storage)
CREATE TABLE IF NOT EXISTS public.test_screenshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id     UUID NOT NULL REFERENCES public.test_results(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,           -- e.g. "test-screenshots/run_id/case_id/filename.png"
  public_url    TEXT,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_screenshots_result_id
  ON public.test_screenshots (result_id);
-- ─── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_test_cases_updated_at'
  ) THEN
    CREATE TRIGGER set_test_cases_updated_at
      BEFORE UPDATE ON public.test_cases
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_test_results_updated_at'
  ) THEN
    CREATE TRIGGER set_test_results_updated_at
      BEFORE UPDATE ON public.test_results
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
