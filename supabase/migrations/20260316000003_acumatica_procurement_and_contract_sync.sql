-- Acumatica procurement + contract sync tables:
-- - Change orders
-- - Subcontracts
-- - Purchase orders
-- - Payments

CREATE TABLE IF NOT EXISTS public.acumatica_change_orders (
  id BIGSERIAL PRIMARY KEY,
  external_key TEXT NOT NULL UNIQUE,
  reference_nbr TEXT NOT NULL,
  project_code TEXT,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  customer_id TEXT,
  class TEXT,
  status TEXT,
  reverse_status TEXT,
  revenue_change_nbr TEXT,
  description TEXT,
  detailed_description TEXT,
  external_ref_nbr TEXT,
  original_co_ref_nbr TEXT,
  change_date DATE,
  completion_date DATE,
  hold BOOLEAN,
  contract_time_change_days INTEGER,
  commitments_change_total NUMERIC(14,2),
  cost_budget_change_total NUMERIC(14,2),
  revenue_budget_change_total NUMERIC(14,2),
  gross_margin NUMERIC(14,4),
  gross_margin_amount NUMERIC(14,2),
  last_modified_at TIMESTAMPTZ,
  acumatica_sync_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_change_orders_reference_nbr_idx
  ON public.acumatica_change_orders (reference_nbr);
CREATE INDEX IF NOT EXISTS acumatica_change_orders_project_id_idx
  ON public.acumatica_change_orders (project_id);
CREATE INDEX IF NOT EXISTS acumatica_change_orders_change_date_idx
  ON public.acumatica_change_orders (change_date DESC);
CREATE INDEX IF NOT EXISTS acumatica_change_orders_status_idx
  ON public.acumatica_change_orders (status);
CREATE TABLE IF NOT EXISTS public.acumatica_subcontracts (
  id BIGSERIAL PRIMARY KEY,
  external_key TEXT NOT NULL UNIQUE,
  subcontract_nbr TEXT NOT NULL,
  project_code TEXT,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  vendor_id TEXT,
  vendor_ref TEXT,
  owner TEXT,
  status TEXT,
  description TEXT,
  terms TEXT,
  date DATE,
  start_date DATE,
  currency_id TEXT,
  apply_retainage BOOLEAN,
  retainage_pct NUMERIC(14,4),
  retainage_total NUMERIC(14,2),
  control_total NUMERIC(14,2),
  line_total NUMERIC(14,2),
  discount_total NUMERIC(14,2),
  tax_total NUMERIC(14,2),
  subcontract_total NUMERIC(14,2),
  last_modified_at TIMESTAMPTZ,
  acumatica_sync_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_subcontracts_subcontract_nbr_idx
  ON public.acumatica_subcontracts (subcontract_nbr);
CREATE INDEX IF NOT EXISTS acumatica_subcontracts_project_id_idx
  ON public.acumatica_subcontracts (project_id);
CREATE INDEX IF NOT EXISTS acumatica_subcontracts_vendor_id_idx
  ON public.acumatica_subcontracts (vendor_id);
CREATE INDEX IF NOT EXISTS acumatica_subcontracts_status_idx
  ON public.acumatica_subcontracts (status);
CREATE TABLE IF NOT EXISTS public.acumatica_purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  external_key TEXT NOT NULL UNIQUE,
  order_nbr TEXT NOT NULL,
  order_type TEXT,
  project_code TEXT,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  vendor_id TEXT,
  vendor_ref TEXT,
  status TEXT,
  description TEXT,
  terms TEXT,
  date DATE,
  promised_on DATE,
  currency_id TEXT,
  hold BOOLEAN,
  control_total NUMERIC(14,2),
  line_total NUMERIC(14,2),
  order_total NUMERIC(14,2),
  tax_total NUMERIC(14,2),
  last_modified_at TIMESTAMPTZ,
  acumatica_sync_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_purchase_orders_order_nbr_idx
  ON public.acumatica_purchase_orders (order_nbr);
CREATE INDEX IF NOT EXISTS acumatica_purchase_orders_project_id_idx
  ON public.acumatica_purchase_orders (project_id);
CREATE INDEX IF NOT EXISTS acumatica_purchase_orders_vendor_id_idx
  ON public.acumatica_purchase_orders (vendor_id);
CREATE INDEX IF NOT EXISTS acumatica_purchase_orders_status_idx
  ON public.acumatica_purchase_orders (status);
CREATE TABLE IF NOT EXISTS public.acumatica_payments (
  id BIGSERIAL PRIMARY KEY,
  external_key TEXT NOT NULL UNIQUE,
  reference_nbr TEXT NOT NULL,
  document_type TEXT,
  project_code TEXT,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  customer_id TEXT,
  status TEXT,
  description TEXT,
  payment_method TEXT,
  payment_ref TEXT,
  external_ref TEXT,
  cash_account TEXT,
  currency_id TEXT,
  application_date DATE,
  hold BOOLEAN,
  payment_amount NUMERIC(14,2),
  available_balance NUMERIC(14,2),
  last_modified_at TIMESTAMPTZ,
  acumatica_sync_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_payments_reference_nbr_idx
  ON public.acumatica_payments (reference_nbr);
CREATE INDEX IF NOT EXISTS acumatica_payments_customer_id_idx
  ON public.acumatica_payments (customer_id);
CREATE INDEX IF NOT EXISTS acumatica_payments_project_id_idx
  ON public.acumatica_payments (project_id);
CREATE INDEX IF NOT EXISTS acumatica_payments_application_date_idx
  ON public.acumatica_payments (application_date DESC);
