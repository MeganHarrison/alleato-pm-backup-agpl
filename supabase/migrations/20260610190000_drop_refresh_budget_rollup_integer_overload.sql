-- Remove the stale integer overload so PostgREST can resolve
-- refresh_budget_rollup(p_project_id => <number>) unambiguously.
DROP FUNCTION IF EXISTS public.refresh_budget_rollup(integer);

GRANT EXECUTE ON FUNCTION public.refresh_budget_rollup(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_budget_rollup(bigint) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_budget_rollup(bigint) FROM anon;

NOTIFY pgrst, 'reload schema';
