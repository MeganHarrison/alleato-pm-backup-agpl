-- =====================================================================
-- Drop Pipeline A intelligence tables and views.
--
-- Background:
-- Pipeline A (`insights`, `project_insights`, `ai_insights`) and the
-- views that derive from `ai_insights` are the legacy extraction layer
-- replaced by Pipeline B (`insight_cards`, `intelligence_packets`,
-- `intelligence_packet_cards`, `intelligence_targets`, `insight_card_evidence`).
-- See backend/src/services/intelligence/compiler.py.
--
-- Pipeline B has been the canonical reader for all owner-facing surfaces
-- since the 2026-05-15 migration commit. All AI tools, UI pages, and the
-- daily owner briefing have been re-pointed.
--
-- DO NOT APPLY THIS MIGRATION until:
--   1. All Pipeline A readers in the codebase are confirmed migrated
--      (npm run typecheck clean, smoke tests green).
--   2. The Pipeline A WRITERS in the Python compilers have been disabled
--      (teams_compiler.write_project_insights, teams_compiler.write_structured_insights,
--      email_compiler.write_project_insights, email_compiler.write_structured_insights,
--      pipeline/extractor.upsert into insights, supabase_helpers.insert_insight).
--      Otherwise the compilers will error on writes to non-existent tables.
--   3. A 7-day stability window has passed with no Pipeline A reads
--      observed in logs.
--
-- This file is staged for review; apply with `supabase db push` only after
-- the three preconditions above are met.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Drop views that depend on ai_insights.
--    These must drop BEFORE the underlying table.
-- ---------------------------------------------------------------------

DROP VIEW IF EXISTS public.ai_insights_today CASCADE;
DROP VIEW IF EXISTS public.ai_insights_with_project CASCADE;

-- project_health_dashboard reads from ai_insights. Drop and let the next
-- migration recreate it backed by insight_cards if still needed.
DROP VIEW IF EXISTS public.project_health_dashboard CASCADE;
DROP VIEW IF EXISTS public.project_health_dashboard_no_summary CASCADE;

-- ---------------------------------------------------------------------
-- 2. Drop the legacy intelligence tables.
--    These tables ARE referenced by no remaining application code at this
--    point. Their data is duplicated in insight_cards (Pipeline B writes
--    every row that Pipeline A wrote during the dual-write period).
-- ---------------------------------------------------------------------

DROP TABLE IF EXISTS public.ai_insights CASCADE;
DROP TABLE IF EXISTS public.project_insights CASCADE;
DROP TABLE IF EXISTS public.insights CASCADE;

COMMIT;

-- ---------------------------------------------------------------------
-- POST-MIGRATION CHECKLIST
-- ---------------------------------------------------------------------
-- [ ] Regenerate types: `cd frontend && npm run db:types`
-- [ ] Verify nothing imports the dropped tables: `grep -rn "ai_insights\|project_insights\|\.from(\"insights\")" frontend/src backend/src`
-- [ ] Drop dead helper code:
--       - `supabase_helpers.SupabaseHelper.fetch_recent_insights` (reads project_insights)
--       - `supabase_helpers.SupabaseHelper.insert_insight` (writes project_insights)
-- [ ] If project_health_dashboard view is still wanted, recreate it from insight_cards:
--       CREATE VIEW project_health_dashboard AS
--         SELECT it.project_id,
--                COUNT(ic.id) FILTER (WHERE ic.card_type IN ('risk','blocker','financial_exposure','schedule_risk')
--                                       AND ic.confidence = 'high'
--                                       AND ic.current_status IN ('open','blocked')) AS open_critical_items,
--                COUNT(ic.id) FILTER (WHERE ic.current_status NOT IN ('resolved')) AS total_insights_count
--         FROM intelligence_targets it
--         LEFT JOIN insight_cards ic ON ic.primary_target_id = it.id
--         WHERE it.target_type = 'client_project'
--         GROUP BY it.project_id;
