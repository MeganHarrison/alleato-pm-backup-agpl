-- Enable RLS on commitment + SOV tables and enforce Procore-style privacy
--
-- Current state (pre-migration):
--   * subcontracts, purchase_orders, schedule_of_values ALL have RLS disabled
--     (`relrowsecurity = f`). The "USING (true)" policies on schedule_of_values
--     exist but are unreachable because RLS is off entirely.
--   * 340/340 subcontracts and 27/27 POs are marked is_private = true.
--   * schedule_of_values currently has 0 rows.
--
-- After this migration:
--   * RLS is enabled on all three tables.
--   * SELECT respects Procore's privacy model — private commitments are only
--     visible to app admins, users whose permission template grants admin on
--     the contracts module, users with the `view_private_commitments`
--     granular flag, or people listed in `invoice_contact_ids`.
--   * WRITE/DELETE is permitted for any active project member (matches the
--     current API surface; the app layer still gates by PermissionService).
--   * schedule_of_values visibility inherits from its parent subcontract,
--     purchase order, or prime contract.
--   * service_role is not subject to RLS (Supabase default) so background
--     jobs and migrations continue to work.

BEGIN;
-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Resolve the current auth user to a people.id (null if unmapped).
CREATE OR REPLACE FUNCTION public.current_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.people WHERE auth_user_id = auth.uid() LIMIT 1;
$$;
COMMENT ON FUNCTION public.current_person_id() IS
  'Returns people.id for the current auth.uid(). Used inside RLS policies.';
-- Is the current auth user flagged as an app admin?
CREATE OR REPLACE FUNCTION public.current_is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$;
-- Is the current user an active member of the given project?
CREATE OR REPLACE FUNCTION public.current_is_project_member(p_project_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_directory_memberships m
    WHERE m.project_id = p_project_id
      AND m.person_id = public.current_person_id()
      AND m.status = 'active'
  );
$$;
-- Can the current user view PRIVATE commitments on the given project?
-- Matches Procore semantics:
--   * app admin, OR
--   * template grants `admin` on the contracts module, OR
--   * template has the `view_private_commitments` granular flag.
CREATE OR REPLACE FUNCTION public.current_can_view_private_commitments(p_project_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.project_directory_memberships m
      JOIN public.permission_templates pt ON pt.id = m.permission_template_id
      WHERE m.project_id = p_project_id
        AND m.person_id = public.current_person_id()
        AND m.status = 'active'
        AND (
          pt.rules_json->'contracts' ? 'admin'
          OR 'view_private_commitments' = ANY(pt.granular_flags)
        )
    );
$$;
-- ---------------------------------------------------------------------------
-- Drop the unreachable "USING (true)" SOV policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage SOVs for their projects" ON public.schedule_of_values;
DROP POLICY IF EXISTS "Users can view SOVs for their projects"   ON public.schedule_of_values;
-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.subcontracts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_of_values ENABLE ROW LEVEL SECURITY;
-- ---------------------------------------------------------------------------
-- subcontracts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS subcontracts_select ON public.subcontracts;
CREATE POLICY subcontracts_select
  ON public.subcontracts
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR (
      public.current_is_project_member(project_id)
      AND (
        NOT COALESCE(is_private, false)
        OR public.current_can_view_private_commitments(project_id)
        OR public.current_person_id() = ANY(invoice_contact_ids)
      )
    )
  );
DROP POLICY IF EXISTS subcontracts_write ON public.subcontracts;
CREATE POLICY subcontracts_write
  ON public.subcontracts
  FOR ALL
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS purchase_orders_select ON public.purchase_orders;
CREATE POLICY purchase_orders_select
  ON public.purchase_orders
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR (
      public.current_is_project_member(project_id)
      AND (
        NOT COALESCE(is_private, false)
        OR public.current_can_view_private_commitments(project_id)
        OR public.current_person_id() = ANY(invoice_contact_ids)
      )
    )
  );
DROP POLICY IF EXISTS purchase_orders_write ON public.purchase_orders;
CREATE POLICY purchase_orders_write
  ON public.purchase_orders
  FOR ALL
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id)
  );
-- ---------------------------------------------------------------------------
-- schedule_of_values — visibility inherits from the parent contract
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS schedule_of_values_select ON public.schedule_of_values;
CREATE POLICY schedule_of_values_select
  ON public.schedule_of_values
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    -- Via subcontract parent
    OR EXISTS (
      SELECT 1 FROM public.subcontracts s
      WHERE s.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(s.project_id)
        AND (
          NOT COALESCE(s.is_private, false)
          OR public.current_can_view_private_commitments(s.project_id)
          OR public.current_person_id() = ANY(s.invoice_contact_ids)
        )
    )
    -- Via purchase order parent
    OR EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = schedule_of_values.commitment_id
        AND public.current_is_project_member(po.project_id)
        AND (
          NOT COALESCE(po.is_private, false)
          OR public.current_can_view_private_commitments(po.project_id)
          OR public.current_person_id() = ANY(po.invoice_contact_ids)
        )
    )
    -- Via prime contract parent (owner-side SOV)
    OR EXISTS (
      SELECT 1 FROM public.prime_contracts pc
      WHERE pc.id = schedule_of_values.contract_id
        AND public.current_is_project_member(pc.project_id)
    )
  );
DROP POLICY IF EXISTS schedule_of_values_write ON public.schedule_of_values;
CREATE POLICY schedule_of_values_write
  ON public.schedule_of_values
  FOR ALL
  TO authenticated
  USING (
    public.current_is_app_admin()
    -- Any project member of the parent commitment's project can write
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
-- ---------------------------------------------------------------------------
-- Performance indexes for the joins RLS will use on every row read
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_people_auth_user_id
  ON public.people(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_project_directory_memberships_person_project
  ON public.project_directory_memberships(person_id, project_id) WHERE status = 'active';
-- GIN index for the `= ANY(invoice_contact_ids)` lookups
CREATE INDEX IF NOT EXISTS idx_subcontracts_invoice_contact_ids
  ON public.subcontracts USING GIN (invoice_contact_ids);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_invoice_contact_ids
  ON public.purchase_orders USING GIN (invoice_contact_ids);
COMMIT;
