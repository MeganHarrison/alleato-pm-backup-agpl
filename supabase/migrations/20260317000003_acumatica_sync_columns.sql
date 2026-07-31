-- Add Acumatica linkage columns to domain tables for sync upsert support
-- These columns enable the Stage → Transform → Upsert pattern

-- owner_invoices: AR Invoices from Acumatica
ALTER TABLE owner_invoices
  ADD COLUMN IF NOT EXISTS acumatica_ref_nbr TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_doc_type TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_sync_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_invoices_acumatica_ref_nbr
  ON owner_invoices (acumatica_ref_nbr)
  WHERE acumatica_ref_nbr IS NOT NULL;
-- owner_invoice_line_items: AR Invoice lines
ALTER TABLE owner_invoice_line_items
  ADD COLUMN IF NOT EXISTS acumatica_line_nbr INTEGER;
-- prime_contract_payments: AR Payments from Acumatica
ALTER TABLE prime_contract_payments
  ADD COLUMN IF NOT EXISTS acumatica_ref_nbr TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_doc_type TEXT,
  ADD COLUMN IF NOT EXISTS acumatica_sync_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prime_contract_payments_acumatica_ref_nbr
  ON prime_contract_payments (acumatica_ref_nbr)
  WHERE acumatica_ref_nbr IS NOT NULL;
-- change_orders (general/commitment COs): already have acumatica_external_key on
-- prime_contract_change_orders and contract_change_orders from migration 20260316000006.
-- Add to the general change_orders table too.
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS acumatica_external_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_change_orders_acumatica_external_key
  ON change_orders (acumatica_external_key)
  WHERE acumatica_external_key IS NOT NULL;
