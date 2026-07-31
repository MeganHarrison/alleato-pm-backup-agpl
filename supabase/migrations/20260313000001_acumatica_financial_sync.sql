-- Acumatica financial sync foundation:
-- - raw ERP finance tables for AP bills, AP checks, and project budgets
-- - sync cursor/state tracking for incremental scheduled imports
-- - direct_costs ERP linkage columns so imported AP bills can power existing UI

CREATE TABLE IF NOT EXISTS public.acumatica_sync_state (
  entity_name TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle',
  last_started_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_cursor TIMESTAMPTZ,
  last_error TEXT,
  last_stats JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.acumatica_ap_bills (
  id BIGSERIAL PRIMARY KEY,
  external_key TEXT NOT NULL UNIQUE,
  reference_nbr TEXT NOT NULL,
  document_type TEXT,
  vendor_id TEXT,
  vendor_ref TEXT,
  project_code TEXT,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  date DATE,
  due_date DATE,
  post_period TEXT,
  status TEXT,
  description TEXT,
  currency_id TEXT,
  cash_account TEXT,
  terms TEXT,
  approved_for_payment BOOLEAN,
  hold BOOLEAN,
  amount NUMERIC(14,2),
  balance NUMERIC(14,2),
  tax_total NUMERIC(14,2),
  last_modified_at TIMESTAMPTZ,
  acumatica_sync_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_ap_bills_reference_nbr_idx
  ON public.acumatica_ap_bills (reference_nbr);
CREATE INDEX IF NOT EXISTS acumatica_ap_bills_project_id_idx
  ON public.acumatica_ap_bills (project_id);
CREATE INDEX IF NOT EXISTS acumatica_ap_bills_vendor_id_idx
  ON public.acumatica_ap_bills (vendor_id);
CREATE INDEX IF NOT EXISTS acumatica_ap_bills_last_modified_at_idx
  ON public.acumatica_ap_bills (last_modified_at DESC);
CREATE TABLE IF NOT EXISTS public.acumatica_ap_bill_lines (
  id BIGSERIAL PRIMARY KEY,
  bill_id BIGINT NOT NULL REFERENCES public.acumatica_ap_bills(id) ON DELETE CASCADE,
  line_nbr INTEGER,
  account TEXT,
  amount NUMERIC(14,2),
  description TEXT,
  extended_cost NUMERIC(14,2),
  inventory_id TEXT,
  po_order_nbr TEXT,
  po_order_type TEXT,
  project_code TEXT,
  project_task TEXT,
  qty NUMERIC(14,4),
  cost_code TEXT,
  tax_category TEXT,
  transaction_description TEXT,
  unit_cost NUMERIC(14,2),
  uom TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_ap_bill_lines_bill_id_idx
  ON public.acumatica_ap_bill_lines (bill_id);
CREATE INDEX IF NOT EXISTS acumatica_ap_bill_lines_project_code_idx
  ON public.acumatica_ap_bill_lines (project_code);
CREATE INDEX IF NOT EXISTS acumatica_ap_bill_lines_cost_code_idx
  ON public.acumatica_ap_bill_lines (cost_code);
CREATE TABLE IF NOT EXISTS public.acumatica_checks (
  id BIGSERIAL PRIMARY KEY,
  external_key TEXT NOT NULL UNIQUE,
  reference_nbr TEXT NOT NULL,
  document_type TEXT,
  vendor_id TEXT,
  vendor_name TEXT,
  payment_ref TEXT,
  application_date DATE,
  status TEXT,
  description TEXT,
  payment_method TEXT,
  cash_account TEXT,
  currency_id TEXT,
  payment_amount NUMERIC(14,2),
  last_modified_at TIMESTAMPTZ,
  acumatica_sync_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_checks_vendor_id_idx
  ON public.acumatica_checks (vendor_id);
CREATE INDEX IF NOT EXISTS acumatica_checks_application_date_idx
  ON public.acumatica_checks (application_date DESC);
CREATE TABLE IF NOT EXISTS public.acumatica_project_budgets (
  id BIGSERIAL PRIMARY KEY,
  external_key TEXT NOT NULL UNIQUE,
  project_code TEXT NOT NULL,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  project_task_id TEXT,
  account_group TEXT,
  cost_code TEXT,
  description TEXT,
  record_type TEXT,
  inventory_id TEXT,
  uom TEXT,
  unit_rate NUMERIC(14,4),
  original_budgeted_amount NUMERIC(14,2),
  revised_budgeted_amount NUMERIC(14,2),
  budgeted_co_amount NUMERIC(14,2),
  actual_amount NUMERIC(14,2),
  actual_plus_open_committed_amount NUMERIC(14,2),
  original_committed_amount NUMERIC(14,2),
  revised_committed_amount NUMERIC(14,2),
  committed_co_amount NUMERIC(14,2),
  committed_invoiced_amount NUMERIC(14,2),
  committed_open_amount NUMERIC(14,2),
  cost_at_completion NUMERIC(14,2),
  cost_to_complete NUMERIC(14,2),
  variance_amount NUMERIC(14,2),
  percentage_of_completion NUMERIC(14,4),
  retainage NUMERIC(14,2),
  draft_invoices_amount NUMERIC(14,2),
  pending_invoice_amount NUMERIC(14,2),
  last_modified_at TIMESTAMPTZ,
  acumatica_sync_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_project_budgets_project_code_idx
  ON public.acumatica_project_budgets (project_code);
CREATE INDEX IF NOT EXISTS acumatica_project_budgets_project_id_idx
  ON public.acumatica_project_budgets (project_id);
CREATE INDEX IF NOT EXISTS acumatica_project_budgets_cost_code_idx
  ON public.acumatica_project_budgets (cost_code);
ALTER TABLE public.direct_costs
  ADD COLUMN IF NOT EXISTS acumatica_document_key TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_ref_nbr TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_doc_type TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_financial_period TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_sync_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS direct_costs_acumatica_document_key_key
  ON public.direct_costs (acumatica_document_key);
CREATE INDEX IF NOT EXISTS direct_costs_acumatica_ref_nbr_idx
  ON public.direct_costs (acumatica_ref_nbr)
  WHERE acumatica_ref_nbr IS NOT NULL;
