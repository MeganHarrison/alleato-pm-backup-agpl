-- RAG/AI Database migration.
--
-- Add a terminal, non-failure status for documents the ingestion pipeline
-- *deliberately* does not embed (interview-title meetings, sub-minimum
-- low-content docs). Previously these outcomes were recorded as
-- `failed_permanent` with an intentional error_code, which caused the
-- source-sync health map (/pipeline-health) to render intentional skips as
-- critical pipeline errors — burying the small number of genuine failures.
--
-- `intentionally_excluded` is terminal (like complete / failed_permanent /
-- skipped_unchanged): FINAL_STATUSES in source_processing.py stamps
-- completed_at, and no retry gate re-picks a document with this status.

set statement_timeout = 0;
set lock_timeout = '5min';

alter table public.source_processing_jobs
  drop constraint if exists source_processing_jobs_status_check;

alter table public.source_processing_jobs
  add constraint source_processing_jobs_status_check check (
    status in (
      'captured',
      'project_assigned',
      'project_assignment_review',
      'text_extracted',
      'indexed_for_rag',
      'signals_extracted',
      'project_intelligence_updated',
      'actions_routed',
      'complete',
      'failed_retryable',
      'failed_permanent',
      'skipped_unchanged',
      'intentionally_excluded'
    )
  );

-- Backfill historical intentional skips that were misfiled as failures so the
-- ledger is honest and the health map stops flagging them. completed_at is
-- already populated (failed_permanent was terminal), so only status changes.
update public.source_processing_jobs
   set status = 'intentionally_excluded'
 where status = 'failed_permanent'
   and error_code in ('interview_title_excluded', 'skipped_low_content');
