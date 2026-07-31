-- Backfill: clean up 969 legacy Fireflies tasks written before the LLM rewriter
-- existed. These rows have null titles and third-person narration as the task
-- "description" ("Provide support to Brandon Clymer...", "Inform Maria...",
-- etc.), assigned to whichever person was named in the text — usually the
-- recipient, not the doer.
--
-- The matching meetings are flagged for re-extraction: setting the ingestion
-- job back to the pre-extractor stage means the next pipeline run will
-- recreate proper tasks via fireflies_task_rewriter. Until that re-run
-- happens, affected meetings simply have no Fireflies tasks (the
-- intelligence_compiler / decisions / risks data is untouched).
--
-- 84 meetings affected, date range 2026-05-07 → 2026-05-21.

DO $$
DECLARE
  affected_meeting_ids text[];
BEGIN
  SELECT array_agg(DISTINCT metadata_id)
    INTO affected_meeting_ids
  FROM public.tasks
  WHERE source_system = 'fireflies'
    AND extraction_prompt_version IS NULL;

  IF affected_meeting_ids IS NULL THEN
    RAISE NOTICE 'No legacy Fireflies tasks to backfill — skipping.';
    RETURN;
  END IF;

  DELETE FROM public.tasks
  WHERE source_system = 'fireflies'
    AND extraction_prompt_version IS NULL;

  RAISE NOTICE 'Deleted % legacy Fireflies tasks across % meetings.',
    (SELECT count(*) FROM public.tasks WHERE source_system = 'fireflies' AND extraction_prompt_version IS NULL),
    array_length(affected_meeting_ids, 1);

  UPDATE public.fireflies_ingestion_jobs
     SET stage = 'embedded', error_message = NULL
   WHERE metadata_id::text = ANY (affected_meeting_ids)
     AND stage = 'done';

  UPDATE public.document_metadata
     SET status = 'processed'
   WHERE id::text = ANY (affected_meeting_ids)
     AND status = 'complete';
END $$;
