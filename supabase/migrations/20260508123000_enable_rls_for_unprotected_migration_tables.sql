-- Enable RLS on migration-created tables that were still relying on the
-- default no-RLS posture. Public tables get compatibility policies so current
-- app behavior is explicit; missing legacy tables are skipped safely.

ALTER TABLE IF EXISTS public.acumatica_ar_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_ar_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_ap_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_ap_bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_risk_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_subcontracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procore_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prime_contract_project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.graph_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eval_scenarios_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eval_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.eval_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.change_event_related_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_tool_write_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.acumatica_outbound_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procore_feature_implementations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.budget_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.search_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.executive_briefing_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bot_debug_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS private.document_processing_queue ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    'acumatica_ar_invoices',
    'acumatica_ar_invoice_lines',
    'acumatica_sync_state',
    'acumatica_ap_bills',
    'acumatica_ap_bill_lines',
    'acumatica_checks',
    'acumatica_project_budgets',
    'project_risk_snapshots',
    'project_vendors',
    'acumatica_change_orders',
    'acumatica_subcontracts',
    'acumatica_purchase_orders',
    'acumatica_payments',
    'procore_tools',
    'prime_contract_project_settings',
    'graph_sync_state',
    'eval_scenarios_raw',
    'eval_test_cases',
    'eval_runs',
    'eval_results',
    'change_event_related_items',
    'ai_tool_write_audits',
    'acumatica_sync_runs',
    'acumatica_outbound_audit_logs',
    'test_suites',
    'test_cases',
    'test_runs',
    'test_results',
    'test_screenshots',
    'procore_feature_implementations',
    'budget_changes',
    'roadmap_items',
    'projects_sync',
    'search_documents',
    'executive_briefing_follow_ups',
    'bot_debug_log'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS compatibility_all_access ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY compatibility_all_access ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
        table_name
      );
    END IF;
  END LOOP;
END
$$;
