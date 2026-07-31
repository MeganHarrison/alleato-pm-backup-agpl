-- =============================================================================
-- Prime Contracts — Performance & Security Migration
-- Fixes: missing indexes, RLS scoping, trigram search, revised_value trigger
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Missing indexes on payment tables' contract_id FK columns
--    (query-missing-indexes, schema-foreign-key-indexes)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prime_contract_payment_apps_contract
  ON public.prime_contract_payment_applications (contract_id);
CREATE INDEX IF NOT EXISTS idx_prime_contract_payments_contract
  ON public.prime_contract_payments (contract_id);
-- ---------------------------------------------------------------------------
-- 2. Composite index for the common list filter: project_id + status
--    (query-composite-indexes)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prime_contracts_project_status
  ON public.prime_contracts (project_id, status);
-- ---------------------------------------------------------------------------
-- 3. GIN trigram indexes for ILIKE search on contract_number and title
--    pg_trgm is already enabled (used by idx_chunks_content_trgm).
--    These replace the full-table-scan caused by %search% leading wildcard.
--    (query-index-types — GIN for pattern matching)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prime_contracts_contract_number_trgm
  ON public.prime_contracts USING gin (contract_number public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_prime_contracts_title_trgm
  ON public.prime_contracts USING gin (title public.gin_trgm_ops);
-- ---------------------------------------------------------------------------
-- 4. Proper RLS for prime_contract_payments and prime_contract_payment_applications
--    Replace USING (true) wide-open policies with project-scoped checks.
--    Chain: auth.uid() → users_auth → project_directory_memberships → prime_contracts
--    (security-rls-basics, security-rls-performance)
--
--    Pattern: wrap auth.uid() in a sub-SELECT so it evaluates once per
--    statement, not once per row — critical for RLS performance.
-- ---------------------------------------------------------------------------

-- Enable RLS on payment tables (was missing before)
ALTER TABLE public.prime_contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prime_contract_payment_applications ENABLE ROW LEVEL SECURITY;
-- Drop the existing wide-open policies
DROP POLICY IF EXISTS "Authenticated users can read payments"
  ON public.prime_contract_payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments"
  ON public.prime_contract_payments;
DROP POLICY IF EXISTS "Authenticated users can update payments"
  ON public.prime_contract_payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments"
  ON public.prime_contract_payments;
DROP POLICY IF EXISTS "Authenticated users can read payment applications"
  ON public.prime_contract_payment_applications;
DROP POLICY IF EXISTS "Authenticated users can insert payment applications"
  ON public.prime_contract_payment_applications;
DROP POLICY IF EXISTS "Authenticated users can update payment applications"
  ON public.prime_contract_payment_applications;
DROP POLICY IF EXISTS "Authenticated users can delete payment applications"
  ON public.prime_contract_payment_applications;
-- Helper: returns true if the current user is a member of the project
-- that owns a given prime_contract id.
CREATE OR REPLACE FUNCTION public.user_is_project_member_for_contract(p_contract_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prime_contracts pc
    JOIN public.project_directory_memberships pdm
      ON pdm.project_id = pc.project_id AND pdm.status = 'active'
    JOIN public.users_auth ua
      ON ua.person_id = pdm.person_id
    WHERE pc.id = p_contract_id
      AND ua.auth_user_id = (SELECT auth.uid())
  )
$$;
-- prime_contract_payments — project-scoped policies
CREATE POLICY "Project members can select payments"
  ON public.prime_contract_payments FOR SELECT TO authenticated
  USING (public.user_is_project_member_for_contract(contract_id));
CREATE POLICY "Project members can insert payments"
  ON public.prime_contract_payments FOR INSERT TO authenticated
  WITH CHECK (public.user_is_project_member_for_contract(contract_id));
CREATE POLICY "Project members can update payments"
  ON public.prime_contract_payments FOR UPDATE TO authenticated
  USING (public.user_is_project_member_for_contract(contract_id))
  WITH CHECK (public.user_is_project_member_for_contract(contract_id));
CREATE POLICY "Project members can delete payments"
  ON public.prime_contract_payments FOR DELETE TO authenticated
  USING (public.user_is_project_member_for_contract(contract_id));
-- prime_contract_payment_applications — project-scoped policies
CREATE POLICY "Project members can select payment applications"
  ON public.prime_contract_payment_applications FOR SELECT TO authenticated
  USING (public.user_is_project_member_for_contract(contract_id));
CREATE POLICY "Project members can insert payment applications"
  ON public.prime_contract_payment_applications FOR INSERT TO authenticated
  WITH CHECK (public.user_is_project_member_for_contract(contract_id));
CREATE POLICY "Project members can update payment applications"
  ON public.prime_contract_payment_applications FOR UPDATE TO authenticated
  USING (public.user_is_project_member_for_contract(contract_id))
  WITH CHECK (public.user_is_project_member_for_contract(contract_id));
CREATE POLICY "Project members can delete payment applications"
  ON public.prime_contract_payment_applications FOR DELETE TO authenticated
  USING (public.user_is_project_member_for_contract(contract_id));
-- ---------------------------------------------------------------------------
-- 5. Keep prime_contracts.revised_contract_value in sync with approved COs
--    Eliminates the drift between the stored column and computed values.
--    (schema-constraints — single source of truth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_prime_contract_revised_value()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_contract_id uuid;
BEGIN
  v_contract_id := COALESCE(NEW.contract_id, OLD.contract_id);

  UPDATE public.prime_contracts
  SET revised_contract_value = (
    SELECT original_contract_value + COALESCE(
      SUM(amount) FILTER (WHERE status = 'approved'), 0
    )
    FROM public.contract_change_orders
    WHERE contract_id = v_contract_id
  )
  WHERE id = v_contract_id;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_revised_value ON public.contract_change_orders;
CREATE TRIGGER trg_sync_revised_value
AFTER INSERT OR UPDATE OF amount, status OR DELETE
ON public.contract_change_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_prime_contract_revised_value();
