-- AI intelligence compiler job ledger and signal staging.
--
-- This migration adds the missing backend control plane between raw RAG
-- sources and the existing intelligence packet tables. It intentionally reuses
-- the existing document_attribution_candidates table instead of creating a
-- parallel attribution system.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table if exists public.document_attribution_candidates
  add column if not exists candidate_target_id uuid null references public.intelligence_targets(id) on delete set null,
  add column if not exists confidence_label text,
  add column if not exists matched_fields text[] not null default '{}',
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists compiler_version text;

alter table if exists public.document_attribution_candidates
  drop constraint if exists document_attribution_candidates_confidence_label_check;

alter table if exists public.document_attribution_candidates
  add constraint document_attribution_candidates_confidence_label_check
  check (
    confidence_label is null
    or confidence_label in ('high','medium','low')
  );

create index if not exists idx_attribution_candidates_target
  on public.document_attribution_candidates(candidate_target_id);
create index if not exists idx_attribution_candidates_status_created
  on public.document_attribution_candidates(status, created_at);

create table if not exists public.source_intelligence_jobs (
  id uuid primary key default gen_random_uuid(),
  source_document_id text not null references public.document_metadata(id) on delete cascade,
  source_hash text,
  job_type text not null
    check (job_type in ('attribution','signal_extract','card_upsert','packet_refresh')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','skipped','needs_review')),
  priority integer not null default 0,
  target_id uuid null references public.intelligence_targets(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
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
  source_document_id text not null references public.document_metadata(id) on delete cascade,
  source_chunk_id text,
  target_id uuid null references public.intelligence_targets(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
  signal_type text not null
    check (
      signal_type in (
        'risk',
        'decision',
        'blocker',
        'task',
        'project_update',
        'open_question',
        'financial_exposure',
        'change_management',
        'schedule_risk',
        'process_issue'
      )
    ),
  title text not null,
  summary text not null,
  why_it_matters text,
  current_status text not null default 'open'
    check (current_status in ('open','resolved','blocked','needs_review','stale','rejected')),
  confidence_score numeric not null check (confidence_score >= 0 and confidence_score <= 1),
  confidence text not null check (confidence in ('high','medium','low')),
  status text not null default 'candidate'
    check (status in ('candidate','promoted','needs_review','rejected','duplicate','skipped')),
  suggested_owner_person_id uuid null references public.people(id) on delete set null,
  suggested_owner_label text,
  next_action text,
  stale_after timestamptz,
  source_occurred_at timestamptz,
  excerpt text,
  normalized_signal_key text not null,
  promoted_insight_card_id uuid null references public.insight_cards(id) on delete set null,
  extraction_json jsonb not null default '{}'::jsonb,
  compiler_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packet_refresh_jobs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.intelligence_targets(id) on delete cascade,
  reason text not null,
  trigger_source_document_id text null references public.document_metadata(id) on delete set null,
  trigger_insight_card_id uuid null references public.insight_cards(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','skipped')),
  priority integer not null default 0,
  compiler_version text not null,
  attempt_count integer not null default 0,
  last_error text,
  output_packet_id uuid null references public.intelligence_packets(id) on delete set null,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_intelligence_jobs_status_idx
  on public.source_intelligence_jobs(status, priority desc, queued_at);
create index if not exists source_intelligence_jobs_source_idx
  on public.source_intelligence_jobs(source_document_id, compiler_version);
create index if not exists source_intelligence_jobs_target_idx
  on public.source_intelligence_jobs(target_id, status);
create unique index if not exists source_intelligence_jobs_active_source_idx
  on public.source_intelligence_jobs(source_document_id, source_hash, job_type, compiler_version)
  where status in ('queued','running','succeeded') and source_hash is not null;

create index if not exists source_signal_candidates_source_idx
  on public.source_signal_candidates(source_document_id);
create index if not exists source_signal_candidates_target_idx
  on public.source_signal_candidates(target_id, signal_type, status);
create index if not exists source_signal_candidates_project_idx
  on public.source_signal_candidates(project_id, signal_type, status);
create index if not exists source_signal_candidates_key_idx
  on public.source_signal_candidates(normalized_signal_key, target_id);
create index if not exists source_signal_candidates_status_idx
  on public.source_signal_candidates(status, created_at);

create index if not exists packet_refresh_jobs_status_idx
  on public.packet_refresh_jobs(status, priority desc, queued_at);
create index if not exists packet_refresh_jobs_target_idx
  on public.packet_refresh_jobs(target_id, status);
create unique index if not exists packet_refresh_jobs_active_target_idx
  on public.packet_refresh_jobs(target_id, compiler_version)
  where status in ('queued','running');

drop trigger if exists source_intelligence_jobs_set_updated_at
  on public.source_intelligence_jobs;
create trigger source_intelligence_jobs_set_updated_at
  before update on public.source_intelligence_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists source_signal_candidates_set_updated_at
  on public.source_signal_candidates;
create trigger source_signal_candidates_set_updated_at
  before update on public.source_signal_candidates
  for each row execute function public.set_updated_at();

drop trigger if exists packet_refresh_jobs_set_updated_at
  on public.packet_refresh_jobs;
create trigger packet_refresh_jobs_set_updated_at
  before update on public.packet_refresh_jobs
  for each row execute function public.set_updated_at();

alter table public.source_intelligence_jobs enable row level security;
alter table public.source_signal_candidates enable row level security;
alter table public.packet_refresh_jobs enable row level security;

drop policy if exists source_intelligence_jobs_select on public.source_intelligence_jobs;
create policy source_intelligence_jobs_select
  on public.source_intelligence_jobs
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or (
      project_id is not null
      and public.current_is_project_member(project_id)
    )
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = source_intelligence_jobs.target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists source_intelligence_jobs_service_write on public.source_intelligence_jobs;
create policy source_intelligence_jobs_service_write
  on public.source_intelligence_jobs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists source_signal_candidates_select on public.source_signal_candidates;
create policy source_signal_candidates_select
  on public.source_signal_candidates
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or (
      project_id is not null
      and public.current_is_project_member(project_id)
    )
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = source_signal_candidates.target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists source_signal_candidates_service_write on public.source_signal_candidates;
create policy source_signal_candidates_service_write
  on public.source_signal_candidates
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists packet_refresh_jobs_select on public.packet_refresh_jobs;
create policy packet_refresh_jobs_select
  on public.packet_refresh_jobs
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = packet_refresh_jobs.target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists packet_refresh_jobs_service_write on public.packet_refresh_jobs;
create policy packet_refresh_jobs_service_write
  on public.packet_refresh_jobs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists document_attribution_candidates_service_write
  on public.document_attribution_candidates;
create policy document_attribution_candidates_service_write
  on public.document_attribution_candidates
  for all
  to service_role
  using (true)
  with check (true);

grant select on
  public.source_intelligence_jobs,
  public.source_signal_candidates,
  public.packet_refresh_jobs
to authenticated;

grant all on
  public.source_intelligence_jobs,
  public.source_signal_candidates,
  public.packet_refresh_jobs
to service_role;

comment on table public.source_intelligence_jobs is
  'Compiler ledger for turning raw RAG source rows into attribution candidates, signal candidates, insight cards, and packet refreshes.';
comment on table public.source_signal_candidates is
  'Reviewable staging records extracted from raw sources before promotion into insight_cards.';
comment on table public.packet_refresh_jobs is
  'Deduplicated packet refresh queue for intelligence_targets.';
comment on column public.source_signal_candidates.source_chunk_id is
  'Soft reference to document_chunks.chunk_id. No FK until live chunk ID format and uniqueness are stable.';

commit;
