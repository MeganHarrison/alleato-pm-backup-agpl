-- RAG/AI database migration.
-- The workflow owner records accepted asynchronous work as workflow_queued.

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
      'intentionally_excluded',
      'workflow_queued'
    )
  );
