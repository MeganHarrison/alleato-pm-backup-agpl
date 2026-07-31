-- Keep the restricted Business Area authorization helper out of anonymous RPC.
--
-- The helper is SECURITY DEFINER because RLS policies must resolve membership
-- without recursively evaluating membership-table policies. Anonymous callers
-- do not have an authenticated person identity and must never invoke it.

BEGIN;

REVOKE ALL
  ON FUNCTION public.current_is_business_area_member(bigint)
  FROM PUBLIC, anon;

GRANT EXECUTE
  ON FUNCTION public.current_is_business_area_member(bigint)
  TO authenticated, service_role;

COMMIT;
