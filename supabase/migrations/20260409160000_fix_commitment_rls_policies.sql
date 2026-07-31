-- Fix commitment RLS — split FOR ALL write policies into specific commands
--
-- Root cause: 20260409150000 created write policies with `FOR ALL`, which
-- includes SELECT. PostgreSQL OR's multiple permissive policies for the same
-- command, so the loose write predicate (project member) was shadowing the
-- strict SELECT predicate (project member AND can-view-private OR invoice
-- contact). Any project member could read every private commitment,
-- defeating the entire privacy gate.
--
-- Fix: split the write policies into separate INSERT / UPDATE / DELETE so
-- only the dedicated SELECT policy governs reads.
--
-- Verified by persona 4a: before this migration, a non-admin Owner/Client
-- member saw all 34 private subcontracts on their project (expected 0).
-- After this migration, they see 0. See
-- verify-output/permissions-overhaul/report.md for full matrix.

BEGIN;
-- ---------------------------------------------------------------------------
-- subcontracts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS subcontracts_write ON public.subcontracts;
CREATE POLICY subcontracts_insert ON public.subcontracts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY subcontracts_update ON public.subcontracts
  FOR UPDATE TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY subcontracts_delete ON public.subcontracts
  FOR DELETE TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS purchase_orders_write ON public.purchase_orders;
CREATE POLICY purchase_orders_insert ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY purchase_orders_update ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
CREATE POLICY purchase_orders_delete ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- ---------------------------------------------------------------------------
-- schedule_of_values — inherit write auth from parent commitment/contract
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS schedule_of_values_write ON public.schedule_of_values;
CREATE POLICY schedule_of_values_insert ON public.schedule_of_values
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.subcontracts s
      WHERE s.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(s.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(po.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.prime_contracts pc
      WHERE pc.id = schedule_of_values.contract_id
        AND public.current_is_project_member(pc.project_id)
    )
  );
CREATE POLICY schedule_of_values_update ON public.schedule_of_values
  FOR UPDATE TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.subcontracts s
      WHERE s.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(s.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(po.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.prime_contracts pc
      WHERE pc.id = schedule_of_values.contract_id
        AND public.current_is_project_member(pc.project_id)
    )
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.subcontracts s
      WHERE s.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(s.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(po.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.prime_contracts pc
      WHERE pc.id = schedule_of_values.contract_id
        AND public.current_is_project_member(pc.project_id)
    )
  );
CREATE POLICY schedule_of_values_delete ON public.schedule_of_values
  FOR DELETE TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.subcontracts s
      WHERE s.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(s.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(po.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.prime_contracts pc
      WHERE pc.id = schedule_of_values.contract_id
        AND public.current_is_project_member(pc.project_id)
    )
  );
COMMIT;
