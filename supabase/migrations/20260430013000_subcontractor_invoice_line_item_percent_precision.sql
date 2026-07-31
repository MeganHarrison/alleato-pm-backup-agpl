-- Allow exact 100.0000 percentage values on subcontractor invoice lines.
-- NUMERIC(6,4) only supports values below 100 and breaks fully billed lines.
ALTER TABLE public.subcontractor_invoice_line_items
  ALTER COLUMN work_completed_pct TYPE NUMERIC(7,4),
  ALTER COLUMN retainage_pct TYPE NUMERIC(7,4),
  ALTER COLUMN materials_retainage_pct TYPE NUMERIC(7,4);
