-- Split retainage into Work vs Materials on subcontractor invoice line items.
-- Procore's G703 tracks work retainage and materials retainage as independent
-- lines with their own % and $ columns. The existing retainage_pct/amount
-- columns are repurposed as WORK retainage (no data migration needed — they
-- already represent work-completed retainage on every active invoice).

-- Drop the generated net_amount column so we can recompute it with both retainages.
ALTER TABLE subcontractor_invoice_line_items
  DROP COLUMN IF EXISTS net_amount_this_period;
-- Work retainage columns already exist as retainage_pct / retainage_amount.
-- Add Materials retainage columns.
ALTER TABLE subcontractor_invoice_line_items
  ADD COLUMN IF NOT EXISTS materials_retainage_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS materials_retainage_amount numeric NOT NULL DEFAULT 0;
-- Historical "From Previous Application" retainage (read-only rollover from
-- prior approved invoices — stored per-line so it survives invoice deletion).
ALTER TABLE subcontractor_invoice_line_items
  ADD COLUMN IF NOT EXISTS previous_work_retainage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_materials_retainage numeric NOT NULL DEFAULT 0;
-- Re-add net_amount_this_period accounting for BOTH retainages.
ALTER TABLE subcontractor_invoice_line_items
  ADD COLUMN net_amount_this_period numeric GENERATED ALWAYS AS (
    (work_completed_period + materials_stored)
      - (retainage_amount + materials_retainage_amount)
  ) STORED;
COMMENT ON COLUMN subcontractor_invoice_line_items.retainage_pct IS
  'Work retainage % applied to work completed (G703 column I1)';
COMMENT ON COLUMN subcontractor_invoice_line_items.retainage_amount IS
  'Work retainage $ retained this period (G703 column I2)';
COMMENT ON COLUMN subcontractor_invoice_line_items.materials_retainage_pct IS
  'Materials retainage % applied to materials stored (G703 column I3)';
COMMENT ON COLUMN subcontractor_invoice_line_items.materials_retainage_amount IS
  'Materials retainage $ retained this period (G703 column I4)';
