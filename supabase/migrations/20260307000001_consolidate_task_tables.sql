-- Consolidate task tables: ai_tasks + project_tasks → tasks
--
-- The pipeline extractor (pipeline/extractor.py) already writes enriched tasks
-- to the unified `tasks` table (with embeddings, assignee emails, priority
-- inference, and project_ids array).  The `ai_tasks` and `project_tasks` tables
-- were redundant copies populated during Fireflies ingestion — those writes have
-- been removed from the application code.
--
-- This migration cleans up the unused objects:
--   1. open_tasks_view        – Postgres view built on ai_tasks (never queried)
--   2. project_activity_view  – Rebuilt to join `tasks` instead of `ai_tasks`
--   3. ai_tasks               – Legacy simple-task table
--   4. project_tasks          – Legacy project-scoped task table

-- Drop views that depend on ai_tasks
DROP VIEW IF EXISTS public.open_tasks_view;
DROP VIEW IF EXISTS public.project_activity_view;
-- Drop the redundant tables
DROP TABLE IF EXISTS public.ai_tasks;
DROP TABLE IF EXISTS public.project_tasks;
-- Recreate project_activity_view using the unified `tasks` table.
-- Key change: tasks.project_ids is an integer array, so we use ANY() for the join.
CREATE OR REPLACE VIEW public.project_activity_view AS
SELECT
    p.id AS project_id,
    p.name,
    COALESCE(count(DISTINCT dm.id), 0::bigint) AS meeting_count,
    COALESCE(count(DISTINCT
        CASE
            WHEN t.status = ANY (ARRAY['open'::text, 'in_progress'::text]) THEN t.id
            ELSE NULL::uuid
        END), 0::bigint) AS open_tasks,
    max(dm.captured_at) AS last_meeting_at,
    max(t.updated_at)   AS last_task_update
FROM projects p
    LEFT JOIN document_metadata dm ON dm.project_id = p.id
    LEFT JOIN tasks t ON p.id = ANY(t.project_ids)
GROUP BY p.id, p.name;
-- Restore grants
GRANT ALL ON TABLE public.project_activity_view TO anon;
GRANT ALL ON TABLE public.project_activity_view TO authenticated;
GRANT ALL ON TABLE public.project_activity_view TO service_role;
