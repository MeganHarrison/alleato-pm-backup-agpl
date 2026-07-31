-- Add canonical project budget-code references to commitment SOV rows.
--
-- The legacy budget_code text columns intentionally remain for display and
-- transition compatibility. These new nullable FKs establish the durable
-- relationship first; later migrations can backfill and tighten nullability.

ALTER TABLE public.subcontract_sov_items
  ADD COLUMN IF NOT EXISTS project_budget_code_id uuid;

ALTER TABLE public.purchase_order_sov_items
  ADD COLUMN IF NOT EXISTS project_budget_code_id uuid;

ALTER TABLE public.subcontract_sov_items
  ADD CONSTRAINT subcontract_sov_items_project_budget_code_id_fkey
  FOREIGN KEY (project_budget_code_id)
  REFERENCES public.project_budget_codes(id);

ALTER TABLE public.purchase_order_sov_items
  ADD CONSTRAINT purchase_order_sov_items_project_budget_code_id_fkey
  FOREIGN KEY (project_budget_code_id)
  REFERENCES public.project_budget_codes(id);

CREATE INDEX IF NOT EXISTS idx_subcontract_sov_items_project_budget_code_id
  ON public.subcontract_sov_items(project_budget_code_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_sov_items_project_budget_code_id
  ON public.purchase_order_sov_items(project_budget_code_id);

CREATE OR REPLACE FUNCTION public.validate_commitment_sov_project_budget_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_project_id integer;
  budget_code_project_id integer;
BEGIN
  IF NEW.project_budget_code_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pbc.project_id
    INTO budget_code_project_id
  FROM public.project_budget_codes pbc
  WHERE pbc.id = NEW.project_budget_code_id;

  IF budget_code_project_id IS NULL THEN
    RAISE EXCEPTION 'project_budget_code_id % does not exist', NEW.project_budget_code_id
      USING ERRCODE = '23503';
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
  BEFORE INSERT OR UPDATE OF project_budget_code_id, subcontract_id
  ON public.subcontract_sov_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commitment_sov_project_budget_code();

DROP TRIGGER IF EXISTS validate_purchase_order_sov_project_budget_code
  ON public.purchase_order_sov_items;

CREATE TRIGGER validate_purchase_order_sov_project_budget_code
  BEFORE INSERT OR UPDATE OF project_budget_code_id, purchase_order_id
  ON public.purchase_order_sov_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commitment_sov_project_budget_code();
