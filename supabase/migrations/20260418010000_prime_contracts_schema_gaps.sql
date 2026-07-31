-- Prime Contracts: Schema gap fixes from AUDIT.md (2026-04-17)
-- Priority order from implementation plan:
--   1. Remove out_for_bid from prime_contract_status_v2 (does not exist in Procore)
--   2. Add erp_status column (prerequisite for ERP Status UI column + filter)
--   3. Add allowed_user_ids column (contract privacy: non-admin user access list)
--   4. Add allow_sov_view column (contract privacy: SOV visibility for non-admin users)

-- ============================================================
-- GUARDRAIL: Verify no rows use out_for_bid before removal
-- ============================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM prime_contracts WHERE status = 'out_for_bid';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot remove out_for_bid enum value: % rows still use this status. Migrate them to draft first.', v_count;
  END IF;
END $$;
-- ============================================================
-- Drop views that depend on prime_contracts.status
-- (required before enum type change)
-- ============================================================
DROP VIEW IF EXISTS prime_contract_financial_summary;
-- ============================================================
-- 1. Remove out_for_bid from prime_contract_status_v2 enum
-- PostgreSQL requires creating a new enum, swapping the column, then dropping the old enum
-- ============================================================
CREATE TYPE prime_contract_status_v3 AS ENUM (
  'draft',
  'out_for_signature',
  'approved',
  'complete',
  'terminated'
);
ALTER TABLE prime_contracts
  ALTER COLUMN status DROP DEFAULT;
ALTER TABLE prime_contracts
  ALTER COLUMN status TYPE prime_contract_status_v3
  USING status::text::prime_contract_status_v3;
ALTER TABLE prime_contracts
  ALTER COLUMN status SET DEFAULT 'draft';
DROP TYPE prime_contract_status_v2;
ALTER TYPE prime_contract_status_v3 RENAME TO prime_contract_status_v2;
-- ============================================================
-- 2. Add erp_status column to prime_contracts
-- ============================================================
ALTER TABLE prime_contracts
  ADD COLUMN IF NOT EXISTS erp_status text NOT NULL DEFAULT 'unsynced'
  CHECK (erp_status IN ('unsynced', 'synced', 'error'));
COMMENT ON COLUMN prime_contracts.erp_status IS 'ERP sync status: unsynced (not yet sent), synced (successfully sent), error (sync failed)';
-- ============================================================
-- 3. Add allowed_user_ids column to prime_contracts
-- ============================================================
ALTER TABLE prime_contracts
  ADD COLUMN IF NOT EXISTS allowed_user_ids uuid[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN prime_contracts.allowed_user_ids IS 'When is_private=true, only these user UUIDs (plus admins) can access this contract';
-- ============================================================
-- 4. Add allow_sov_view column to prime_contracts
-- ============================================================
ALTER TABLE prime_contracts
  ADD COLUMN IF NOT EXISTS allow_sov_view boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN prime_contracts.allow_sov_view IS 'When is_private=true, whether allowed_user_ids can also view the Schedule of Values';
-- ============================================================
-- Index: erp_status for filter queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_prime_contracts_erp_status
  ON prime_contracts (erp_status);
-- ============================================================
-- Recreate prime_contract_financial_summary view
-- (with erp_status added to the output for convenience)
-- ============================================================
CREATE VIEW public.prime_contract_financial_summary AS
  SELECT
    pc.id AS contract_id,
    pc.project_id,
    pc.contract_number,
    pc.title,
    pc.status,
    pc.erp_status,
    pc.client_id,
    pc.executed,
    pc.is_private AS private,
    pc.original_contract_value AS original_contract_amount,
    COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0) AS approved_change_orders,
    COALESCE(sum(co.amount) FILTER (WHERE co.status = 'pending'), 0) AS pending_change_orders,
    COALESCE(sum(co.amount) FILTER (WHERE co.status = 'draft'), 0) AS draft_change_orders,
    pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0) AS revised_contract_amount,
    pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0) + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'pending'), 0) AS pending_revised_contract_amount,
    COALESCE((SELECT sum(pa.amount) FROM prime_contract_payment_applications pa WHERE pa.contract_id = pc.id AND pa.status = 'approved'), 0) AS invoiced_amount,
    COALESCE((SELECT sum(p.amount) FROM prime_contract_payments p WHERE p.contract_id = pc.id), 0) AS payments_received,
    pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0) - COALESCE((SELECT sum(p.amount) FROM prime_contract_payments p WHERE p.contract_id = pc.id), 0) AS remaining_balance,
    CASE
      WHEN (pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0)) = 0 THEN 0
      ELSE round(
        COALESCE((SELECT sum(p.amount) FROM prime_contract_payments p WHERE p.contract_id = pc.id), 0)
        * 100.0
        / (pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0)),
        2
      )
    END AS percent_paid
  FROM prime_contracts pc
  LEFT JOIN contract_change_orders co ON co.contract_id = pc.id
  GROUP BY
    pc.id, pc.project_id, pc.contract_number, pc.title, pc.status, pc.erp_status,
    pc.client_id, pc.executed, pc.is_private, pc.original_contract_value;
