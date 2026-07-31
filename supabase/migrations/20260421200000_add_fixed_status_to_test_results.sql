-- Add 'fixed' as a valid status for test_results.
-- 'fixed' = was failing, then the fix skill resolved it and verified it passes.
-- Keeps it distinct from 'pass' (passed on first run).

ALTER TABLE public.test_results
  DROP CONSTRAINT IF EXISTS test_results_status_check;
ALTER TABLE public.test_results
  ADD CONSTRAINT test_results_status_check
  CHECK (status IN ('pass', 'fail', 'skip', 'not_tested', 'fixed'));
