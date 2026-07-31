-- Keep the refresh_budget_rollup RPC available for budget approval/bootstrap
-- flows even when the legacy mv_budget_rollup materialized view is not
-- installed. Current budget reads compute totals from live tables.
CREATE OR REPLACE FUNCTION public.refresh_budget_rollup(p_project_id bigint DEFAULT NULL::bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.mv_budget_rollup') IS NOT NULL THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_budget_rollup';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_budget_rollup(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_budget_rollup(bigint) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_budget_rollup(bigint) FROM anon;

NOTIFY pgrst, 'reload schema';
