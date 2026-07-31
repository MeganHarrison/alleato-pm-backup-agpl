-- First-class artifacts, steps, and delivery attempts for AI work runs.
--
-- This extends the existing AI operations gateway ledger without changing the
-- underlying Executive Daily Brief generation or delivery business logic.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.ai_work_run_steps (
  id uuid primary key default gen_random_uuid(),
  work_run_id uuid not null references public.ai_work_runs(id) on delete cascade,
  step_type text not null
    check (step_type in (
      'source_fetch',
      'tool_call',
      'synthesis',
      'artifact_persist',
      'delivery',
      'verification'
    )),
  status text not null
    check (status in (
      'queued',
      'running',
      'succeeded',
      'skipped',
      'blocked',
      'failed_retryable',
      'failed_permanent'
    )),
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_work_run_artifacts (
  id uuid primary key default gen_random_uuid(),
  work_run_id uuid not null references public.ai_work_runs(id) on delete cascade,
  kind text not null
    check (kind in (
      'brief_packet',
      'teams_payload',
      'email_payload',
      'source_health_report',
      'delivery_receipt',
      'verification_report'
    )),
  title text not null,
  storage_table text,
  storage_id text,
  content_type text not null,
  checksum text,
  source_ref_count integer not null default 0 check (source_ref_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_work_run_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  work_run_id uuid not null references public.ai_work_runs(id) on delete cascade,
  artifact_id uuid references public.ai_work_run_artifacts(id) on delete set null,
  channel text not null check (channel in ('teams','email')),
  recipient_id text,
  recipient_address text,
  status text not null
    check (status in (
      'sent',
      'skipped',
      'blocked',
      'failed',
      'disabled',
      'dry_run'
    )),
  provider_message_id text,
  failure_code text,
  failure_message text,
  retryable boolean not null default false,
  attempted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_work_run_steps_run_created_idx
  on public.ai_work_run_steps(work_run_id, created_at);
create index if not exists ai_work_run_steps_type_status_idx
  on public.ai_work_run_steps(step_type, status, created_at desc);

create index if not exists ai_work_run_artifacts_run_created_idx
  on public.ai_work_run_artifacts(work_run_id, created_at);
create index if not exists ai_work_run_artifacts_kind_idx
  on public.ai_work_run_artifacts(kind, created_at desc);
create index if not exists ai_work_run_artifacts_storage_idx
  on public.ai_work_run_artifacts(storage_table, storage_id)
  where storage_table is not null and storage_id is not null;

create index if not exists ai_work_run_delivery_attempts_run_created_idx
  on public.ai_work_run_delivery_attempts(work_run_id, created_at);
create index if not exists ai_work_run_delivery_attempts_status_idx
  on public.ai_work_run_delivery_attempts(channel, status, attempted_at desc);
create index if not exists ai_work_run_delivery_attempts_artifact_idx
  on public.ai_work_run_delivery_attempts(artifact_id)
  where artifact_id is not null;

drop trigger if exists ai_work_run_steps_set_updated_at
  on public.ai_work_run_steps;
create trigger ai_work_run_steps_set_updated_at
  before update on public.ai_work_run_steps
  for each row execute function public.set_updated_at();

alter table public.ai_work_run_steps enable row level security;
alter table public.ai_work_run_artifacts enable row level security;
alter table public.ai_work_run_delivery_attempts enable row level security;

drop policy if exists ai_work_run_steps_admin_select on public.ai_work_run_steps;
create policy ai_work_run_steps_admin_select
  on public.ai_work_run_steps
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists ai_work_run_steps_service_write on public.ai_work_run_steps;
create policy ai_work_run_steps_service_write
  on public.ai_work_run_steps
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists ai_work_run_artifacts_admin_select on public.ai_work_run_artifacts;
create policy ai_work_run_artifacts_admin_select
  on public.ai_work_run_artifacts
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists ai_work_run_artifacts_service_write on public.ai_work_run_artifacts;
create policy ai_work_run_artifacts_service_write
  on public.ai_work_run_artifacts
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists ai_work_run_delivery_attempts_admin_select on public.ai_work_run_delivery_attempts;
create policy ai_work_run_delivery_attempts_admin_select
  on public.ai_work_run_delivery_attempts
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists ai_work_run_delivery_attempts_service_write on public.ai_work_run_delivery_attempts;
create policy ai_work_run_delivery_attempts_service_write
  on public.ai_work_run_delivery_attempts
  for all
  to service_role
  using (true)
  with check (true);

grant select on
  public.ai_work_run_steps,
  public.ai_work_run_artifacts,
  public.ai_work_run_delivery_attempts
to authenticated;

grant all on
  public.ai_work_run_steps,
  public.ai_work_run_artifacts,
  public.ai_work_run_delivery_attempts
to service_role;

comment on table public.ai_work_run_steps is
  'Step-level execution log for AI workflow runs.';
comment on table public.ai_work_run_artifacts is
  'Inspectable generated and delivered artifacts linked to AI workflow runs.';
comment on table public.ai_work_run_delivery_attempts is
  'Per-channel delivery attempts and provider results for AI workflow runs.';

commit;
