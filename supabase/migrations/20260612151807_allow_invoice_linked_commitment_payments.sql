-- Allow Acumatica payment applications to project into commitment_payments
-- when the imported AP bill maps to a subcontractor invoice but the original
-- subcontract or purchase-order row is not linked locally.

ALTER TABLE public.commitment_payments
  DROP CONSTRAINT IF EXISTS commitment_payments_one_commitment_ref;

ALTER TABLE public.commitment_payments
  ADD CONSTRAINT commitment_payments_not_both_subcontract_and_po
  CHECK (subcontract_id IS NULL OR purchase_order_id IS NULL);
