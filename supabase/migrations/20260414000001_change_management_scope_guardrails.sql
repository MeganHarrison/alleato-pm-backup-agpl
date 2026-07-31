-- Change Management scope guardrails
-- Purpose:
-- 1. Make commitment change orders project-scopable without ad hoc two-step lookups.
-- 2. Enforce that contract_change_orders reference active commitments, not prime contracts.
-- 3. Add common list/query indexes for prime contracts, commitments, and change events.

-- Clarify table ownership so future work does not reintroduce semantic drift.
COMMENT ON TABLE public.contract_change_orders IS
  'Commitment-side change orders for subcontracts and purchase orders. contract_id resolves through commitments_unified, not prime_contracts.';
COMMENT ON COLUMN public.contract_change_orders.contract_id IS
  'Polymorphic commitment reference. Must resolve to commitments_unified.id via subcontract or purchase_order rows.';
-- Add a denormalized project scope column for fast project-level filtering.
ALTER TABLE public.contract_change_orders
  ADD COLUMN IF NOT EXISTS project_id integer;
COMMENT ON COLUMN public.contract_change_orders.project_id IS
  'Project scope derived from the referenced commitment. Populated automatically by trigger.';
-- Remove the misleading FK if it still exists. This table is not prime-contract-scoped.
ALTER TABLE public.contract_change_orders
  DROP CONSTRAINT IF EXISTS contract_change_orders_contract_id_fkey;
-- Backfill project scope and normalized contract type from the current commitment read model.
UPDATE public.contract_change_orders cco
SET
  project_id = cu.project_id,
  contract_type = CASE cu.commitment_type
    WHEN 'subcontract' THEN 'SUBCONTRACT'
    WHEN 'purchase_order' THEN 'PURCHASE_ORDER'
    ELSE cco.contract_type
  END
FROM public.commitments_unified cu
WHERE cu.id = cco.contract_id
  AND cu.deleted_at IS NULL
  AND (
    cco.project_id IS DISTINCT FROM cu.project_id
    OR cco.contract_type IS DISTINCT FROM CASE cu.commitment_type
      WHEN 'subcontract' THEN 'SUBCONTRACT'
      WHEN 'purchase_order' THEN 'PURCHASE_ORDER'
      ELSE cco.contract_type
    END
  );
-- Keeps project scope and contract type aligned to the referenced commitment.
CREATE OR REPLACE FUNCTION public.sync_commitment_change_order_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_commitment_type text;
  v_project_id integer;
BEGIN
  SELECT cu.commitment_type, cu.project_id
  INTO v_commitment_type, v_project_id
  FROM public.commitments_unified cu
  WHERE cu.id = NEW.contract_id
    AND cu.deleted_at IS NULL
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION
      'contract_change_orders.contract_id % must reference an active commitment',
      NEW.contract_id
      USING ERRCODE = '23503';
  END IF;

  NEW.project_id := v_project_id;
  NEW.contract_type := CASE v_commitment_type
    WHEN 'subcontract' THEN 'SUBCONTRACT'
    WHEN 'purchase_order' THEN 'PURCHASE_ORDER'
    ELSE NEW.contract_type
  END;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_commitment_change_order_scope
  ON public.contract_change_orders;
CREATE TRIGGER trg_sync_commitment_change_order_scope
BEFORE INSERT OR UPDATE OF contract_id
ON public.contract_change_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_commitment_change_order_scope();
-- Enforce project scope on new rows without failing historical rows that still need cleanup.
ALTER TABLE public.contract_change_orders
  DROP CONSTRAINT IF EXISTS contract_change_orders_project_id_required;
ALTER TABLE public.contract_change_orders
  ADD CONSTRAINT contract_change_orders_project_id_required
  CHECK (project_id IS NOT NULL) NOT VALID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contract_change_orders_project_id_fkey'
      AND conrelid = 'public.contract_change_orders'::regclass
  ) THEN
    ALTER TABLE public.contract_change_orders
      ADD CONSTRAINT contract_change_orders_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;
-- Canonical project-scoped read model for commitment change orders.
CREATE OR REPLACE VIEW public.commitment_change_orders_with_scope AS
SELECT
  cco.id,
  cco.project_id,
  cco.contract_id,
  cco.contract_type,
  cco.change_order_number,
  cco.title,
  cco.description,
  cco.amount,
  cco.status,
  cco.requested_by,
  cco.requested_date,
  cco.approved_by,
  cco.approved_date,
  cco.rejection_reason,
  cco.created_at,
  cco.updated_at,
  cco.change_reason,
  cco.designated_reviewer,
  cco.due_date,
  cco.invoiced_date,
  cco.executed,
  cco.field_change,
  cco.paid_in_full,
  cco.schedule_impact,
  cco.location,
  cco.reference,
  cco.revision,
  cco.created_by,
  cco.contract_company,
  cco.is_private,
  cco.parallel_mode,
  cco.prime_change_order_id,
  cco.signed_co_received_date,
  cco.paid_date,
  cco.request_received_from,
  cu.commitment_type,
  cu.contract_number AS commitment_number,
  cu.title AS commitment_title,
  cu.status AS commitment_status
FROM public.contract_change_orders cco
JOIN public.commitments_unified cu
  ON cu.id = cco.contract_id
 AND cu.deleted_at IS NULL;
COMMENT ON VIEW public.commitment_change_orders_with_scope IS
  'Project-scoped commitment CO read model. Use this instead of rebuilding contract_change_orders joins in app code.';
-- Indexes aligned to actual list/filter patterns.
CREATE INDEX IF NOT EXISTS idx_contract_change_orders_project_id
  ON public.contract_change_orders (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contract_change_orders_project_status_requested
  ON public.contract_change_orders (project_id, status, requested_date DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prime_contract_change_orders_project_status_created
  ON public.prime_contract_change_orders (project_id, status, created_at DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prime_contract_change_orders_prime_contract_id
  ON public.prime_contract_change_orders (prime_contract_id)
  WHERE prime_contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_change_events_project_prime_contract_active
  ON public.change_events (project_id, prime_contract_id)
  WHERE deleted_at IS NULL
    AND prime_contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subcontracts_project_active_status
  ON public.subcontracts (project_id, status, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_active_status
  ON public.purchase_orders (project_id, status, created_at DESC)
  WHERE deleted_at IS NULL;
