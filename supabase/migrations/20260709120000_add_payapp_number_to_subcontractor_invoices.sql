-- Job Planner pay-application rollup: group Acumatica bills into JP pay-apps.
--
-- Acumatica splits each Job Planner pay application into a progress bill + a retainage
-- bill, so the app shows ~2x the invoice rows JP does. This column tags each
-- subcontractor_invoice with the JP pay-app it belongs to (e.g. "PI-5092-0006"), so the
-- UI can group the real granular bills into JP's pay-app view and totals tie out — without
-- discarding the actual Acumatica records.
ALTER TABLE public.subcontractor_invoices ADD COLUMN IF NOT EXISTS jobplanner_pay_app_number text;
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_pay_app
  ON public.subcontractor_invoices (subcontract_id, jobplanner_pay_app_number)
  WHERE jobplanner_pay_app_number IS NOT NULL;
