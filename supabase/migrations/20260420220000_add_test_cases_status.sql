-- Add status column to test_cases for soft-delete / lifecycle management.
-- Code in multiple API routes already filters on test_cases.status = 'inactive'
-- but the column was never created in the original test_tracking migration.

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive'));
CREATE INDEX IF NOT EXISTS idx_test_cases_status
  ON public.test_cases (status);
COMMENT ON COLUMN public.test_cases.status IS
  'Lifecycle state: active (default) or inactive (soft-deleted / archived).';
