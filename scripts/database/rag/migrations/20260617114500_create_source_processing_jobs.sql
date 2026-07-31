-- RAG/AI Database migration.
--
-- Durable per-source lifecycle ledger for ingestion -> RAG indexing -> signal
-- extraction -> project intelligence. This intentionally lives in the AI/RAG
-- database so high-churn pipeline status does not add write pressure to PM APP.

set statement_timeout = 0;
set lock_timeout = '5min';

create table if not exists public.source_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_item_id text not null,
  content_hash text not null default '',
  source_document_id text,
  project_id bigint,
  status text not null,
  source_title text,
  source_url text,
  occurred_at timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  retry_count integer not null default 0,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint source_processing_jobs_unique_source_hash
    unique (source_system, source_item_id, content_hash),
  constraint source_processing_jobs_status_check check (
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
      'skipped_unchanged'
    )
  ),
  constraint source_processing_jobs_retry_count_check check (retry_count >= 0)
);

create index if not exists source_processing_jobs_status_updated_idx
  on public.source_processing_jobs(status, updated_at desc);

create index if not exists source_processing_jobs_project_status_idx
  on public.source_processing_jobs(project_id, status, updated_at desc)
  where project_id is not null;

create index if not exists source_processing_jobs_document_idx
  on public.source_processing_jobs(source_document_id)
  where source_document_id is not null;

create index if not exists source_processing_jobs_source_system_idx
  on public.source_processing_jobs(source_system, updated_at desc);

grant select, insert, update, delete on public.source_processing_jobs to service_role;

comment on table public.source_processing_jobs is
  'RAG-side lifecycle ledger for each source item hash as it moves through project assignment, embedding, signal extraction, and project intelligence.';

comment on column public.source_processing_jobs.content_hash is
  'Normalized source-content hash. Empty string is allowed only for legacy rows where a hash is not available yet.';
