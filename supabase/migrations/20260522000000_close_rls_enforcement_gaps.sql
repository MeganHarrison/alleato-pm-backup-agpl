-- =====================================================================
-- Phase 1.6: Close RLS Enforcement Gaps
-- =====================================================================
-- Closes six privilege-leak holes discovered by the RLS regression
-- harness at tests/rls-regression/. Before this migration, the persona
-- "member-none" (zero project memberships) could read every row on
-- projects, documents, rfis, change_orders, prime_contracts, and
-- owner_invoices.
--
-- Pattern: copy the working policies from `document_metadata` and
-- `insight_cards`:
--   - SECURITY DEFINER helper `current_is_app_admin()` for admin
--     override (reads user_profiles directly).
--   - SECURITY DEFINER helper `current_is_project_member(bigint)` to
--     scope by project membership via the
--     users_auth -> people -> project_directory_memberships chain.
--   - `(select auth.uid())` form is unused here because we delegate
--     entirely to the helpers (which themselves use auth.uid() inside
--     SECURITY DEFINER bodies — single eval per query).
--
-- Documents: this table is slated to be dropped in Phase 7. Until then
-- it is admin-only (no project scoping). Anything reading documents
-- today already requires elevated context; non-admin users will see 0
-- rows. This is an intentional stopgap.
--
-- Owner invoices: this table has no project_id column. It links to
-- prime_contracts via prime_contract_id; project scope is resolved
-- through that join.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. projects
-- ---------------------------------------------------------------------
-- Pre-state: SELECT using (true) — every authenticated user sees all
-- 111 projects. Insert/update equally wide.
-- Post-state: scope by direct membership; admin sees everything.
-- ---------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_authenticated"   ON public.projects;
DROP POLICY IF EXISTS "projects_update_budget_lock_authenticated" ON public.projects;
DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_insert ON public.projects;
DROP POLICY IF EXISTS projects_update ON public.projects;
DROP POLICY IF EXISTS projects_delete ON public.projects;

CREATE POLICY projects_select ON public.projects
  FOR SELECT TO authenticated
  USING (
    current_is_app_admin()
    OR current_is_project_member(id)
  );

CREATE POLICY projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK ( current_is_app_admin() );

CREATE POLICY projects_update ON public.projects
  FOR UPDATE TO authenticated
  USING (
    current_is_app_admin()
    OR current_is_project_member(id)
  )
  WITH CHECK (
    current_is_app_admin()
    OR current_is_project_member(id)
  );

CREATE POLICY projects_delete ON public.projects
  FOR DELETE TO authenticated
  USING ( current_is_app_admin() );

-- ---------------------------------------------------------------------
-- 2. documents (Phase 7 stopgap — admin-only)
-- ---------------------------------------------------------------------
-- Pre-state: SELECT using (true) for `public` role — fully open even
-- to anon. ALL ops for authenticated wide-open.
-- Post-state: admin-only until Phase 7 drops the table.
-- Service role retains full access via existing `service_role` policy.
-- ---------------------------------------------------------------------

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users"        ON public.documents;
DROP POLICY IF EXISTS "Enable insert for authenticated users"   ON public.documents;
DROP POLICY IF EXISTS "Enable update for authenticated users"   ON public.documents;
DROP POLICY IF EXISTS "Enable delete for authenticated users"   ON public.documents;
DROP POLICY IF EXISTS documents_admin_select ON public.documents;
DROP POLICY IF EXISTS documents_admin_insert ON public.documents;
DROP POLICY IF EXISTS documents_admin_update ON public.documents;
DROP POLICY IF EXISTS documents_admin_delete ON public.documents;

CREATE POLICY documents_admin_select ON public.documents
  FOR SELECT TO authenticated
  USING ( current_is_app_admin() );

CREATE POLICY documents_admin_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK ( current_is_app_admin() );

CREATE POLICY documents_admin_update ON public.documents
  FOR UPDATE TO authenticated
  USING ( current_is_app_admin() )
  WITH CHECK ( current_is_app_admin() );

CREATE POLICY documents_admin_delete ON public.documents
  FOR DELETE TO authenticated
  USING ( current_is_app_admin() );

-- "Service role has full access" policy on documents is retained — service
-- role bypasses RLS at the role level anyway, but the explicit policy
-- documents intent.

-- ---------------------------------------------------------------------
-- 3. rfis
-- ---------------------------------------------------------------------
-- Pre-state: RLS DISABLED. Fully open.
-- Post-state: project-scoped via rfis.project_id (bigint).
-- ---------------------------------------------------------------------

ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfis_select ON public.rfis;
DROP POLICY IF EXISTS rfis_insert ON public.rfis;
DROP POLICY IF EXISTS rfis_update ON public.rfis;
DROP POLICY IF EXISTS rfis_delete ON public.rfis;

CREATE POLICY rfis_select ON public.rfis
  FOR SELECT TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  );

CREATE POLICY rfis_insert ON public.rfis
  FOR INSERT TO authenticated
  WITH CHECK (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  );

CREATE POLICY rfis_update ON public.rfis
  FOR UPDATE TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  )
  WITH CHECK (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  );

CREATE POLICY rfis_delete ON public.rfis
  FOR DELETE TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  );

-- ---------------------------------------------------------------------
-- 4. change_orders
-- ---------------------------------------------------------------------
-- Pre-state: single policy `service_all` ALL using(true) for `public`
-- role — wide open even to anonymous.
-- Post-state: project-scoped. change_orders.project_id is INTEGER; cast
-- to bigint for the helper.
-- ---------------------------------------------------------------------

ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_all       ON public.change_orders;
DROP POLICY IF EXISTS change_orders_select ON public.change_orders;
DROP POLICY IF EXISTS change_orders_insert ON public.change_orders;
DROP POLICY IF EXISTS change_orders_update ON public.change_orders;
DROP POLICY IF EXISTS change_orders_delete ON public.change_orders;

CREATE POLICY change_orders_select ON public.change_orders
  FOR SELECT TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id::bigint))
  );

CREATE POLICY change_orders_insert ON public.change_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id::bigint))
  );

CREATE POLICY change_orders_update ON public.change_orders
  FOR UPDATE TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id::bigint))
  )
  WITH CHECK (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id::bigint))
  );

CREATE POLICY change_orders_delete ON public.change_orders
  FOR DELETE TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id::bigint))
  );

-- ---------------------------------------------------------------------
-- 5. prime_contracts
-- ---------------------------------------------------------------------
-- Pre-state: RLS DISABLED. Fully open.
-- Post-state: project-scoped via prime_contracts.project_id (bigint).
-- ---------------------------------------------------------------------

ALTER TABLE public.prime_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prime_contracts_select ON public.prime_contracts;
DROP POLICY IF EXISTS prime_contracts_insert ON public.prime_contracts;
DROP POLICY IF EXISTS prime_contracts_update ON public.prime_contracts;
DROP POLICY IF EXISTS prime_contracts_delete ON public.prime_contracts;

CREATE POLICY prime_contracts_select ON public.prime_contracts
  FOR SELECT TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  );

CREATE POLICY prime_contracts_insert ON public.prime_contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  );

CREATE POLICY prime_contracts_update ON public.prime_contracts
  FOR UPDATE TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  )
  WITH CHECK (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  );

CREATE POLICY prime_contracts_delete ON public.prime_contracts
  FOR DELETE TO authenticated
  USING (
    current_is_app_admin()
    OR (project_id IS NOT NULL AND current_is_project_member(project_id))
  );

-- ---------------------------------------------------------------------
-- 6. owner_invoices
-- ---------------------------------------------------------------------
-- Pre-state: SELECT/INSERT/UPDATE/DELETE all `using (auth.uid() IS NOT
-- NULL)` — any logged-in user reads/writes everything.
-- Post-state: project-scoped via prime_contract_id -> prime_contracts.
-- The `current_is_project_member()` helper is SECURITY DEFINER so the
-- join through prime_contracts is allowed regardless of the caller's
-- RLS on prime_contracts.
-- ---------------------------------------------------------------------

ALTER TABLE public.owner_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_invoices_select ON public.owner_invoices;
DROP POLICY IF EXISTS owner_invoices_insert ON public.owner_invoices;
DROP POLICY IF EXISTS owner_invoices_update ON public.owner_invoices;
DROP POLICY IF EXISTS owner_invoices_delete ON public.owner_invoices;

CREATE POLICY owner_invoices_select ON public.owner_invoices
  FOR SELECT TO authenticated
  USING (
    current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.prime_contracts pc
      WHERE pc.id = owner_invoices.prime_contract_id
        AND pc.project_id IS NOT NULL
        AND current_is_project_member(pc.project_id)
    )
  );

CREATE POLICY owner_invoices_insert ON public.owner_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.prime_contracts pc
      WHERE pc.id = owner_invoices.prime_contract_id
        AND pc.project_id IS NOT NULL
        AND current_is_project_member(pc.project_id)
    )
  );

CREATE POLICY owner_invoices_update ON public.owner_invoices
  FOR UPDATE TO authenticated
  USING (
    current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.prime_contracts pc
      WHERE pc.id = owner_invoices.prime_contract_id
        AND pc.project_id IS NOT NULL
        AND current_is_project_member(pc.project_id)
    )
  )
  WITH CHECK (
    current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.prime_contracts pc
      WHERE pc.id = owner_invoices.prime_contract_id
        AND pc.project_id IS NOT NULL
        AND current_is_project_member(pc.project_id)
    )
  );

CREATE POLICY owner_invoices_delete ON public.owner_invoices
  FOR DELETE TO authenticated
  USING (
    current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.prime_contracts pc
      WHERE pc.id = owner_invoices.prime_contract_id
        AND pc.project_id IS NOT NULL
        AND current_is_project_member(pc.project_id)
    )
  );

COMMIT;
