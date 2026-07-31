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
        THEN 'exact_uuid'
      WHEN cct.code IS NOT NULL
        AND regexp_replace(lower(pbc.cost_code_id || cct.code), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
        THEN 'cost_code_type'
      WHEN regexp_replace(lower(pbc.cost_code_id), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
        THEN 'cost_code_only'
    END AS match_method,
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
classified AS (
  SELECT
    l.source_table,
    l.item_id,
    CASE
      WHEN l.budget_code IS NULL THEN 'missing_budget_code'
      WHEN count(bc.project_budget_code_id) = 1 THEN 'safe_match'
      WHEN count(bc.project_budget_code_id) > 1 THEN 'ambiguous'
      ELSE 'unresolved'
    END AS classification,
    coalesce(max(bc.match_method), 'none') AS match_method
  FROM legacy l
  LEFT JOIN best_candidates bc
    ON bc.source_table = l.source_table
   AND bc.item_id = l.item_id
  GROUP BY l.source_table, l.item_id, l.budget_code
)
SELECT source_table, classification, match_method, count(*) AS item_count
FROM classified
GROUP BY source_table, classification, match_method
ORDER BY source_table, classification, match_method;
