-- ============================================================================
-- TIGHTEN PCO RLS POLICIES — Scope by project membership
-- ============================================================================
-- Previously all policies used USING (true), meaning any authenticated user
-- could read/write any PCO regardless of project. This migration replaces
-- those with project-scoped policies using project_directory_memberships
-- joined through users_auth to map auth.uid() → person_id.
--
-- Mapping chain: auth.uid() → users_auth.auth_user_id → person_id
--                project_directory_memberships.person_id + project_id
-- ============================================================================

-- Drop the overly-permissive policies
DROP POLICY IF EXISTS "pco_select" ON public.potential_change_orders;
DROP POLICY IF EXISTS "pco_insert" ON public.potential_change_orders;
DROP POLICY IF EXISTS "pco_update" ON public.potential_change_orders;
DROP POLICY IF EXISTS "pco_versions_select" ON public.pco_versions;
DROP POLICY IF EXISTS "pco_versions_insert" ON public.pco_versions;
DROP POLICY IF EXISTS "pco_ce_select" ON public.pco_change_events;
DROP POLICY IF EXISTS "pco_ce_insert" ON public.pco_change_events;
DROP POLICY IF EXISTS "pco_ce_delete" ON public.pco_change_events;
DROP POLICY IF EXISTS "timeline_select" ON public.timeline_events;
DROP POLICY IF EXISTS "timeline_insert" ON public.timeline_events;
DROP POLICY IF EXISTS "cwc_select" ON public.change_workflow_comments;
-- ============================================================================
-- PCOs: scoped to projects the authenticated user is a member of
-- ============================================================================

CREATE POLICY "pco_select" ON public.potential_change_orders
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  );
CREATE POLICY "pco_insert" ON public.potential_change_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  );
CREATE POLICY "pco_update" ON public.potential_change_orders
  FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  );
-- ============================================================================
-- PCO Versions: scoped through parent PCO → project membership
-- ============================================================================

CREATE POLICY "pco_versions_select" ON public.pco_versions
  FOR SELECT TO authenticated
  USING (
    pco_id IN (
      SELECT pco.id FROM public.potential_change_orders pco
      WHERE pco.project_id IN (
        SELECT pdm.project_id
        FROM public.project_directory_memberships pdm
        JOIN public.users_auth ua ON ua.person_id = pdm.person_id
        WHERE ua.auth_user_id = auth.uid() AND pdm.status = 'active'
      )
    )
  );
CREATE POLICY "pco_versions_insert" ON public.pco_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    pco_id IN (
      SELECT pco.id FROM public.potential_change_orders pco
      WHERE pco.project_id IN (
        SELECT pdm.project_id
        FROM public.project_directory_memberships pdm
        JOIN public.users_auth ua ON ua.person_id = pdm.person_id
        WHERE ua.auth_user_id = auth.uid() AND pdm.status = 'active'
      )
    )
  );
-- ============================================================================
-- PCO Change Events junction: scoped through parent PCO → project membership
-- ============================================================================

CREATE POLICY "pco_ce_select" ON public.pco_change_events
  FOR SELECT TO authenticated
  USING (
    pco_id IN (
      SELECT pco.id FROM public.potential_change_orders pco
      WHERE pco.project_id IN (
        SELECT pdm.project_id
        FROM public.project_directory_memberships pdm
        JOIN public.users_auth ua ON ua.person_id = pdm.person_id
        WHERE ua.auth_user_id = auth.uid() AND pdm.status = 'active'
      )
    )
  );
CREATE POLICY "pco_ce_insert" ON public.pco_change_events
  FOR INSERT TO authenticated
  WITH CHECK (
    pco_id IN (
      SELECT pco.id FROM public.potential_change_orders pco
      WHERE pco.project_id IN (
        SELECT pdm.project_id
        FROM public.project_directory_memberships pdm
        JOIN public.users_auth ua ON ua.person_id = pdm.person_id
        WHERE ua.auth_user_id = auth.uid() AND pdm.status = 'active'
      )
    )
  );
CREATE POLICY "pco_ce_delete" ON public.pco_change_events
  FOR DELETE TO authenticated
  USING (
    pco_id IN (
      SELECT pco.id FROM public.potential_change_orders pco
      WHERE pco.project_id IN (
        SELECT pdm.project_id
        FROM public.project_directory_memberships pdm
        JOIN public.users_auth ua ON ua.person_id = pdm.person_id
        WHERE ua.auth_user_id = auth.uid() AND pdm.status = 'active'
      )
    )
  );
-- ============================================================================
-- Timeline Events: scoped by project membership
-- ============================================================================

CREATE POLICY "timeline_select" ON public.timeline_events
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  );
CREATE POLICY "timeline_insert" ON public.timeline_events
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  );
-- ============================================================================
-- Change Workflow Comments: scoped by project membership
-- ============================================================================

CREATE POLICY "cwc_select" ON public.change_workflow_comments
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  );
