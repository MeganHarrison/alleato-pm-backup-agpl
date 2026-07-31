-- =============================================================================
-- SOFT-DROP: Tier A unused tables (reversible rename to zz_deprecated_*)
-- =============================================================================
-- Generated from docs/architecture/TABLE-CLEANUP-CANDIDATES.md (Tier A).
--
-- Scope: 46 MAIN-db tables with 0 code references, 0 rows, and a
-- dormant/dead lifecycle status. This does NOT drop anything -- it renames each
-- table to zz_deprecated_<name> so the change is instantly reversible. A real
-- DROP migration should follow only after a grace period with no errors.
--
-- Held back for manual review (NOT in this migration) because their "0 code
-- references" is an app-code .from()/.table() grep artifact -- each is actually
-- reached through a mechanism that grep cannot see:
--   * document_user_access / document_group_access -- RAG-docs gate + access model;
--   * payment_transactions -- FROM source of the live views
--     contract_financial_summary / _mv (payments_received / percent_paid);
--   * sub_jobs -- PostgREST embed sub_job:sub_jobs(code,name) in budget export
--     and compute-grand-totals (relation resolved by name);
--   * observations -- dynamic entity-links table-map value + drawings
--     related-items existence check;
--   * recurring_issue_projects -- raw "insert into public.recurring_issue_projects"
--     in the daily deep-read consumer script.
-- Additionally held (OID-safe for rename, but view/FK-dependent so they would block
-- a later hard DROP -- deferred to a dependency-aware batch):
--   * discrepancies, reviews -- feed the submittal_project_dashboard view;
--   * groups, project_briefings, qtos, user_projects -- FK-referenced by other tables.
-- The remaining 46 tables are verified free of view / FK / PostgREST-embed /
-- dynamic-map / script dependencies (scripts/audits/scan-table-drop-dependencies.mjs).
--
-- NOTE ON HARD-DROP: "0 code references" reflects an app-code .from()/.table()
-- grep only -- it does NOT capture view / materialized-view dependencies,
-- PostgREST relation embeds, dynamic table-name maps, or raw-SQL scripts. Before
-- the hard-DROP follow-up, run a real dependency check (pg_depend + embed/map/
-- script grep) on every zz_deprecated_* table.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_weekly_reflections')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_ai_weekly_reflections') THEN
    EXECUTE 'ALTER TABLE public.ai_weekly_reflections RENAME TO zz_deprecated_ai_weekly_reflections';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_ai_weekly_reflections IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_parity_checks')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_parity_checks') THEN
    EXECUTE 'ALTER TABLE public.app_parity_checks RENAME TO zz_deprecated_app_parity_checks';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_app_parity_checks IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_roles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_roles') THEN
    EXECUTE 'ALTER TABLE public.app_roles RENAME TO zz_deprecated_app_roles';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_app_roles IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_schedule_bulk_operations')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_schedule_bulk_operations') THEN
    EXECUTE 'ALTER TABLE public.app_schedule_bulk_operations RENAME TO zz_deprecated_app_schedule_bulk_operations';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_app_schedule_bulk_operations IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_schedule_task_hierarchy')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_schedule_task_hierarchy') THEN
    EXECUTE 'ALTER TABLE public.app_schedule_task_hierarchy RENAME TO zz_deprecated_app_schedule_task_hierarchy';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_app_schedule_task_hierarchy IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_system_states')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_system_states') THEN
    EXECUTE 'ALTER TABLE public.app_system_states RENAME TO zz_deprecated_app_system_states';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_app_system_states IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_ui_components')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_ui_components') THEN
    EXECUTE 'ALTER TABLE public.app_ui_components RENAME TO zz_deprecated_app_ui_components';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_app_ui_components IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_ui_table_columns')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_ui_table_columns') THEN
    EXECUTE 'ALTER TABLE public.app_ui_table_columns RENAME TO zz_deprecated_app_ui_table_columns';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_app_ui_table_columns IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asrs_decision_matrix')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_asrs_decision_matrix') THEN
    EXECUTE 'ALTER TABLE public.asrs_decision_matrix RENAME TO zz_deprecated_asrs_decision_matrix';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_asrs_decision_matrix IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asrs_logic_cards')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_asrs_logic_cards') THEN
    EXECUTE 'ALTER TABLE public.asrs_logic_cards RENAME TO zz_deprecated_asrs_logic_cards';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_asrs_logic_cards IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asrs_protection_rules')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_asrs_protection_rules') THEN
    EXECUTE 'ALTER TABLE public.asrs_protection_rules RENAME TO zz_deprecated_asrs_protection_rules';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_asrs_protection_rules IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_invitations')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_billing_invitations') THEN
    EXECUTE 'ALTER TABLE public.billing_invitations RENAME TO zz_deprecated_billing_invitations';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_billing_invitations IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'block_embeddings')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_block_embeddings') THEN
    EXECUTE 'ALTER TABLE public.block_embeddings RENAME TO zz_deprecated_block_embeddings';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_block_embeddings IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'briefing_runs')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_briefing_runs') THEN
    EXECUTE 'ALTER TABLE public.briefing_runs RENAME TO zz_deprecated_briefing_runs';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_briefing_runs IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_line_item_history')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_budget_line_item_history') THEN
    EXECUTE 'ALTER TABLE public.budget_line_item_history RENAME TO zz_deprecated_budget_line_item_history';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_budget_line_item_history IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'change_workflow_comments')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_change_workflow_comments') THEN
    EXECUTE 'ALTER TABLE public.change_workflow_comments RENAME TO zz_deprecated_change_workflow_comments';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_change_workflow_comments IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'change_workflow_notifications')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_change_workflow_notifications') THEN
    EXECUTE 'ALTER TABLE public.change_workflow_notifications RENAME TO zz_deprecated_change_workflow_notifications';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_change_workflow_notifications IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_payments')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_contract_payments') THEN
    EXECUTE 'ALTER TABLE public.contract_payments RENAME TO zz_deprecated_contract_payments';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_contract_payments IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_snapshots')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_contract_snapshots') THEN
    EXECUTE 'ALTER TABLE public.contract_snapshots RENAME TO zz_deprecated_contract_snapshots';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_contract_snapshots IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_views')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_contract_views') THEN
    EXECUTE 'ALTER TABLE public.contract_views RENAME TO zz_deprecated_contract_views';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_contract_views IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_messages')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_email_messages') THEN
    EXECUTE 'ALTER TABLE public.email_messages RENAME TO zz_deprecated_email_messages';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_email_messages IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fm_optimization_suggestions')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_fm_optimization_suggestions') THEN
    EXECUTE 'ALTER TABLE public.fm_optimization_suggestions RENAME TO zz_deprecated_fm_optimization_suggestions';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_fm_optimization_suggestions IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forecasting')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_forecasting') THEN
    EXECUTE 'ALTER TABLE public.forecasting RENAME TO zz_deprecated_forecasting';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_forecasting IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_members')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_group_members') THEN
    EXECUTE 'ALTER TABLE public.group_members RENAME TO zz_deprecated_group_members';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_group_members IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inspections')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_inspections') THEN
    EXECUTE 'ALTER TABLE public.inspections RENAME TO zz_deprecated_inspections';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_inspections IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_performance_snapshots')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_marketing_performance_snapshots') THEN
    EXECUTE 'ALTER TABLE public.marketing_performance_snapshots RENAME TO zz_deprecated_marketing_performance_snapshots';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_marketing_performance_snapshots IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nods_page_section')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_nods_page_section') THEN
    EXECUTE 'ALTER TABLE public.nods_page_section RENAME TO zz_deprecated_nods_page_section';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_nods_page_section IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'observation_comments')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_observation_comments') THEN
    EXECUTE 'ALTER TABLE public.observation_comments RENAME TO zz_deprecated_observation_comments';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_observation_comments IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'observation_history')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_observation_history') THEN
    EXECUTE 'ALTER TABLE public.observation_history RENAME TO zz_deprecated_observation_history';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_observation_history IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'optimization_rules')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_optimization_rules') THEN
    EXECUTE 'ALTER TABLE public.optimization_rules RENAME TO zz_deprecated_optimization_rules';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_optimization_rules IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_organization_members') THEN
    EXECUTE 'ALTER TABLE public.organization_members RENAME TO zz_deprecated_organization_members';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_organization_members IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_organizations') THEN
    EXECUTE 'ALTER TABLE public.organizations RENAME TO zz_deprecated_organizations';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_organizations IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'procore_feature_implementations')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_procore_feature_implementations') THEN
    EXECUTE 'ALTER TABLE public.procore_feature_implementations RENAME TO zz_deprecated_procore_feature_implementations';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_procore_feature_implementations IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_notification_groups')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_project_notification_groups') THEN
    EXECUTE 'ALTER TABLE public.project_notification_groups RENAME TO zz_deprecated_project_notification_groups';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_project_notification_groups IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_resources')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_project_resources') THEN
    EXECUTE 'ALTER TABLE public.project_resources RENAME TO zz_deprecated_project_resources';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_project_resources IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'punch_item_comments')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_punch_item_comments') THEN
    EXECUTE 'ALTER TABLE public.punch_item_comments RENAME TO zz_deprecated_punch_item_comments';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_punch_item_comments IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'punch_item_template_categories')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_punch_item_template_categories') THEN
    EXECUTE 'ALTER TABLE public.punch_item_template_categories RENAME TO zz_deprecated_punch_item_template_categories';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_punch_item_template_categories IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'punch_item_templates')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_punch_item_templates') THEN
    EXECUTE 'ALTER TABLE public.punch_item_templates RENAME TO zz_deprecated_punch_item_templates';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_punch_item_templates IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qto_items')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_qto_items') THEN
    EXECUTE 'ALTER TABLE public.qto_items RENAME TO zz_deprecated_qto_items';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_qto_items IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'review_comments')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_review_comments') THEN
    EXECUTE 'ALTER TABLE public.review_comments RENAME TO zz_deprecated_review_comments';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_review_comments IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rfi_assignees')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_rfi_assignees') THEN
    EXECUTE 'ALTER TABLE public.rfi_assignees RENAME TO zz_deprecated_rfi_assignees';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_rfi_assignees IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submittal_notifications')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_submittal_notifications') THEN
    EXECUTE 'ALTER TABLE public.submittal_notifications RENAME TO zz_deprecated_submittal_notifications';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_submittal_notifications IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submittal_performance_metrics')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_submittal_performance_metrics') THEN
    EXECUTE 'ALTER TABLE public.submittal_performance_metrics RENAME TO zz_deprecated_submittal_performance_metrics';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_submittal_performance_metrics IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timesheets')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_timesheets') THEN
    EXECUTE 'ALTER TABLE public.timesheets RENAME TO zz_deprecated_timesheets';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_timesheets IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transmittal_items')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_transmittal_items') THEN
    EXECUTE 'ALTER TABLE public.transmittal_items RENAME TO zz_deprecated_transmittal_items';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_transmittal_items IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_project_roles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_user_project_roles') THEN
    EXECUTE 'ALTER TABLE public.user_project_roles RENAME TO zz_deprecated_user_project_roles';
    EXECUTE 'COMMENT ON TABLE public.zz_deprecated_user_project_roles IS ''Soft-dropped 2026-07-19 (Tier A: 0 code refs, 0 rows, dormant/dead). Reversible: rename back. Hard-drop candidate after grace period with no errors.''';
  END IF;
END
$$;

-- =============================================================================
-- ROLLBACK (run manually to reverse this migration)
-- =============================================================================
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_ai_weekly_reflections')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_weekly_reflections') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_ai_weekly_reflections RENAME TO ai_weekly_reflections';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_parity_checks')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_parity_checks') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_app_parity_checks RENAME TO app_parity_checks';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_roles')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_roles') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_app_roles RENAME TO app_roles';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_schedule_bulk_operations')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_schedule_bulk_operations') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_app_schedule_bulk_operations RENAME TO app_schedule_bulk_operations';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_schedule_task_hierarchy')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_schedule_task_hierarchy') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_app_schedule_task_hierarchy RENAME TO app_schedule_task_hierarchy';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_system_states')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_system_states') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_app_system_states RENAME TO app_system_states';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_ui_components')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_ui_components') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_app_ui_components RENAME TO app_ui_components';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_app_ui_table_columns')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_ui_table_columns') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_app_ui_table_columns RENAME TO app_ui_table_columns';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_asrs_decision_matrix')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asrs_decision_matrix') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_asrs_decision_matrix RENAME TO asrs_decision_matrix';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_asrs_logic_cards')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asrs_logic_cards') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_asrs_logic_cards RENAME TO asrs_logic_cards';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_asrs_protection_rules')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asrs_protection_rules') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_asrs_protection_rules RENAME TO asrs_protection_rules';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_billing_invitations')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_invitations') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_billing_invitations RENAME TO billing_invitations';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_block_embeddings')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'block_embeddings') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_block_embeddings RENAME TO block_embeddings';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_briefing_runs')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'briefing_runs') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_briefing_runs RENAME TO briefing_runs';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_budget_line_item_history')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_line_item_history') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_budget_line_item_history RENAME TO budget_line_item_history';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_change_workflow_comments')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'change_workflow_comments') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_change_workflow_comments RENAME TO change_workflow_comments';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_change_workflow_notifications')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'change_workflow_notifications') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_change_workflow_notifications RENAME TO change_workflow_notifications';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_contract_payments')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_payments') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_contract_payments RENAME TO contract_payments';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_contract_snapshots')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_snapshots') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_contract_snapshots RENAME TO contract_snapshots';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_contract_views')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_views') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_contract_views RENAME TO contract_views';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_email_messages')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_messages') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_email_messages RENAME TO email_messages';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_fm_optimization_suggestions')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fm_optimization_suggestions') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_fm_optimization_suggestions RENAME TO fm_optimization_suggestions';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_forecasting')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forecasting') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_forecasting RENAME TO forecasting';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_group_members')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_members') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_group_members RENAME TO group_members';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_inspections')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inspections') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_inspections RENAME TO inspections';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_marketing_performance_snapshots')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_performance_snapshots') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_marketing_performance_snapshots RENAME TO marketing_performance_snapshots';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_nods_page_section')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nods_page_section') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_nods_page_section RENAME TO nods_page_section';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_observation_comments')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'observation_comments') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_observation_comments RENAME TO observation_comments';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_observation_history')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'observation_history') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_observation_history RENAME TO observation_history';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_optimization_rules')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'optimization_rules') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_optimization_rules RENAME TO optimization_rules';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_organization_members')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_organization_members RENAME TO organization_members';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_organizations')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_organizations RENAME TO organizations';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_procore_feature_implementations')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'procore_feature_implementations') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_procore_feature_implementations RENAME TO procore_feature_implementations';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_project_notification_groups')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_notification_groups') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_project_notification_groups RENAME TO project_notification_groups';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_project_resources')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_resources') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_project_resources RENAME TO project_resources';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_punch_item_comments')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'punch_item_comments') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_punch_item_comments RENAME TO punch_item_comments';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_punch_item_template_categories')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'punch_item_template_categories') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_punch_item_template_categories RENAME TO punch_item_template_categories';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_punch_item_templates')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'punch_item_templates') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_punch_item_templates RENAME TO punch_item_templates';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_qto_items')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'qto_items') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_qto_items RENAME TO qto_items';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_review_comments')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'review_comments') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_review_comments RENAME TO review_comments';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_rfi_assignees')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rfi_assignees') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_rfi_assignees RENAME TO rfi_assignees';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_submittal_notifications')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submittal_notifications') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_submittal_notifications RENAME TO submittal_notifications';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_submittal_performance_metrics')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submittal_performance_metrics') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_submittal_performance_metrics RENAME TO submittal_performance_metrics';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_timesheets')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timesheets') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_timesheets RENAME TO timesheets';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_transmittal_items')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transmittal_items') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_transmittal_items RENAME TO transmittal_items';
--   END IF;
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zz_deprecated_user_project_roles')
--      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_project_roles') THEN
--     EXECUTE 'ALTER TABLE public.zz_deprecated_user_project_roles RENAME TO user_project_roles';
--   END IF;
-- END
-- $$;
