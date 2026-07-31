-- Baseline the live owner payment application table before migrations that
-- add line items and retention/payment application links.
CREATE TABLE IF NOT EXISTS public.prime_contract_payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  project_id integer NOT NULL,
  application_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  amount numeric NOT NULL DEFAULT 0,
  retention_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric,
  period_from date,
  period_to date,
  submitted_at timestamptz,
  submitted_by text,
  approved_at timestamptz,
  approved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  billing_period_id uuid,
  billing_date date,
  percent_complete numeric DEFAULT 0,
  CONSTRAINT prime_contract_payment_applications_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])),
  CONSTRAINT prime_contract_payment_applic_contract_id_application_numbe_key
    UNIQUE (contract_id, application_number)
);

ALTER TABLE public.prime_contract_payment_applications
  ADD COLUMN IF NOT EXISTS billing_period_id uuid,
  ADD COLUMN IF NOT EXISTS billing_date date,
  ADD COLUMN IF NOT EXISTS percent_complete numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pcpa_contract_id
  ON public.prime_contract_payment_applications(contract_id);
CREATE INDEX IF NOT EXISTS idx_pcpa_project_id
  ON public.prime_contract_payment_applications(project_id);
CREATE INDEX IF NOT EXISTS idx_pcpa_status
  ON public.prime_contract_payment_applications(status);

ALTER TABLE public.prime_contract_payment_applications ENABLE ROW LEVEL SECURITY;
