-- Backfill derivable Prime Contract Change Orders with a parent contract and add a future-only
-- parent presence guardrail.

WITH project_prime_contract_counts AS (
  SELECT
    project_id,
    COUNT(*) FILTER (WHERE id IS NOT NULL) AS prime_contract_count
  FROM public.prime_contracts
  GROUP BY project_id
), derivable_orphans AS (
  SELECT
    pcco.id AS pcco_id,
    pc.id AS resolved_prime_contract_id
  FROM public.prime_contract_change_orders pcco
  JOIN project_prime_contract_counts counts
    ON counts.project_id = pcco.project_id
  JOIN LATERAL (
    SELECT id
    FROM public.prime_contracts
    WHERE project_id = pcco.project_id
    ORDER BY created_at ASC
    LIMIT 1
  ) pc ON TRUE
  WHERE
    pcco.project_id IS NOT NULL
    AND pcco.prime_contract_id IS NULL
    AND pcco.contract_id IS NULL
    AND counts.prime_contract_count = 1
)
UPDATE public.prime_contract_change_orders AS pcco
SET prime_contract_id = derivable_orphans.resolved_prime_contract_id
FROM derivable_orphans
WHERE pcco.id = derivable_orphans.pcco_id;

ALTER TABLE public.prime_contract_change_orders
  ADD CONSTRAINT prime_contract_change_orders_parent_required_check
  CHECK (prime_contract_id IS NOT NULL OR contract_id IS NOT NULL)
  NOT VALID;
