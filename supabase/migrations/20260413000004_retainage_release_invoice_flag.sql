-- Add is_retainage_release flag to subcontractor_invoices.
-- When true, this is a dedicated retainage release invoice (Procore pattern):
-- all line items have $0 work/materials billing; only retainage_released columns are filled.
ALTER TABLE subcontractor_invoices
  ADD COLUMN IF NOT EXISTS is_retainage_release BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN subcontractor_invoices.is_retainage_release IS
  'True when this invoice exists solely to release previously-withheld retainage. '
  'All billing line items should have $0 work completed and only retainage_released values set. '
  'Mirrors Procore''s dedicated "Create Invoice for Release of Retainage" flow.';
