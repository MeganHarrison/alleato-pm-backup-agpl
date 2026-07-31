-- budget_snapshots was omitted when RLS policies were added to all other
-- budget tables in 20260414123000_budget_rls_and_atomic_upsert.sql.
-- RLS is enabled on the table but with no policies every INSERT is denied,
-- producing "New Row violates Row-level security policy for table budget_snapshots".

ALTER TABLE public.budget_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_snapshots_select ON public.budget_snapshots;
DROP POLICY IF EXISTS budget_snapshots_insert ON public.budget_snapshots;
DROP POLICY IF EXISTS budget_snapshots_update ON public.budget_snapshots;
DROP POLICY IF EXISTS budget_snapshots_delete ON public.budget_snapshots;
CREATE POLICY budget_snapshots_select
  ON public.budget_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_snapshots_insert
  ON public.budget_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY budget_snapshots_update
  ON public.budget_snapshots
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
CREATE POLICY budget_snapshots_delete
  ON public.budget_snapshots
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- Remove anonymous access to budget snapshots (consistent with other budget tables).
REVOKE ALL ON TABLE public.budget_snapshots FROM anon;
