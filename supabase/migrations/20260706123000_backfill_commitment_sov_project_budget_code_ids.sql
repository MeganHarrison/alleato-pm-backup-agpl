-- Backfill canonical budget-code FKs for legacy commitment SOV rows only when
-- the legacy text code resolves to exactly one project-local budget code.
--
-- Ambiguous, unresolved, and missing budget-code rows are intentionally left
-- null for manual repair instead of being guessed.

WITH legacy AS (
  SELECT
    'subcontract_sov_items'::text AS source_table,
    ssi.id AS item_id,
    s.project_id,
    NULLIF(BTRIM(ssi.budget_code), '') AS budget_code,
    regexp_replace(lower(coalesce(ssi.budget_code, '')), '[^a-z0-9]', '', 'g') AS normalized_budget_code
  FROM public.subcontract_sov_items ssi
  JOIN public.subcontracts s ON s.id = ssi.subcontract_id
  WHERE ssi.project_budget_code_id IS NULL

  UNION ALL

  SELECT
    'purchase_order_sov_items'::text AS source_table,
    posi.id AS item_id,
    po.project_id,
    NULLIF(BTRIM(posi.budget_code), '') AS budget_code,
    regexp_replace(lower(coalesce(posi.budget_code, '')), '[^a-z0-9]', '', 'g') AS normalized_budget_code
  FROM public.purchase_order_sov_items posi
  JOIN public.purchase_orders po ON po.id = posi.purchase_order_id
  WHERE posi.project_budget_code_id IS NULL
),
candidates AS (
  SELECT
    l.source_table,
    l.item_id,
    pbc.id AS project_budget_code_id,
    CASE
      WHEN l.budget_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND lower(l.budget_code) = lower(pbc.id::text)
        THEN 1
      WHEN cct.code IS NOT NULL
        AND regexp_replace(lower(pbc.cost_code_id || cct.code), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
        THEN 2
      WHEN regexp_replace(lower(pbc.cost_code_id), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
        THEN 3
    END AS priority
  FROM legacy l
  JOIN public.project_budget_codes pbc ON pbc.project_id = l.project_id
  LEFT JOIN public.cost_code_types cct ON cct.id = pbc.cost_type_id
  WHERE l.budget_code IS NOT NULL
    AND (
      (
        l.budget_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND lower(l.budget_code) = lower(pbc.id::text)
      )
      OR (
        cct.code IS NOT NULL
        AND regexp_replace(lower(pbc.cost_code_id || cct.code), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
      )
      OR regexp_replace(lower(pbc.cost_code_id), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
    )
),
best_priority AS (
  SELECT source_table, item_id, min(priority) AS priority
  FROM candidates
  WHERE priority IS NOT NULL
  GROUP BY source_table, item_id
),
best_candidates AS (
  SELECT c.*
  FROM candidates c
  JOIN best_priority bp
    ON bp.source_table = c.source_table
   AND bp.item_id = c.item_id
   AND bp.priority = c.priority
),
safe_matches AS (
  SELECT source_table, item_id, (array_agg(project_budget_code_id))[1] AS project_budget_code_id
  FROM best_candidates
  GROUP BY source_table, item_id
  HAVING count(*) = 1
),
updated_subcontract_sov_items AS (
  UPDATE public.subcontract_sov_items target
  SET project_budget_code_id = safe_matches.project_budget_code_id
  FROM safe_matches
  WHERE safe_matches.source_table = 'subcontract_sov_items'
    AND safe_matches.item_id = target.id
    AND target.project_budget_code_id IS NULL
  RETURNING target.id
),
updated_purchase_order_sov_items AS (
  UPDATE public.purchase_order_sov_items target
  SET project_budget_code_id = safe_matches.project_budget_code_id
  FROM safe_matches
  WHERE safe_matches.source_table = 'purchase_order_sov_items'
    AND safe_matches.item_id = target.id
    AND target.project_budget_code_id IS NULL
  RETURNING target.id
)
SELECT
  (SELECT count(*) FROM updated_subcontract_sov_items) AS subcontract_sov_items_backfilled,
  (SELECT count(*) FROM updated_purchase_order_sov_items) AS purchase_order_sov_items_backfilled;
