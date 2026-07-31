-- Migration: 20260413000001_acumatica_mirror_tables.sql
-- Purpose: Create new Acumatica ERP mirror tables and alter existing ones
-- Affected tables (new): acumatica_customers, acumatica_accounts, acumatica_projects,
--   acumatica_project_tasks, acumatica_payment_applications
-- Affected tables (altered): acumatica_ar_invoices, acumatica_payments, acumatica_checks
-- Pattern: mirrors pattern from 20260313000001_acumatica_financial_sync.sql

-- ============================================================
-- NEW TABLES
-- ============================================================

-- 1. acumatica_customers
CREATE TABLE IF NOT EXISTS public.acumatica_customers (
  id                  BIGSERIAL PRIMARY KEY,
  external_key        TEXT NOT NULL UNIQUE,
  customer_id         TEXT NOT NULL,
  customer_name       TEXT NOT NULL,
  status              TEXT,
  currency_id         TEXT,
  terms               TEXT,
  tax_zone            TEXT,
  email               TEXT,
  phone               TEXT,
  last_modified_at    TIMESTAMPTZ,
  acumatica_sync_at   TIMESTAMPTZ,
  raw_payload         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acumatica_customers_customer_id
  ON public.acumatica_customers (customer_id);
CREATE INDEX IF NOT EXISTS idx_acumatica_customers_status
  ON public.acumatica_customers (status);
-- 2. acumatica_accounts
CREATE TABLE IF NOT EXISTS public.acumatica_accounts (
  id                  BIGSERIAL PRIMARY KEY,
  external_key        TEXT NOT NULL UNIQUE,
  account_id          TEXT NOT NULL,
  account_cd          TEXT,
  description         TEXT,
  type                TEXT, -- Asset / Liability / Income / Expense / Equity
  active              BOOLEAN,
  currency_id         TEXT,
  last_modified_at    TIMESTAMPTZ,
  acumatica_sync_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acumatica_accounts_account_id
  ON public.acumatica_accounts (account_id);
CREATE INDEX IF NOT EXISTS idx_acumatica_accounts_type
  ON public.acumatica_accounts (type);
-- 3. acumatica_projects
CREATE TABLE IF NOT EXISTS public.acumatica_projects (
  id                  BIGSERIAL PRIMARY KEY,
  external_key        TEXT NOT NULL UNIQUE,
  project_id          TEXT NOT NULL,
  description         TEXT,
  status              TEXT,
  customer            TEXT,
  hold                BOOLEAN,
  income              NUMERIC(14,2),
  expenses            NUMERIC(14,2),
  assets              NUMERIC(14,2),
  liabilities         NUMERIC(14,2),
  template_id         TEXT,
  external_ref_nbr    TEXT,
  local_project_id    INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  last_modified_at    TIMESTAMPTZ,
  acumatica_sync_at   TIMESTAMPTZ,
  raw_payload         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acumatica_projects_project_id
  ON public.acumatica_projects (project_id);
CREATE INDEX IF NOT EXISTS idx_acumatica_projects_customer
  ON public.acumatica_projects (customer);
CREATE INDEX IF NOT EXISTS idx_acumatica_projects_local_project_id
  ON public.acumatica_projects (local_project_id);
CREATE INDEX IF NOT EXISTS idx_acumatica_projects_status
  ON public.acumatica_projects (status);
-- 4. acumatica_project_tasks
CREATE TABLE IF NOT EXISTS public.acumatica_project_tasks (
  id                  BIGSERIAL PRIMARY KEY,
  external_key        TEXT NOT NULL UNIQUE,
  project_id          TEXT NOT NULL,
  project_task_id     TEXT NOT NULL,
  description         TEXT,
  status              TEXT,
  is_default          BOOLEAN,
  external_ref_nbr    TEXT,
  last_modified_at    TIMESTAMPTZ,
  acumatica_sync_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acumatica_project_tasks_project_task
  ON public.acumatica_project_tasks (project_id, project_task_id);
CREATE INDEX IF NOT EXISTS idx_acumatica_project_tasks_status
  ON public.acumatica_project_tasks (status);
-- 5. acumatica_payment_applications (links payments to invoices)
CREATE TABLE IF NOT EXISTS public.acumatica_payment_applications (
  id                      BIGSERIAL PRIMARY KEY,
  payment_external_key    TEXT NOT NULL,
  payment_reference_nbr   TEXT NOT NULL,
  payment_type            TEXT,
  invoice_reference_nbr   TEXT NOT NULL,
  invoice_type            TEXT,
  customer_id             TEXT,
  amount_applied          NUMERIC(14,2),
  balance                 NUMERIC(14,2),
  resolved_project_code   TEXT,
  resolution_method       TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT acumatica_payment_applications_unique
    UNIQUE (payment_reference_nbr, payment_type, invoice_reference_nbr, invoice_type)
);
CREATE INDEX IF NOT EXISTS idx_acumatica_payment_apps_payment_ref
  ON public.acumatica_payment_applications (payment_reference_nbr);
CREATE INDEX IF NOT EXISTS idx_acumatica_payment_apps_invoice_ref
  ON public.acumatica_payment_applications (invoice_reference_nbr);
CREATE INDEX IF NOT EXISTS idx_acumatica_payment_apps_customer_id
  ON public.acumatica_payment_applications (customer_id);
CREATE INDEX IF NOT EXISTS idx_acumatica_payment_apps_resolved_project
  ON public.acumatica_payment_applications (resolved_project_code);
-- ============================================================
-- ALTER EXISTING TABLES
-- ============================================================

-- acumatica_ar_invoices: add new columns
ALTER TABLE public.acumatica_ar_invoices
  ADD COLUMN IF NOT EXISTS external_key     TEXT,
  ADD COLUMN IF NOT EXISTS customer_name    TEXT,
  ADD COLUMN IF NOT EXISTS due_date         DATE,
  ADD COLUMN IF NOT EXISTS currency_id      TEXT,
  ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_payload      JSONB;
-- Backfill external_key for existing rows
UPDATE public.acumatica_ar_invoices
SET external_key = 'Invoice:' || COALESCE(type, 'Invoice') || ':' || reference_nbr
WHERE external_key IS NULL;
-- Now enforce NOT NULL and UNIQUE on external_key
ALTER TABLE public.acumatica_ar_invoices
  ALTER COLUMN external_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_acumatica_ar_invoices_external_key
  ON public.acumatica_ar_invoices (external_key);
-- acumatica_payments: add new columns
ALTER TABLE public.acumatica_payments
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_ref   TEXT;
-- acumatica_checks: add new columns
ALTER TABLE public.acumatica_checks
  ADD COLUMN IF NOT EXISTS company_id             UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_to_documents   NUMERIC(14,2);
CREATE INDEX IF NOT EXISTS idx_acumatica_checks_company_id
  ON public.acumatica_checks (company_id);
-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.acumatica_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acumatica_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acumatica_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acumatica_project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acumatica_payment_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read"
  ON public.acumatica_customers
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Allow authenticated read"
  ON public.acumatica_accounts
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Allow authenticated read"
  ON public.acumatica_projects
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Allow authenticated read"
  ON public.acumatica_project_tasks
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Allow authenticated read"
  ON public.acumatica_payment_applications
  FOR SELECT TO authenticated
  USING (true);
