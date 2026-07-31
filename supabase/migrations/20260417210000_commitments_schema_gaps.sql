-- Commitments schema gap fixes identified in prp-audit 2026-04-17
-- Ref: PRPs/commitments/AUDIT.md

-- ============================================================
-- Drop dependent views before altering subcontracts date column types.
-- Dependency chain:
--   commitment_change_orders_with_scope → commitments_unified → subcontracts
--   subcontracts_with_totals → subcontracts
-- ============================================================

DROP VIEW IF EXISTS public.commitment_change_orders_with_scope CASCADE;
DROP VIEW IF EXISTS public.commitments_unified CASCADE;
DROP VIEW IF EXISTS public.subcontracts_with_totals CASCADE;
-- ============================================================
-- 1. Fix subcontracts date columns: TEXT → DATE (no-op if already date)
--    Regex guard converts malformed values to NULL rather than failing.
-- ============================================================

DO $$
DECLARE
  col_type text;
BEGIN
  FOR col_type IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subcontracts'
      AND column_name IN ('start_date','estimated_completion_date','actual_completion_date','contract_date','signed_contract_received_date','issued_on_date')
      AND data_type = 'text'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.subcontracts ALTER COLUMN %I TYPE date USING CASE WHEN %I IS NOT NULL AND %I ~ ''^\\d{4}-\\d{2}-\\d{2}'' THEN %I::date ELSE NULL END',
      col_type, col_type, col_type, col_type
    );
  END LOOP;
END $$;
-- ============================================================
-- Recreate subcontracts_with_totals (unchanged logic)
-- ============================================================

CREATE OR REPLACE VIEW public.subcontracts_with_totals AS
 SELECT s.id,
    s.contract_number,
    s.contract_company_id,
    s.title,
    s.status,
    s.executed,
    s.default_retainage_percent,
    s.description,
    s.inclusions,
    s.exclusions,
    s.start_date,
    s.estimated_completion_date,
    s.actual_completion_date,
    s.contract_date,
    s.signed_contract_received_date,
    s.issued_on_date,
    s.is_private,
    s.non_admin_user_ids,
    s.allow_non_admin_view_sov_items,
    s.invoice_contact_ids,
    s.project_id,
    s.created_by,
    s.created_at,
    s.updated_at,
    COALESCE(sov_totals.total_amount, 0::numeric) AS total_sov_amount,
    COALESCE(sov_totals.total_billed, 0::numeric) AS total_billed_to_date,
    COALESCE(sov_totals.total_amount, 0::numeric) - COALESCE(sov_totals.total_billed, 0::numeric) AS total_amount_remaining,
    COALESCE(sov_totals.line_item_count, 0::bigint) AS sov_line_count,
    COALESCE(att_count.count, 0::bigint) AS attachment_count,
    c.name AS company_name,
    c.type AS company_type
   FROM subcontracts s
     LEFT JOIN ( SELECT subcontract_sov_items.subcontract_id,
            sum(subcontract_sov_items.amount) AS total_amount,
            sum(subcontract_sov_items.billed_to_date) AS total_billed,
            count(*) AS line_item_count
           FROM subcontract_sov_items
          GROUP BY subcontract_sov_items.subcontract_id) sov_totals ON s.id = sov_totals.subcontract_id
     LEFT JOIN ( SELECT subcontract_attachments.subcontract_id,
            count(*) AS count
           FROM subcontract_attachments
          GROUP BY subcontract_attachments.subcontract_id) att_count ON s.id = att_count.subcontract_id
     LEFT JOIN companies c ON s.contract_company_id = c.id;
-- ============================================================
-- Recreate commitments_unified — both SC and PO sides now use date
-- (SC cols were text before; removed ::text casts on PO side for UNION
--  type consistency now that SC cols are also date)
-- ============================================================

CREATE OR REPLACE VIEW public.commitments_unified AS
 SELECT 'subcontract'::text AS commitment_type,
    subcontracts.id,
    subcontracts.project_id,
    subcontracts.contract_number,
    subcontracts.title,
    subcontracts.description,
    subcontracts.status,
    subcontracts.executed,
    subcontracts.contract_date,
    subcontracts.contract_company_id,
    subcontracts.created_at,
    subcontracts.updated_at,
    subcontracts.deleted_at,
    subcontracts.created_by,
    subcontracts.is_private,
    subcontracts.allow_non_admin_view_sov_items,
    subcontracts.non_admin_user_ids,
    subcontracts.invoice_contact_ids,
    subcontracts.issued_on_date,
    subcontracts.default_retainage_percent
   FROM subcontracts
UNION ALL
 SELECT 'purchase_order'::text AS commitment_type,
    purchase_orders.id,
    purchase_orders.project_id,
    purchase_orders.contract_number,
    purchase_orders.title,
    purchase_orders.description,
    purchase_orders.status,
    purchase_orders.executed,
    purchase_orders.contract_date,
    purchase_orders.contract_company_id,
    purchase_orders.created_at,
    purchase_orders.updated_at,
    purchase_orders.deleted_at,
    purchase_orders.created_by,
    purchase_orders.is_private,
    purchase_orders.allow_non_admin_view_sov_items,
    purchase_orders.non_admin_user_ids,
    purchase_orders.invoice_contact_ids,
    purchase_orders.issued_on_date,
    purchase_orders.default_retainage_percent
   FROM purchase_orders;
-- ============================================================
-- Recreate commitment_change_orders_with_scope (unchanged logic)
-- ============================================================

CREATE OR REPLACE VIEW public.commitment_change_orders_with_scope AS
 SELECT cco.id,
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
   FROM contract_change_orders cco
     JOIN commitments_unified cu ON cu.id = cco.contract_id AND cu.deleted_at IS NULL;
-- ============================================================
-- 2. Add missing columns to purchase_orders
--    (inclusions/exclusions and date fields that subcontracts have)
-- ============================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS inclusions text,
  ADD COLUMN IF NOT EXISTS exclusions text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS estimated_completion_date date,
  ADD COLUMN IF NOT EXISTS actual_completion_date date;
-- ============================================================
-- 3. Add missing columns to subcontract_sov_items
--    (unit/qty accounting parity with purchase_order_sov_items,
--     plus line-level retainage override)
-- ============================================================

ALTER TABLE public.subcontract_sov_items
  ADD COLUMN IF NOT EXISTS quantity numeric(15,4),
  ADD COLUMN IF NOT EXISTS unit_cost numeric(15,2),
  ADD COLUMN IF NOT EXISTS unit_of_measure text,
  ADD COLUMN IF NOT EXISTS retainage_percent numeric(5,2)
    CONSTRAINT subcontract_sov_items_retainage_check
    CHECK (retainage_percent IS NULL OR (retainage_percent >= 0 AND retainage_percent <= 100));
-- ============================================================
-- 4. Create purchase_order_attachments table
--    (mirrors subcontract_attachments)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchase_order_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text,
  storage_path text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_order_attachments_pkey PRIMARY KEY (id)
);
ALTER TABLE public.purchase_order_attachments OWNER TO postgres;
COMMENT ON TABLE public.purchase_order_attachments IS 'File attachments for purchase orders';
CREATE INDEX IF NOT EXISTS idx_purchase_order_attachments_po_id
  ON public.purchase_order_attachments USING btree (purchase_order_id);
ALTER TABLE public.purchase_order_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_order_attachments_select" ON public.purchase_order_attachments;
CREATE POLICY "purchase_order_attachments_select"
  ON public.purchase_order_attachments FOR SELECT USING (true);
DROP POLICY IF EXISTS "purchase_order_attachments_insert" ON public.purchase_order_attachments;
CREATE POLICY "purchase_order_attachments_insert"
  ON public.purchase_order_attachments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "purchase_order_attachments_delete" ON public.purchase_order_attachments;
CREATE POLICY "purchase_order_attachments_delete"
  ON public.purchase_order_attachments FOR DELETE USING (true);
