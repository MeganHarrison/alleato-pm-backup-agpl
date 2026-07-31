-- Guardrail for the Acumatica external_key colon->pipe migration duplication.
--
-- Context: the legacy colon external_key format (e.g. "Bill:Bill:001821") and the
-- current live pipe format (e.g. "Bill|001821") coexisted for the SAME underlying
-- Acumatica document across many transactional tables, double-counting AP bills,
-- change orders, subcontracts, POs, and checks. The live sync
-- (backend/src/services/acumatica_sync.py) only ever writes the pipe format, so
-- colon rows are legacy orphans.
--
-- A one-time remediation (2026-06-17) repointed child FKs from the colon row to the
-- canonical pipe twin and deleted the colon duplicates for: acumatica_ap_bills (3157),
-- acumatica_change_orders (2035), acumatica_subcontracts (359),
-- acumatica_purchase_orders (102), acumatica_checks (224 dup; 2328 legit colon-only kept).
--
-- This view is the post-deploy monitoring guardrail: any row with dup_identities > 0
-- means a logical identity has reappeared in BOTH formats and should be alerted on.
-- Still outstanding (deferred, needs precise identity resolution — ambiguous up to 3
-- rows/identity): acumatica_project_budgets (3078), acumatica_payments (1).

CREATE OR REPLACE VIEW public.acumatica_dual_format_audit
WITH (security_invoker = true) AS
WITH ap AS (SELECT 'acumatica_ap_bills' tbl, document_type||'|'||reference_nbr id, external_key ek FROM acumatica_ap_bills),
co AS (SELECT 'acumatica_change_orders', reference_nbr, external_key FROM acumatica_change_orders),
sc AS (SELECT 'acumatica_subcontracts', subcontract_nbr, external_key FROM acumatica_subcontracts),
po AS (SELECT 'acumatica_purchase_orders', order_nbr, external_key FROM acumatica_purchase_orders),
ck AS (SELECT 'acumatica_checks', document_type||'|'||reference_nbr, external_key FROM acumatica_checks),
ar AS (SELECT 'acumatica_ar_invoices', type||'|'||reference_nbr, external_key FROM acumatica_ar_invoices),
pm AS (SELECT 'acumatica_payments', document_type||'|'||reference_nbr, external_key FROM acumatica_payments),
pb AS (SELECT 'acumatica_project_budgets',
         coalesce(project_code,'')||'|'||coalesce(project_task_id::text,'')||'|'||coalesce(account_group,'')||'|'||coalesce(cost_code,'')||'|'||coalesce(record_type,''),
         external_key FROM acumatica_project_budgets),
u AS (SELECT * FROM ap UNION ALL SELECT * FROM co UNION ALL SELECT * FROM sc UNION ALL SELECT * FROM po
      UNION ALL SELECT * FROM ck UNION ALL SELECT * FROM ar UNION ALL SELECT * FROM pm UNION ALL SELECT * FROM pb)
SELECT tbl,
       count(*) FILTER (WHERE has_colon AND has_pipe) AS dup_identities,
       count(*) FILTER (WHERE has_colon AND NOT has_pipe) AS colon_only,
       count(*) FILTER (WHERE has_pipe AND NOT has_colon) AS pipe_only
FROM (
  SELECT tbl, id,
         bool_or(ek LIKE '%|%') AS has_pipe,
         bool_or(ek NOT LIKE '%|%') AS has_colon
  FROM u GROUP BY tbl, id
) z
GROUP BY tbl ORDER BY dup_identities DESC, tbl;

COMMENT ON VIEW public.acumatica_dual_format_audit IS
  'Monitoring guardrail for Acumatica colon->pipe external_key duplication. dup_identities>0 on any row = a logical document exists in both key formats again (regression). See migration 20260617200000.';
