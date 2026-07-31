-- ============================================================
-- Fix: prime_contract_financial_summary.invoiced_amount was $0
--      for contracts billed through owner (AR) invoices.
--
-- Root cause: invoiced_amount only summed prime_contract_payment_applications
-- (status='approved'). Many prime contracts are billed via `owner_invoices`
-- (AR invoices synced from Acumatica) and have zero payment applications, so
-- the "Invoiced" column and financial sidebar reported $0 even though real
-- invoices existed (e.g. project 876 / PC-8344-0001 had ~$1.37M invoiced).
--
-- The detail-page Invoices tab already unions both sources and de-duplicates
-- owner invoices linked to a payment application (payment_application_id IS
-- NULL). This makes invoiced_amount match that logic:
--   invoiced_amount = approved payment applications
--                   + owner invoices not backed by a payment application
--                     (excluding drafts, which are not yet issued)
--
-- Only the invoiced_amount expression changes; every other column is identical
-- to the previous definition (20260418010000).
-- ============================================================

CREATE OR REPLACE VIEW public.prime_contract_financial_summary AS
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
    -- Invoiced = approved payment applications + owner (AR) invoices not backed
    -- by a payment application. Drafts excluded (not yet issued).
    COALESCE((SELECT sum(pa.amount) FROM prime_contract_payment_applications pa WHERE pa.contract_id = pc.id AND pa.status = 'approved'), 0)
      + COALESCE((SELECT sum(oi.gross_amount) FROM owner_invoices oi WHERE oi.prime_contract_id = pc.id AND oi.payment_application_id IS NULL AND oi.status <> 'draft'), 0) AS invoiced_amount,
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
