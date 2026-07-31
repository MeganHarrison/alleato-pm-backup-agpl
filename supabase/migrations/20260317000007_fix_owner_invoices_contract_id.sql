-- Fix owner_invoices to reference prime_contracts (UUID) in addition to legacy contracts (bigint)
-- The invoicing feature was broken because the form fetches prime_contracts (UUID IDs) but
-- the column expected an integer FK to the old contracts table.
--
-- Solution: add prime_contract_id UUID column (FK to prime_contracts), make old contract_id nullable.

ALTER TABLE public.owner_invoices
  ADD COLUMN IF NOT EXISTS prime_contract_id UUID REFERENCES public.prime_contracts(id) ON DELETE CASCADE;
ALTER TABLE public.owner_invoices
  ALTER COLUMN contract_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_owner_invoices_prime_contract
  ON public.owner_invoices USING btree (prime_contract_id);
