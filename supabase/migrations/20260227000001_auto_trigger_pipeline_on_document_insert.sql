-- ============================================================
-- Auto-trigger RAG pipeline when a document_metadata row is inserted
-- ============================================================
--
-- How it works:
--   1. Any INSERT into document_metadata fires this trigger
--   2. A fireflies_ingestion_jobs row is created (stage=raw_ingested)
--   3. If app.pipeline_url is configured, pg_net makes an immediate HTTP
--      POST to the FastAPI /api/pipeline/process endpoint — no cron delay
--   4. The Python orchestrator chains parse → embed → extract in a
--      background task (see backend/src/services/pipeline/)
--
-- Required setup (run once after deploying the backend):
--
--   ALTER DATABASE postgres
--     SET app.pipeline_url = 'https://your-backend.com/api/pipeline/process';
--
-- For local development:
--
--   ALTER DATABASE postgres
--     SET app.pipeline_url = 'http://host.docker.internal:8051/api/pipeline/process';
--
-- The trigger is a no-op when app.pipeline_url is not set — documents
-- must then be processed manually via POST /api/pipeline/process.
-- ============================================================

-- pg_net is pre-installed on all Supabase projects
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
-- ============================================================
-- Trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_document_metadata_rag_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_id       TEXT;
  pipeline_url TEXT;
BEGIN
  -- Use fireflies_id when available, otherwise fall back to the row id
  job_id := COALESCE(NEW.fireflies_id, NEW.id::TEXT);

  -- Create the pipeline job record (idempotent)
  INSERT INTO public.fireflies_ingestion_jobs (fireflies_id, metadata_id, stage)
  VALUES (job_id, NEW.id::TEXT, 'raw_ingested')
  ON CONFLICT (fireflies_id) DO NOTHING;

  -- Immediately call the FastAPI pipeline endpoint if a URL is configured.
  -- Falls back to manual processing if the setting is absent.
  pipeline_url := current_setting('app.pipeline_url', true);

  IF pipeline_url IS NOT NULL AND pipeline_url <> '' THEN
    PERFORM net.http_post(
      url     := pipeline_url,
      body    := json_build_object('metadataId', NEW.id::TEXT)::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================================
-- Trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_enqueue_document_metadata_rag_job ON public.document_metadata;
CREATE TRIGGER trg_enqueue_document_metadata_rag_job
  AFTER INSERT ON public.document_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_document_metadata_rag_job();
