-- Allow Prime Contract SOV imports to preserve multiple rows with the same
-- budget code while keeping generic/manual budget upserts deduped.

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS source_contract_line_item_id uuid;

ALTER TABLE public.budget_lines
  DROP CONSTRAINT IF EXISTS budget_lines_source_contract_line_item_id_fkey;

ALTER TABLE public.budget_lines
  ADD CONSTRAINT budget_lines_source_contract_line_item_id_fkey
  FOREIGN KEY (source_contract_line_item_id)
  REFERENCES public.contract_line_items(id)
  ON DELETE SET NULL;

ALTER TABLE public.budget_lines
  DROP CONSTRAINT IF EXISTS uq_budget_line;

CREATE UNIQUE INDEX IF NOT EXISTS uq_budget_line_unsourced
  ON public.budget_lines (project_id, sub_job_key, cost_code_id, cost_type_id)
  WHERE source_contract_line_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_budget_line_source_contract_line_item
  ON public.budget_lines (source_contract_line_item_id)
  WHERE source_contract_line_item_id IS NOT NULL;

COMMENT ON COLUMN public.budget_lines.source_contract_line_item_id IS
  'When populated, this budget line was imported from a specific Prime Contract SOV line item. Allows multiple rows with the same budget code while keeping imports idempotent.';

CREATE OR REPLACE FUNCTION public.upsert_budget_line_amount(
  p_project_id bigint,
  p_cost_code_id text,
  p_cost_type_id uuid,
  p_sub_job_id uuid,
  p_description text,
  p_delta_amount numeric,
  p_quantity numeric,
  p_unit_of_measure text,
  p_unit_cost numeric,
  p_actor uuid
)
RETURNS SETOF public.budget_lines
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.budget_lines;
BEGIN
  INSERT INTO public.budget_lines (
    project_id,
    cost_code_id,
    cost_type_id,
    sub_job_id,
    description,
    original_amount,
    quantity,
    unit_of_measure,
    unit_cost,
    created_by,
    updated_by
  )
  VALUES (
    p_project_id,
    p_cost_code_id,
    p_cost_type_id,
    p_sub_job_id,
    p_description,
    COALESCE(p_delta_amount, 0),
    p_quantity,
    p_unit_of_measure,
    p_unit_cost,
    p_actor,
    p_actor
  )
  ON CONFLICT (project_id, sub_job_key, cost_code_id, cost_type_id)
  WHERE source_contract_line_item_id IS NULL
  DO UPDATE
  SET
    original_amount = public.budget_lines.original_amount + COALESCE(EXCLUDED.original_amount, 0),
    description = COALESCE(EXCLUDED.description, public.budget_lines.description),
    quantity = COALESCE(EXCLUDED.quantity, public.budget_lines.quantity),
    unit_of_measure = COALESCE(EXCLUDED.unit_of_measure, public.budget_lines.unit_of_measure),
    unit_cost = COALESCE(EXCLUDED.unit_cost, public.budget_lines.unit_cost),
    updated_by = p_actor,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN NEXT v_row;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_budget_line_amount(
  bigint, text, uuid, uuid, text, numeric, numeric, text, numeric, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_budget_line_amount(
  bigint, text, uuid, uuid, text, numeric, numeric, text, numeric, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_budget_line_amount(
  bigint, text, uuid, uuid, text, numeric, numeric, text, numeric, uuid
) TO service_role;
