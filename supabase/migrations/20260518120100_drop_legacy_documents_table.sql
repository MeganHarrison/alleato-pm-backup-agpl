-- Drop the legacy `public.documents` table and everything that depended on it.
--
-- Background: `documents` was the original embedding/transcript table from the
-- pre-Pipeline-B era. It was superseded by `document_metadata` (raw metadata)
-- and `document_chunks` in the AI Database project (vector store). The 30-day
-- soak from §8 of CONSOLIDATED-IMPLEMENTATION-PLAN.md was started 2026-05-17,
-- but `documents_access_audit` recorded zero accesses and the active code
-- consumers were migrated to `document_metadata` / `document_chunks` on
-- 2026-05-18, so the drop was promoted ahead of the 2026-06-17 target.
--
-- What goes:
--   * `public.documents` (12,685 legacy rows — content captured in
--      `document_metadata` + `document_chunks` in AI Database)
--   * `public.documents_access_audit` (soak instrumentation)
--   * `public.chunks` (0 rows — never populated; legacy embedding shard)
--   * `private.document_processing_queue` (0 rows — replaced by Microsoft Graph
--      sync orchestrator)
--   * `public.documents_ordered_view` (read-only view on `documents`)
--   * `public.project_health_dashboard` — recreated below WITHOUT the
--      `current_phase` column (which was dropped from `projects` separately).
--   * Six RPCs that read from `documents`:
--       match_documents (×2 overloads), match_documents_full,
--       match_documents_enhanced, match_recent_documents,
--       search_by_category, search_by_participants
--   * FK constraint `tasks.tasks_source_chunk_id_fkey` (column retained;
--     repurposed elsewhere)
--
-- Code consumers were migrated to:
--   * `document_metadata`     — table-level CRUD allowlists, type aliases,
--                               wizard delete, audit script, marketing source
--   * `document_chunks` (RAG) — backend `SupabaseRagStore` methods now query
--                               via `search_document_chunks` RPC + ilike on
--                               `document_chunks.text` through `_rag_read_client`

BEGIN;

-- 1. RPCs that read documents
DROP FUNCTION IF EXISTS public.match_documents(vector, integer, jsonb);
DROP FUNCTION IF EXISTS public.match_documents(vector, integer, double precision, text, bigint, uuid[]);
DROP FUNCTION IF EXISTS public.match_documents_full CASCADE;
DROP FUNCTION IF EXISTS public.match_documents_enhanced CASCADE;
DROP FUNCTION IF EXISTS public.match_recent_documents CASCADE;
DROP FUNCTION IF EXISTS public.search_by_category CASCADE;
DROP FUNCTION IF EXISTS public.search_by_participants CASCADE;

-- 2. Views on documents
DROP VIEW IF EXISTS public.documents_ordered_view;
DROP VIEW IF EXISTS public.project_health_dashboard;

-- 3. FK-bearing dependent tables (all empty)
DROP TABLE IF EXISTS private.document_processing_queue;
DROP TABLE IF EXISTS public.chunks;

-- 4. Drop the FK from tasks (keep the column — used for non-documents refs)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_source_chunk_id_fkey;

-- 5. The audit table and the legacy table itself
DROP TABLE IF EXISTS public.documents_access_audit CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;

-- 6. Recreate `project_health_dashboard` (no documents dependency, no
--    current_phase column). Body lifted from the 2026-05-15 migration.
CREATE OR REPLACE VIEW public.project_health_dashboard AS
SELECT
  p.id,
  p.name,
  p.completion_percentage,
  p.health_score,
  p.health_status,
  p.summary,
  p.summary_updated_at,
  CASE
    WHEN p.budget IS NOT NULL AND p.budget > 0 AND p.budget_used IS NOT NULL
      THEN (p.budget_used::numeric / p.budget::numeric) * 100::numeric
    ELSE 0::numeric
  END AS budget_utilization,
  p."est completion",
  (
    SELECT count(*)
    FROM public.insight_cards ic
    JOIN public.intelligence_targets it ON it.id = ic.primary_target_id
    WHERE it.project_id = p.id
      AND it.target_type = 'client_project'
      AND ic.attribution_status != 'rejected'
      AND ic.current_status != 'resolved'
  ) AS total_insights_count,
  (
    SELECT count(*)
    FROM public.insight_cards ic
    JOIN public.intelligence_targets it ON it.id = ic.primary_target_id
    WHERE it.project_id = p.id
      AND it.target_type = 'client_project'
      AND ic.attribution_status != 'rejected'
      AND ic.current_status IN ('open', 'blocked')
      AND ic.confidence = 'high'
      AND ic.card_type IN ('risk', 'blocker', 'financial_exposure', 'schedule_risk')
  ) AS open_critical_items,
  (
    SELECT count(*)
    FROM public.document_metadata dm
    WHERE dm.project_id = p.id
      AND dm.created_at > (now() - interval '30 days')
  ) AS recent_documents_count,
  (
    SELECT max(dm.created_at::date)
    FROM public.document_metadata dm
    WHERE dm.project_id = p.id
  ) AS last_document_date
FROM public.projects p
WHERE p.name IS NOT NULL
ORDER BY
  CASE WHEN p.health_score IS NULL THEN 999::numeric ELSE p.health_score END;

COMMENT ON VIEW public.project_health_dashboard IS
  'Project-level KPIs + insight card counts. Backed by insight_cards + intelligence_targets (Pipeline B). Recreated 2026-05-18 after the legacy documents drop; current_phase column removed.';

COMMIT;
