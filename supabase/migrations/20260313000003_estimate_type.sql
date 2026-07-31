-- =============================================================================
-- Add estimate_type to estimates table
-- Supports company-level estimates hub (ASRS, Construction Design Build)
-- =============================================================================

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS estimate_type TEXT
    CHECK (estimate_type IN ('asrs', 'design_build'));
CREATE INDEX IF NOT EXISTS idx_estimates_type ON estimates(estimate_type)
  WHERE is_deleted = false;
