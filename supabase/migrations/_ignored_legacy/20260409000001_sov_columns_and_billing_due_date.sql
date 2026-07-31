-- Migration: Expand owner_invoice_line_items for full SOV support
-- Add due_date to billing_periods

-- ─── billing_periods: add due_date ───────────────────────────────────────────
ALTER TABLE billing_periods
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- ─── owner_invoice_line_items: add SOV columns ────────────────────────────────
ALTER TABLE owner_invoice_line_items
  ADD COLUMN IF NOT EXISTS scheduled_value         NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_completed_previous NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_completed_period   NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_completed_pct      NUMERIC(6,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS materials_stored        NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage_pct           NUMERIC(6,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage_released      NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order              INTEGER       NOT NULL DEFAULT 0;

-- net_amount_this_period is derived:
-- work_completed_period + materials_stored - retainage_amount
-- Computed as a generated column for consistency
ALTER TABLE owner_invoice_line_items
  ADD COLUMN IF NOT EXISTS net_amount_this_period NUMERIC(15,2)
    GENERATED ALWAYS AS (
      work_completed_period + materials_stored - retainage_amount
    ) STORED;

-- balance_to_finish: scheduled_value - (work_completed_previous + work_completed_period + materials_stored)
ALTER TABLE owner_invoice_line_items
  ADD COLUMN IF NOT EXISTS balance_to_finish NUMERIC(15,2)
    GENERATED ALWAYS AS (
      scheduled_value - (work_completed_previous + work_completed_period + materials_stored)
    ) STORED;

-- total_completed_stored: work_completed_previous + work_completed_period + materials_stored
ALTER TABLE owner_invoice_line_items
  ADD COLUMN IF NOT EXISTS total_completed_stored NUMERIC(15,2)
    GENERATED ALWAYS AS (
      work_completed_previous + work_completed_period + materials_stored
    ) STORED;
