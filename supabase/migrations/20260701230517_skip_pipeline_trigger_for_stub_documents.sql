-- ============================================================
-- Exempt stub document_metadata rows from the RAG pipeline trigger
-- ============================================================
--
-- Meeting agenda-item task creation inserts a deterministic
-- document_metadata stub (id 'meeting-item-task-<itemId>', type
-- 'meeting_agenda_task', source_system 'meetings_tool') solely because
-- tasks.metadata_id is NOT NULL. These stubs carry no real document
-- content and must never enter the RAG pipeline — the unconditional
-- AFTER INSERT trigger was calling /api/pipeline/process for every one
-- of them, producing a doomed pipeline run per agenda task and
-- surfacing as failed-job noise in pipeline health.
--
-- This redefines public.enqueue_document_metadata_rag_job() (last
-- updated in 20260227000002_pipeline_config_table.sql, which switched
-- pipeline_url lookup from a DB setting to the pipeline_config table)
-- to early-return for known stub document types. The guard is a list
-- so future stub types can be appended without another migration.
-- Everything else in the function body is unchanged.
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
  -- Stub documents exist only to satisfy tasks.metadata_id's NOT NULL
  -- constraint (e.g. meeting agenda-item task creation). They have no
  -- real content and must never enter the pipeline. Append future stub
  -- types to this list rather than adding new triggers/guards.
  IF NEW.type IN ('meeting_agenda_task') THEN
    RETURN NEW;
  END IF;

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
