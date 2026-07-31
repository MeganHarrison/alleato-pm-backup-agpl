-- Link owner_invoices to prime_contract_payment_applications for canonical retainage.
-- When an owner invoice is linked to a payment application, retainage data
-- (retention_amount, net_amount, percent_complete) comes from the payment application's
-- authoritative line-item calculations instead of being computed independently.
ALTER TABLE owner_invoices
  ADD COLUMN IF NOT EXISTS payment_application_id uuid
    REFERENCES prime_contract_payment_applications(id)
    ON DELETE SET NULL;
COMMENT ON COLUMN owner_invoices.payment_application_id IS
  'FK to prime_contract_payment_applications. When set, the owner invoice retainage '
  'figures (retention_amount, net_amount, percent_complete) are derived from the linked '
  'payment application line items. This aligns both billing surfaces to the same '
  'canonical retainage engine.';
CREATE INDEX IF NOT EXISTS owner_invoices_payment_application_id_idx
  ON owner_invoices (payment_application_id)
  WHERE payment_application_id IS NOT NULL;
