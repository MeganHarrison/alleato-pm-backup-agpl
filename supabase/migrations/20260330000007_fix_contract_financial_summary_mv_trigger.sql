-- Fix: refresh_contract_financial_summary() fails with "relation contract_financial_summary_mv does not exist"
-- This blocks DELETE on prime_contract_change_orders because pcco_line_items CASCADE triggers the refresh.
-- Make the function safe by checking if the MV exists before refreshing.

CREATE OR REPLACE FUNCTION public.refresh_contract_financial_summary() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only refresh if the materialized view exists
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'contract_financial_summary_mv'
  ) THEN
    REFRESH MATERIALIZED VIEW public.contract_financial_summary_mv;
  END IF;
END;
$$;
