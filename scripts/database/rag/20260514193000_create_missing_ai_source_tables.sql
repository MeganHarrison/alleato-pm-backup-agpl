create extension if not exists pgcrypto;

create table if not exists public.document_attribution_candidates (
  id uuid primary key default gen_random_uuid(),
  source_document_id text not null,
  source_message_ids text[] not null default '{}'::text[],
  candidate_project_id bigint,
  candidate_project_name text,
  confidence numeric not null,
  attribution_method text not null,
  evidence_terms text[] not null default '{}'::text[],
  reasoning text,
  status text not null default 'pending_review'::text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  candidate_target_id uuid,
  confidence_label text,
  matched_fields text[] not null default '{}'::text[],
  evidence jsonb not null default '{}'::jsonb,
  compiler_version text
);

create table if not exists public.ingestion_dead_letter (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  error text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  fireflies_id text,
  document_id text,
  status text not null default 'pending'::text,
  error text,
  content_hash text,
  started_at timestamptz default now(),
  finished_at timestamptz
);

create table if not exists public.packet_refresh_jobs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null,
  reason text not null,
  trigger_source_document_id text,
  trigger_insight_card_id uuid,
  status text not null default 'queued'::text,
  priority integer not null default 0,
  compiler_version text not null,
  attempt_count integer not null default 0,
  last_error text,
  output_packet_id uuid,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rag_pipeline_state (
  pipeline_id text primary key,
  pipeline_type text not null,
  last_check_time timestamp,
  known_files jsonb,
  last_run timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.source_intelligence_jobs (
  id uuid primary key default gen_random_uuid(),
  source_document_id text not null,
  source_hash text,
  job_type text not null,
  status text not null default 'queued'::text,
  priority integer not null default 0,
  target_id uuid,
  project_id integer,
  compiler_version text not null,
  attempt_count integer not null default 0,
  last_error text,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_signal_candidates (
  id uuid primary key default gen_random_uuid(),
  source_document_id text not null,
  source_chunk_id text,
  target_id uuid,
  project_id integer,
  signal_type text not null,
  title text not null,
  summary text not null,
  why_it_matters text,
  current_status text not null default 'open'::text,
  confidence_score numeric not null,
  confidence text not null,
  status text not null default 'candidate'::text,
  suggested_owner_person_id uuid,
  suggested_owner_label text,
  next_action text,
  stale_after timestamptz,
  source_occurred_at timestamptz,
  excerpt text,
  normalized_signal_key text not null,
  promoted_insight_card_id uuid,
  extraction_json jsonb not null default '{}'::jsonb,
  compiler_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_sync_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  resource_id text not null default 'default'::text,
  resource_name text,
  status text not null default 'unknown'::text,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  items_synced integer not null default 0,
  unprocessed_count integer not null default 0,
  unembedded_count integer not null default 0,
  uncompiled_count integer not null default 0,
  stale_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, resource_id)
);

create table if not exists public.source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  resource_id text not null default 'default'::text,
  resource_name text,
  stage text not null,
  status text not null default 'running'::text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_seen integer not null default 0,
  items_synced integer not null default 0,
  items_created integer not null default 0,
  items_updated integer not null default 0,
  items_skipped integer not null default 0,
  items_failed integer not null default 0,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_attribution_candidates_doc on public.document_attribution_candidates (source_document_id);
create index if not exists idx_attribution_candidates_project on public.document_attribution_candidates (candidate_project_id);
create index if not exists idx_attribution_candidates_status on public.document_attribution_candidates (status);
create index if not exists idx_attribution_candidates_status_created on public.document_attribution_candidates (status, created_at);
create index if not exists idx_attribution_candidates_target on public.document_attribution_candidates (candidate_target_id);
create index if not exists idx_document_attribution_candidates_reviewed_by on public.document_attribution_candidates (reviewed_by);

create unique index if not exists ux_ingestion_jobs_fireflies on public.ingestion_jobs (fireflies_id) where fireflies_id is not null;

create unique index if not exists packet_refresh_jobs_active_target_idx on public.packet_refresh_jobs (target_id, compiler_version) where status = any (array['queued'::text, 'running'::text]);
create index if not exists packet_refresh_jobs_status_idx on public.packet_refresh_jobs (status, priority desc, queued_at);
create index if not exists packet_refresh_jobs_target_idx on public.packet_refresh_jobs (target_id, status);

create index if not exists idx_rag_pipeline_state_last_run on public.rag_pipeline_state (last_run);
create index if not exists idx_rag_pipeline_state_pipeline_type on public.rag_pipeline_state (pipeline_type);

create unique index if not exists source_intelligence_jobs_active_source_idx on public.source_intelligence_jobs (source_document_id, source_hash, job_type, compiler_version)
  where status = any (array['queued'::text, 'running'::text, 'succeeded'::text]) and source_hash is not null;
create index if not exists source_intelligence_jobs_source_idx on public.source_intelligence_jobs (source_document_id, compiler_version);
create index if not exists source_intelligence_jobs_status_idx on public.source_intelligence_jobs (status, priority desc, queued_at);
create index if not exists source_intelligence_jobs_target_idx on public.source_intelligence_jobs (target_id, status);

create index if not exists source_signal_candidates_key_idx on public.source_signal_candidates (normalized_signal_key, target_id);
create index if not exists source_signal_candidates_project_idx on public.source_signal_candidates (project_id, signal_type, status);
create index if not exists source_signal_candidates_source_idx on public.source_signal_candidates (source_document_id);
create index if not exists source_signal_candidates_status_idx on public.source_signal_candidates (status, created_at);
create index if not exists source_signal_candidates_target_idx on public.source_signal_candidates (target_id, signal_type, status);

create index if not exists source_sync_health_snapshots_generated_idx on public.source_sync_health_snapshots (generated_at desc);
create index if not exists source_sync_health_snapshots_status_idx on public.source_sync_health_snapshots (status, source);

create index if not exists source_sync_runs_source_stage_started_idx on public.source_sync_runs (source, stage, started_at desc);
create index if not exists source_sync_runs_status_started_idx on public.source_sync_runs (status, started_at desc);

grant select, insert, update, delete on all tables in schema public to service_role;
