-- Allow Acumatica-imported AP records to exist without a commitment link.
-- Manually-created invoices still require exactly one of subcontract_id / purchase_order_id.
-- Acumatica-sourced records (acumatica_ap_bill_id IS NOT NULL) may have both null
-- when the commitment cannot be inferred from the AP data.

ALTER TABLE public.subcontractor_invoices
  DROP CONSTRAINT IF EXISTS chk_commitment_ref;

ALTER TABLE public.subcontractor_invoices
  ADD CONSTRAINT chk_commitment_ref CHECK (
    -- Acumatica-sourced: may skip the commitment ref
    (acumatica_ap_bill_id IS NOT NULL)
    OR
    -- Manually-created: exactly one commitment ref required
    (subcontract_id IS NOT NULL AND purchase_order_id IS NULL)
    OR
    (subcontract_id IS NULL AND purchase_order_id IS NOT NULL)
  );

-- commitment_payments is entirely sourced from Acumatica AP checks.
-- Checks don't carry a project/commitment ref at the REST API level,
-- so we relax the constraint to allow both null on import.
ALTER TABLE public.commitment_payments
  DROP CONSTRAINT IF EXISTS commitment_payments_one_commitment_ref;

-- AP checks don't carry a project ref — allow null for Acumatica-sourced rows.
ALTER TABLE public.commitment_payments ALTER COLUMN project_id DROP NOT NULL;
