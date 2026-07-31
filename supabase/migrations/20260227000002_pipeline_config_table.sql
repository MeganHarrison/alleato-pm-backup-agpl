-- ============================================================
-- Pipeline config table (replaces ALTER DATABASE setting)
-- ============================================================
-- Stores the FastAPI pipeline URL so the trigger can call it.
-- Uses a simple key-value table instead of pg_settings, which
-- requires superuser privileges to set on Supabase cloud.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pipeline_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
-- Seed with an empty URL (update after deploying the backend)
INSERT INTO public.pipeline_config (key, value)
VALUES ('pipeline_url', '')
ON CONFLICT (key) DO NOTHING;
-- RLS: only service role can read/write
ALTER TABLE public.pipeline_config ENABLE ROW LEVEL SECURITY;
-- ============================================================
-- Update trigger function to read from config table
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

  -- Read URL from config table (no superuser required)
  SELECT value INTO pipeline_url
  FROM public.pipeline_config
  WHERE key = 'pipeline_url';

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
