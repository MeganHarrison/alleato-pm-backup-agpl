-- Budget security + write-path hardening
-- 1) Tighten budget RLS from "any authenticated" to project membership
-- 2) Add atomic budget-line upsert helper to remove read-then-write races

-- ---------------------------------------------------------------------------
-- Atomic upsert helper for budget line amount adjustments
-- ---------------------------------------------------------------------------
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
  ON CONFLICT ON CONSTRAINT uq_budget_line
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
-- ---------------------------------------------------------------------------
-- Budget table RLS tightening
-- ---------------------------------------------------------------------------
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_mod_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_modification_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_view_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_lines_select ON public.budget_lines;
DROP POLICY IF EXISTS budget_lines_insert ON public.budget_lines;
DROP POLICY IF EXISTS budget_lines_update ON public.budget_lines;
DROP POLICY IF EXISTS budget_lines_delete ON public.budget_lines;
CREATE POLICY budget_lines_select
  ON public.budget_lines
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_lines_insert
  ON public.budget_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_lines_update
  ON public.budget_lines
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_lines_delete
  ON public.budget_lines
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
DROP POLICY IF EXISTS budget_line_history_select_for_authenticated ON public.budget_line_history;
DROP POLICY IF EXISTS budget_line_history_insert_for_authenticated ON public.budget_line_history;
CREATE POLICY budget_line_history_select_for_authenticated
  ON public.budget_line_history
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_line_history_insert_for_authenticated
  ON public.budget_line_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
DROP POLICY IF EXISTS budget_mod_lines_select ON public.budget_mod_lines;
DROP POLICY IF EXISTS budget_mod_lines_insert ON public.budget_mod_lines;
DROP POLICY IF EXISTS budget_mod_lines_update ON public.budget_mod_lines;
DROP POLICY IF EXISTS budget_mod_lines_delete ON public.budget_mod_lines;
CREATE POLICY budget_mod_lines_select
  ON public.budget_mod_lines
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_mod_lines_insert
  ON public.budget_mod_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_mod_lines_update
  ON public.budget_mod_lines
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_mod_lines_delete
  ON public.budget_mod_lines
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
DROP POLICY IF EXISTS budget_modifications_select ON public.budget_modifications;
DROP POLICY IF EXISTS budget_modifications_insert ON public.budget_modifications;
DROP POLICY IF EXISTS budget_modifications_update ON public.budget_modifications;
DROP POLICY IF EXISTS budget_modifications_delete ON public.budget_modifications;
CREATE POLICY budget_modifications_select
  ON public.budget_modifications
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_modifications_insert
  ON public.budget_modifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_modifications_update
  ON public.budget_modifications
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_modifications_delete
  ON public.budget_modifications
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
DROP POLICY IF EXISTS budget_views_select ON public.budget_views;
DROP POLICY IF EXISTS budget_views_insert ON public.budget_views;
DROP POLICY IF EXISTS budget_views_update ON public.budget_views;
DROP POLICY IF EXISTS budget_views_delete ON public.budget_views;
CREATE POLICY budget_views_select
  ON public.budget_views
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id::bigint)
  );
CREATE POLICY budget_views_insert
  ON public.budget_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id::bigint)
  );
CREATE POLICY budget_views_update
  ON public.budget_views
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id::bigint)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id::bigint)
  );
CREATE POLICY budget_views_delete
  ON public.budget_views
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id::bigint)
  );
DROP POLICY IF EXISTS budget_view_columns_select ON public.budget_view_columns;
DROP POLICY IF EXISTS budget_view_columns_insert ON public.budget_view_columns;
DROP POLICY IF EXISTS budget_view_columns_update ON public.budget_view_columns;
DROP POLICY IF EXISTS budget_view_columns_delete ON public.budget_view_columns;
CREATE POLICY budget_view_columns_select
  ON public.budget_view_columns
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_views bv
      WHERE bv.id = budget_view_columns.view_id
        AND public.current_is_project_member(bv.project_id::bigint)
    )
  );
CREATE POLICY budget_view_columns_insert
  ON public.budget_view_columns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_views bv
      WHERE bv.id = budget_view_columns.view_id
        AND public.current_is_project_member(bv.project_id::bigint)
    )
  );
CREATE POLICY budget_view_columns_update
  ON public.budget_view_columns
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_views bv
      WHERE bv.id = budget_view_columns.view_id
        AND public.current_is_project_member(bv.project_id::bigint)
    )
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_views bv
      WHERE bv.id = budget_view_columns.view_id
        AND public.current_is_project_member(bv.project_id::bigint)
    )
  );
CREATE POLICY budget_view_columns_delete
  ON public.budget_view_columns
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_views bv
      WHERE bv.id = budget_view_columns.view_id
        AND public.current_is_project_member(bv.project_id::bigint)
    )
  );
DROP POLICY IF EXISTS budget_modification_lines_select ON public.budget_modification_lines;
DROP POLICY IF EXISTS budget_modification_lines_insert ON public.budget_modification_lines;
DROP POLICY IF EXISTS budget_modification_lines_update ON public.budget_modification_lines;
DROP POLICY IF EXISTS budget_modification_lines_delete ON public.budget_modification_lines;
CREATE POLICY budget_modification_lines_select
  ON public.budget_modification_lines
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_modifications bm
      WHERE bm.id = budget_modification_lines.budget_modification_id
        AND public.current_is_project_member(bm.project_id)
    )
  );
CREATE POLICY budget_modification_lines_insert
  ON public.budget_modification_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_modifications bm
      WHERE bm.id = budget_modification_lines.budget_modification_id
        AND public.current_is_project_member(bm.project_id)
    )
  );
CREATE POLICY budget_modification_lines_update
  ON public.budget_modification_lines
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_modifications bm
      WHERE bm.id = budget_modification_lines.budget_modification_id
        AND public.current_is_project_member(bm.project_id)
    )
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_modifications bm
      WHERE bm.id = budget_modification_lines.budget_modification_id
        AND public.current_is_project_member(bm.project_id)
    )
  );
CREATE POLICY budget_modification_lines_delete
  ON public.budget_modification_lines
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.budget_modifications bm
      WHERE bm.id = budget_modification_lines.budget_modification_id
        AND public.current_is_project_member(bm.project_id)
    )
  );
-- Remove anonymous access on budget financial tables and functions.
REVOKE ALL ON TABLE public.budget_lines FROM anon;
REVOKE ALL ON TABLE public.budget_line_history FROM anon;
REVOKE ALL ON TABLE public.budget_mod_lines FROM anon;
REVOKE ALL ON TABLE public.budget_modifications FROM anon;
REVOKE ALL ON TABLE public.budget_modification_lines FROM anon;
REVOKE ALL ON TABLE public.budget_views FROM anon;
REVOKE ALL ON TABLE public.budget_view_columns FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_budget_rollup(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clone_budget_view(uuid, character varying, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.track_budget_line_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.track_budget_line_changes_before() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_budget_line_from_project_budget_code() FROM anon;
