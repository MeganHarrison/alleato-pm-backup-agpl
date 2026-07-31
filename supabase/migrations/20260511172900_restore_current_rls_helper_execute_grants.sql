-- Restore authenticated EXECUTE grants for SECURITY DEFINER helpers used by RLS.
--
-- These helpers are intentionally not callable by anon/PUBLIC, but authenticated
-- users must be able to execute them because document, commitment, and contact
-- RLS policies evaluate them during normal app queries.

REVOKE ALL ON FUNCTION public.current_person_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_is_app_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_is_project_member(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_can_view_private_commitments(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_has_project_access(bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_person_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_is_app_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_is_project_member(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_can_view_private_commitments(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_has_project_access(bigint) TO authenticated, service_role;

DO $$
DECLARE
  missing_grants text[];
BEGIN
  SELECT array_agg(function_name ORDER BY function_name)
  INTO missing_grants
  FROM (
    VALUES
      ('current_person_id', 'public.current_person_id()'::regprocedure),
      ('current_is_app_admin', 'public.current_is_app_admin()'::regprocedure),
      ('current_is_project_member', 'public.current_is_project_member(bigint)'::regprocedure),
      ('current_can_view_private_commitments', 'public.current_can_view_private_commitments(bigint)'::regprocedure),
      ('current_has_project_access', 'public.current_has_project_access(bigint)'::regprocedure)
  ) AS helper(function_name, function_oid)
  WHERE NOT has_function_privilege('authenticated', function_oid, 'execute');

  IF missing_grants IS NOT NULL THEN
    RAISE EXCEPTION
      'Authenticated role is missing EXECUTE on RLS helper function(s): %',
      array_to_string(missing_grants, ', ');
  END IF;
END $$;
