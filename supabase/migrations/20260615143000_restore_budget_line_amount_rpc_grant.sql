-- Restore authenticated execute access for the atomic budget-line upsert RPC.
-- This keeps budget line creation behind the API permission check while
-- allowing authenticated Supabase sessions to execute the SECURITY DEFINER
-- helper used by /api/projects/[projectId]/budget.

DO $$
BEGIN
  IF to_regprocedure(
    'public.upsert_budget_line_amount(bigint,text,uuid,uuid,text,numeric,numeric,text,numeric,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Missing expected function public.upsert_budget_line_amount(bigint,text,uuid,uuid,text,numeric,numeric,text,numeric,uuid)';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.upsert_budget_line_amount(
  bigint, text, uuid, uuid, text, numeric, numeric, text, numeric, uuid
) TO authenticated;
