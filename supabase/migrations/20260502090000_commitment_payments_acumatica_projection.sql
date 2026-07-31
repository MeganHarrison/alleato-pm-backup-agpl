-- Store Acumatica AP bill references on subcontractor invoices and expose
-- read-only commitment payment projections sourced from Acumatica checks.

ALTER TABLE public.subcontractor_invoices
  ADD COLUMN IF NOT EXISTS acumatica_ref_nbr TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_doc_type TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acumatica_ap_bill_id BIGINT REFERENCES public.acumatica_ap_bills(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractor_invoices_acumatica_ref
  ON public.subcontractor_invoices (acumatica_doc_type, acumatica_ref_nbr)
  WHERE acumatica_ref_nbr IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_acumatica_ap_bill_id
  ON public.subcontractor_invoices (acumatica_ap_bill_id)
  WHERE acumatica_ap_bill_id IS NOT NULL;

COMMENT ON COLUMN public.subcontractor_invoices.acumatica_ref_nbr IS
  'Acumatica AP Bill reference number returned when the subcontractor invoice is exported.';
COMMENT ON COLUMN public.subcontractor_invoices.acumatica_doc_type IS
  'Acumatica AP document type for the exported subcontractor invoice, typically Bill.';
COMMENT ON COLUMN public.subcontractor_invoices.acumatica_sync_at IS
  'Timestamp when the subcontractor invoice was last exported to or reconciled with Acumatica.';
COMMENT ON COLUMN public.subcontractor_invoices.acumatica_ap_bill_id IS
  'Local mirrored acumatica_ap_bills row matched to this subcontractor invoice.';

CREATE TABLE IF NOT EXISTS public.commitment_payments (
  id BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontract_id UUID REFERENCES public.subcontracts(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  subcontractor_invoice_id BIGINT REFERENCES public.subcontractor_invoices(id) ON DELETE SET NULL,
  acumatica_check_id BIGINT REFERENCES public.acumatica_checks(id) ON DELETE SET NULL,
  acumatica_ap_bill_id BIGINT REFERENCES public.acumatica_ap_bills(id) ON DELETE SET NULL,
  external_key TEXT NOT NULL,
  payment_number TEXT,
  payment_ref TEXT,
  payment_method TEXT,
  payment_date DATE,
  vendor_id TEXT,
  vendor_name TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT,
  source TEXT NOT NULL DEFAULT 'acumatica',
  raw_payload JSONB,
  acumatica_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commitment_payments_one_commitment_ref CHECK (
    (subcontract_id IS NOT NULL AND purchase_order_id IS NULL)
    OR
    (subcontract_id IS NULL AND purchase_order_id IS NOT NULL)
  ),
  CONSTRAINT commitment_payments_external_key_unique UNIQUE (external_key)
);

CREATE INDEX IF NOT EXISTS idx_commitment_payments_project_id
  ON public.commitment_payments (project_id);
CREATE INDEX IF NOT EXISTS idx_commitment_payments_subcontract_id
  ON public.commitment_payments (subcontract_id)
  WHERE subcontract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commitment_payments_purchase_order_id
  ON public.commitment_payments (purchase_order_id)
  WHERE purchase_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commitment_payments_invoice_id
  ON public.commitment_payments (subcontractor_invoice_id)
  WHERE subcontractor_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commitment_payments_acumatica_check_id
  ON public.commitment_payments (acumatica_check_id)
  WHERE acumatica_check_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commitment_payments_payment_date
  ON public.commitment_payments (payment_date DESC);

ALTER TABLE public.commitment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read commitment_payments" ON public.commitment_payments;
CREATE POLICY "Authenticated users can read commitment_payments"
  ON public.commitment_payments FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.commitment_payments IS
  'Read-only app projection of payments issued against commitments, sourced from Acumatica AP checks.';
COMMENT ON COLUMN public.commitment_payments.external_key IS
  'Stable source key, usually Check|<ReferenceNbr>|Bill|<ReferenceNbr> once Acumatica applied-document data is available.';
