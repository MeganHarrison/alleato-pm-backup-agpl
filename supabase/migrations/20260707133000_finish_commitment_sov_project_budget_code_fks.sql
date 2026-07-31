-- Finish commitment SOV budget-code integrity.
--
-- Prior backfill intentionally skipped rows where legacy text matched both a
-- typed project budget code and a null-cost-type project budget code. Commitment
-- SOV selection uses typed project budget codes, so this pass only considers
-- active project_budget_codes with cost_type_id present. Rows still ambiguous
-- across multiple typed budget codes remain unresolved.

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
    pbc.cost_code_id || '.' || cct.code AS display_budget_code,
    CASE
      WHEN l.budget_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND lower(l.budget_code) = lower(pbc.id::text)
        THEN 1
      WHEN regexp_replace(lower(pbc.cost_code_id || cct.code), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
        THEN 2
      WHEN regexp_replace(lower(pbc.cost_code_id), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
        THEN 3
    END AS priority
  FROM legacy l
  JOIN public.project_budget_codes pbc
    ON pbc.project_id = l.project_id
   AND pbc.is_active IS TRUE
   AND pbc.cost_type_id IS NOT NULL
  JOIN public.cost_code_types cct ON cct.id = pbc.cost_type_id
  WHERE l.budget_code IS NOT NULL
    AND (
      (
        l.budget_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND lower(l.budget_code) = lower(pbc.id::text)
      )
      OR regexp_replace(lower(pbc.cost_code_id || cct.code), '[^a-z0-9]', '', 'g') = l.normalized_budget_code
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
  SELECT
    source_table,
    item_id,
    (array_agg(project_budget_code_id))[1] AS project_budget_code_id,
    (array_agg(display_budget_code))[1] AS display_budget_code
  FROM best_candidates
  GROUP BY source_table, item_id
  HAVING count(*) = 1
),
updated_subcontract_sov_items AS (
  UPDATE public.subcontract_sov_items target
  SET
    project_budget_code_id = safe_matches.project_budget_code_id,
    budget_code = safe_matches.display_budget_code
  FROM safe_matches
  WHERE safe_matches.source_table = 'subcontract_sov_items'
    AND safe_matches.item_id = target.id
    AND target.project_budget_code_id IS NULL
  RETURNING target.id
),
updated_purchase_order_sov_items AS (
  UPDATE public.purchase_order_sov_items target
  SET
    project_budget_code_id = safe_matches.project_budget_code_id,
    budget_code = safe_matches.display_budget_code
  FROM safe_matches
  WHERE safe_matches.source_table = 'purchase_order_sov_items'
    AND safe_matches.item_id = target.id
    AND target.project_budget_code_id IS NULL
  RETURNING target.id
)
SELECT
  (SELECT count(*) FROM updated_subcontract_sov_items) AS subcontract_sov_items_backfilled,
  (SELECT count(*) FROM updated_purchase_order_sov_items) AS purchase_order_sov_items_backfilled;

CREATE OR REPLACE FUNCTION public.validate_commitment_sov_project_budget_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_project_id integer;
  budget_code_project_id integer;
  budget_code_cost_type_id uuid;
BEGIN
  IF NEW.project_budget_code_id IS NULL THEN
    IF NULLIF(BTRIM(COALESCE(NEW.budget_code, '')), '') IS NOT NULL
      OR COALESCE(NEW.amount, 0) <> 0 THEN
      RAISE EXCEPTION '% requires project_budget_code_id for non-empty or nonzero SOV rows',
        TG_TABLE_NAME
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  SELECT pbc.project_id, pbc.cost_type_id
    INTO budget_code_project_id, budget_code_cost_type_id
  FROM public.project_budget_codes pbc
  WHERE pbc.id = NEW.project_budget_code_id
    AND pbc.is_active IS TRUE;

  IF budget_code_project_id IS NULL THEN
    RAISE EXCEPTION 'project_budget_code_id % does not exist or is inactive', NEW.project_budget_code_id
      USING ERRCODE = '23503';
  END IF;

  IF budget_code_cost_type_id IS NULL THEN
    RAISE EXCEPTION 'project_budget_code_id % does not have a cost_type_id and cannot back a commitment SOV row',
      NEW.project_budget_code_id
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'subcontract_sov_items' THEN
    SELECT s.project_id
      INTO parent_project_id
    FROM public.subcontracts s
    WHERE s.id = NEW.subcontract_id;
  ELSIF TG_TABLE_NAME = 'purchase_order_sov_items' THEN
    SELECT po.project_id
      INTO parent_project_id
    FROM public.purchase_orders po
    WHERE po.id = NEW.purchase_order_id;
  ELSE
    RAISE EXCEPTION 'Unsupported table for commitment SOV budget-code validation: %', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;

  IF parent_project_id IS NULL THEN
    RAISE EXCEPTION 'Parent commitment row does not exist for %.project_budget_code_id validation', TG_TABLE_NAME
      USING ERRCODE = '23503';
  END IF;

  IF budget_code_project_id <> parent_project_id THEN
    RAISE EXCEPTION 'project_budget_code project_id % does not match % parent project_id %',
      budget_code_project_id,
      TG_TABLE_NAME,
      parent_project_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_subcontract_sov_project_budget_code
  ON public.subcontract_sov_items;

CREATE TRIGGER validate_subcontract_sov_project_budget_code
  BEFORE INSERT OR UPDATE OF project_budget_code_id, subcontract_id, budget_code, amount
  ON public.subcontract_sov_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commitment_sov_project_budget_code();

DROP TRIGGER IF EXISTS validate_purchase_order_sov_project_budget_code
  ON public.purchase_order_sov_items;

CREATE TRIGGER validate_purchase_order_sov_project_budget_code
  BEFORE INSERT OR UPDATE OF project_budget_code_id, purchase_order_id, budget_code, amount
  ON public.purchase_order_sov_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commitment_sov_project_budget_code();
