-- Baseline live tables that older feature migrations already reference.
-- These tables existed in the linked database outside the timestamped
-- migration chain, so the baseline keeps static migration replay coherent.

CREATE TABLE IF NOT EXISTS public.prime_contract_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  project_id integer NOT NULL,
  payment_application_id uuid,
  payment_number text,
  amount numeric NOT NULL,
  payment_date date NOT NULL,
  method text,
  reference_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  acumatica_ref_nbr text,
  acumatica_doc_type text,
  acumatica_sync_at timestamptz,
  CONSTRAINT prime_contract_payments_method_check
    CHECK (method = ANY (ARRAY['check'::text, 'wire'::text, 'ach'::text, 'credit_card'::text, 'cash'::text, 'other'::text]))
);

CREATE TABLE IF NOT EXISTS public.procore_tools (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  new_link text,
  procore_link text,
  description text,
  prp_path text,
  tutorials text,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'Not started',
  action_buttons text,
  test_results text,
  procore_screenshot text,
  procore_workflow text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  page_layout text,
  doc_page text,
  overview text
);

CREATE TABLE IF NOT EXISTS public.prime_contract_project_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL UNIQUE,
  co_tier_count smallint NOT NULL DEFAULT 1 CHECK (co_tier_count = ANY (ARRAY[1, 2])),
  allow_standard_users_create_pcco boolean NOT NULL DEFAULT false,
  allow_standard_users_create_pco boolean NOT NULL DEFAULT false,
  sov_always_editable boolean NOT NULL DEFAULT false,
  show_markup_on_co_pdf boolean NOT NULL DEFAULT true,
  show_markup_on_invoice_pdf boolean NOT NULL DEFAULT true,
  default_distribution_prime_contract text,
  default_distribution_pcco text,
  default_distribution_pco text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  enable_completed_work_retainage boolean NOT NULL DEFAULT false,
  enable_stored_materials_retainage boolean NOT NULL DEFAULT false,
  default_retainage_percent numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.budget_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL,
  name varchar NOT NULL,
  snapshot_type text DEFAULT 'manual'
    CHECK (snapshot_type = ANY (ARRAY['manual'::text, 'baseline'::text, 'automatic'::text, 'milestone'::text])),
  description text,
  is_baseline boolean DEFAULT false,
  line_items jsonb NOT NULL,
  grand_totals jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
