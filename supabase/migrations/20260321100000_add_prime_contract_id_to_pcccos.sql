-- Add prime_contract_id UUID FK to prime_contract_change_orders
-- This links PCCOs to the prime_contracts table (UUID-based).
-- The existing contract_id (integer) references the legacy contracts table which is unused.

ALTER TABLE prime_contract_change_orders
  ADD COLUMN IF NOT EXISTS prime_contract_id UUID REFERENCES prime_contracts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pcco_prime_contract_id
  ON prime_contract_change_orders(prime_contract_id);
