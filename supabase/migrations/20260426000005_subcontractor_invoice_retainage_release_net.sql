-- Include released retainage in subcontractor invoice payment due.
-- Retainage release invoices carry $0 current work/materials billing and pay
-- only the previously withheld work/materials retainage released this period.
ALTER TABLE public.subcontractor_invoice_line_items
  DROP COLUMN IF EXISTS net_amount_this_period;
ALTER TABLE public.subcontractor_invoice_line_items
  ADD COLUMN net_amount_this_period numeric GENERATED ALWAYS AS (
    (work_completed_period + materials_stored)
      - (retainage_amount + materials_retainage_amount)
      + (work_retainage_released + materials_retainage_released)
  ) STORED;
COMMENT ON COLUMN public.subcontractor_invoice_line_items.net_amount_this_period IS
  'Payment due this period: current work/materials less new retainage plus released work/materials retainage.';
