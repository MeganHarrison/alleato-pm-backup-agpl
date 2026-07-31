-- Drop the rag_pipeline_snapshots table. It was created earlier today
-- (migration 20260525100000) for a per-source synced/chunked/embedded
-- snapshot dashboard. That design was wrong — the user wanted a daily
-- ops view of items synced vs failed per source. That data already lives
-- in source_sync_runs, so no snapshot table is needed at all.
--
-- The /rag dashboard now queries source_sync_runs live via
-- /api/admin/rag-snapshots. The rag_snapshot.py collector and
-- alleato-rag-snapshot Render cron have also been removed.

DROP TABLE IF EXISTS public.rag_pipeline_snapshots;
