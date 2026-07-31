-- Alleato Brain parallel-run access.
--
-- Legacy fake-project rows remain project-scoped until the owner-approved
-- Phase 2 stamps are applied. During that interval, authenticated company staff
-- must be able to read mapped non-restricted branches without inheriting fake
-- project membership. Restricted mappings remain membership/admin only, even
-- when an older permissive project policy would otherwise allow the row.

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_business_area_scope(
  p_business_area_id bigint,
  p_project_id bigint
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_business_area_id,
    (
      SELECT mapping.business_area_id
      FROM public.business_area_project_map AS mapping
      WHERE mapping.project_id = p_project_id
      LIMIT 1
    )
  )
$$;

COMMENT ON FUNCTION public.resolve_business_area_scope(bigint, bigint) IS
  'Resolves direct Business Area scope first, then the permanent legacy-project mapping used during the Alleato Brain parallel run.';

REVOKE ALL
  ON FUNCTION public.resolve_business_area_scope(bigint, bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.resolve_business_area_scope(bigint, bigint)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.business_area_scope_is_consistent(
  p_business_area_id bigint,
  p_project_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_business_area_id IS NULL
    OR p_project_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_area_project_map AS mapping
      WHERE mapping.project_id = p_project_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.business_area_project_map AS mapping
      WHERE mapping.project_id = p_project_id
        AND mapping.business_area_id = p_business_area_id
    )
$$;

COMMENT ON FUNCTION public.business_area_scope_is_consistent(bigint, bigint) IS
  'Rejects records whose direct Business Area disagrees with the permanent project mapping.';

REVOKE ALL
  ON FUNCTION public.business_area_scope_is_consistent(bigint, bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.business_area_scope_is_consistent(bigint, bigint)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_is_active_internal_employee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.people AS person
    WHERE person.id = public.current_person_id()
      AND person.status = 'active'
      AND person.person_type IN ('employee', 'user')
  )
$$;

COMMENT ON FUNCTION public.current_is_active_internal_employee() IS
  'Returns true only for an authenticated identity linked to an active internal employee/person record.';

REVOKE ALL
  ON FUNCTION public.current_is_active_internal_employee()
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.current_is_active_internal_employee()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_can_access_business_area_scopes(
  p_business_area_id bigint,
  p_project_id bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM (
      SELECT p_business_area_id AS business_area_id
      WHERE p_business_area_id IS NOT NULL
      UNION
      SELECT mapping.business_area_id
      FROM public.business_area_project_map AS mapping
      WHERE mapping.project_id = p_project_id
    ) AS scope
    JOIN public.business_areas AS area
      ON area.id = scope.business_area_id
    WHERE area.is_restricted = true
      AND NOT public.current_is_app_admin()
      AND NOT public.current_is_business_area_member(area.id)
  )
$$;

COMMENT ON FUNCTION public.current_can_access_business_area_scopes(bigint, bigint) IS
  'Checks every direct and mapped Business Area scope so a permissive project policy cannot bypass a restricted branch.';

REVOKE ALL
  ON FUNCTION public.current_can_access_business_area_scopes(bigint, bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.current_can_access_business_area_scopes(bigint, bigint)
  TO authenticated, service_role;

DROP POLICY IF EXISTS meetings_business_area_parallel_select
  ON public.meetings;
CREATE POLICY meetings_business_area_parallel_select
  ON public.meetings
  FOR SELECT
  TO authenticated
  USING (
    business_area_id IS NULL
    AND public.resolve_business_area_scope(NULL, project_id::bigint) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id =
        public.resolve_business_area_scope(NULL, project_id::bigint)
        AND (
          (
            area.is_restricted = false
            AND public.current_is_active_internal_employee()
          )
          OR public.current_is_app_admin()
          OR public.current_is_business_area_member(area.id)
        )
    )
  );

DROP POLICY IF EXISTS meetings_restricted_business_area_guard
  ON public.meetings;
CREATE POLICY meetings_restricted_business_area_guard
  ON public.meetings
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.business_area_scope_is_consistent(
      business_area_id,
      project_id::bigint
    )
    AND public.current_can_access_business_area_scopes(
      business_area_id,
      project_id::bigint
    )
  )
  WITH CHECK (
    public.business_area_scope_is_consistent(
      business_area_id,
      project_id::bigint
    )
    AND public.current_can_access_business_area_scopes(
      business_area_id,
      project_id::bigint
    )
  );

DROP POLICY IF EXISTS tasks_business_area_parallel_select
  ON public.tasks;
CREATE POLICY tasks_business_area_parallel_select
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    business_area_id IS NULL
    AND public.resolve_business_area_scope(NULL, project_id) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id = public.resolve_business_area_scope(NULL, project_id)
        AND (
          (
            area.is_restricted = false
            AND public.current_is_active_internal_employee()
          )
          OR public.current_is_app_admin()
          OR public.current_is_business_area_member(area.id)
        )
    )
  );

DROP POLICY IF EXISTS tasks_restricted_business_area_guard
  ON public.tasks;
CREATE POLICY tasks_restricted_business_area_guard
  ON public.tasks
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.business_area_scope_is_consistent(
      business_area_id,
      project_id
    )
    AND public.current_can_access_business_area_scopes(
      business_area_id,
      project_id
    )
  )
  WITH CHECK (
    public.business_area_scope_is_consistent(
      business_area_id,
      project_id
    )
    AND public.current_can_access_business_area_scopes(
      business_area_id,
      project_id
    )
  );

COMMIT;
