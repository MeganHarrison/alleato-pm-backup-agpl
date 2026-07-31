-- Estimate → Prime Contract → Budget → Commitments traceability
-- PRP: docs/PRPs/estimate-contract-budget-flow/prp-estimate-contract-budget-flow.md
-- Adds FK columns connecting the four currently-isolated financial domains.

-- 1. prime_contracts: link to source estimate + revision tracking
ALTER TABLE public.prime_contracts
  ADD COLUMN IF NOT EXISTS estimate_id integer
    REFERENCES public.estimates(estimate_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimate_version integer,
  ADD COLUMN IF NOT EXISTS last_synced_from_estimate_at timestamptz;

CREATE INDEX IF NOT EXISTS prime_contracts_estimate_id_idx
  ON public.prime_contracts (estimate_id)
  WHERE estimate_id IS NOT NULL;

COMMENT ON COLUMN public.prime_contracts.estimate_id IS
  'Source estimate this contract was created/seeded from. Nullable: blank contracts have no estimate.';
COMMENT ON COLUMN public.prime_contracts.estimate_version IS
  'estimates.revision at the time of import or last sync. Used to detect when the source estimate has changed.';
COMMENT ON COLUMN public.prime_contracts.last_synced_from_estimate_at IS
  'Timestamp of last create-from / sync-from estimate operation.';

-- 2. budget_lines: link to source estimate
ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS estimate_id integer
    REFERENCES public.estimates(estimate_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS budget_lines_estimate_id_idx
  ON public.budget_lines (estimate_id)
  WHERE estimate_id IS NOT NULL;

COMMENT ON COLUMN public.budget_lines.estimate_id IS
  'Source estimate this budget line was seeded from. Nullable: manually-created lines have no estimate.';

-- 3. subcontracts: link to parent prime contract
ALTER TABLE public.subcontracts
  ADD COLUMN IF NOT EXISTS prime_contract_id uuid
    REFERENCES public.prime_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS subcontracts_prime_contract_id_idx
  ON public.subcontracts (prime_contract_id)
  WHERE prime_contract_id IS NOT NULL;

COMMENT ON COLUMN public.subcontracts.prime_contract_id IS
  'Parent prime contract this subcontract rolls up to. Drives the Commitments tab filter on the contract detail page.';

-- 4. purchase_orders: link to parent prime contract
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS prime_contract_id uuid
    REFERENCES public.prime_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchase_orders_prime_contract_id_idx
  ON public.purchase_orders (prime_contract_id)
  WHERE prime_contract_id IS NOT NULL;

COMMENT ON COLUMN public.purchase_orders.prime_contract_id IS
  'Parent prime contract this PO rolls up to. Drives the Commitments tab filter on the contract detail page.';
