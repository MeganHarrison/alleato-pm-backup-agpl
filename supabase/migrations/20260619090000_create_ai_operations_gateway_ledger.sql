-- AI operations gateway ledger.
--
-- Phase 1 creates a durable read model for Executive Daily Brief runs without
-- changing the underlying owner-briefing generation or Teams delivery path.

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

create table if not exists public.ai_operation_events (
  id uuid primary key default gen_random_uuid(),
  event_source text not null,
  event_type text not null,
  source_record_id text,
  source_thread_id text,
  source_url text,
  actor_user_id uuid,
  actor_display_name text,
  project_id bigint references public.projects(id) on delete set null,
  delivery_context jsonb not null default '{}'::jsonb,
  permission_context jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received','accepted','ignored','rejected','converted_to_run','failed')),
  idempotency_key text not null,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create table if not exists public.ai_work_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.ai_operation_events(id) on delete set null,
  source_sync_run_id uuid references public.source_sync_runs(id) on delete set null,
  daily_recap_id uuid references public.daily_recaps(id) on delete set null,
  workflow_id text not null,
  trigger_type text not null,
  surface text not null,
  title text not null,
  user_goal text not null default '',
  normalized_goal text not null default '',
  status text not null default 'queued'
    check (
      status in (
        'queued',
        'planning',
        'running',
        'waiting_on_child',
        'needs_user_approval',
        'needs_admin_review',
        'succeeded',
        'partial_success',
        'failed_retryable',
        'failed_permanent',
        'cancelled',
        'expired',
        'skipped'
      )
    ),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  permission_mode text not null default 'service'
    check (permission_mode in ('readonly','service','user_delegated','admin_approved')),
  model_policy jsonb not null default '{}'::jsonb,
  runtime_budget jsonb not null default '{}'::jsonb,
  tool_scope jsonb not null default '{}'::jsonb,
  source_policy jsonb not null default '{}'::jsonb,
  source_counts jsonb not null default '{}'::jsonb,
  result_summary text,
  confidence text check (confidence in ('high','medium','low')),
  delivery_status text check (delivery_status in ('sent','skipped','blocked','failed','disabled','dry_run')),
  delivery_target jsonb not null default '{}'::jsonb,
  failure_code text,
  failure_message text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_work_run_sources (
  id uuid primary key default gen_random_uuid(),
  work_run_id uuid not null references public.ai_work_runs(id) on delete cascade,
  source_family text not null,
  source_record_id text,
  source_title text,
  source_url text,
  source_occurred_at timestamptz,
  evidence_excerpt text,
  confidence text check (confidence in ('high','medium','low')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_operation_events_source_type_created_idx
  on public.ai_operation_events(event_source, event_type, created_at desc);
create index if not exists ai_operation_events_status_created_idx
  on public.ai_operation_events(status, created_at desc);
create index if not exists ai_operation_events_project_created_idx
  on public.ai_operation_events(project_id, created_at desc)
  where project_id is not null;

create index if not exists ai_work_runs_workflow_status_created_idx
  on public.ai_work_runs(workflow_id, status, created_at desc);
create index if not exists ai_work_runs_event_idx
  on public.ai_work_runs(event_id)
  where event_id is not null;
create index if not exists ai_work_runs_source_sync_idx
  on public.ai_work_runs(source_sync_run_id)
  where source_sync_run_id is not null;
create index if not exists ai_work_runs_daily_recap_idx
  on public.ai_work_runs(daily_recap_id)
  where daily_recap_id is not null;

create index if not exists ai_work_run_sources_run_idx
  on public.ai_work_run_sources(work_run_id);
create index if not exists ai_work_run_sources_family_idx
  on public.ai_work_run_sources(source_family, created_at desc);

drop trigger if exists ai_operation_events_set_updated_at
  on public.ai_operation_events;
create trigger ai_operation_events_set_updated_at
  before update on public.ai_operation_events
  for each row execute function public.set_updated_at();

drop trigger if exists ai_work_runs_set_updated_at
  on public.ai_work_runs;
create trigger ai_work_runs_set_updated_at
  before update on public.ai_work_runs
  for each row execute function public.set_updated_at();

alter table public.ai_operation_events enable row level security;
alter table public.ai_work_runs enable row level security;
alter table public.ai_work_run_sources enable row level security;

drop policy if exists ai_operation_events_admin_select on public.ai_operation_events;
create policy ai_operation_events_admin_select
  on public.ai_operation_events
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists ai_operation_events_service_write on public.ai_operation_events;
create policy ai_operation_events_service_write
  on public.ai_operation_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists ai_work_runs_admin_select on public.ai_work_runs;
create policy ai_work_runs_admin_select
  on public.ai_work_runs
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists ai_work_runs_service_write on public.ai_work_runs;
create policy ai_work_runs_service_write
  on public.ai_work_runs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists ai_work_run_sources_admin_select on public.ai_work_run_sources;
create policy ai_work_run_sources_admin_select
  on public.ai_work_run_sources
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists ai_work_run_sources_service_write on public.ai_work_run_sources;
create policy ai_work_run_sources_service_write
  on public.ai_work_run_sources
  for all
  to service_role
  using (true)
  with check (true);

grant select on
  public.ai_operation_events,
  public.ai_work_runs,
  public.ai_work_run_sources
to authenticated;

grant all on
  public.ai_operation_events,
  public.ai_work_runs,
  public.ai_work_run_sources
to service_role;

comment on table public.ai_operation_events is
  'Normalized trigger/event ledger for AI operations workflows.';
comment on table public.ai_work_runs is
  'Top-level AI workflow run ledger linking events, source sync audit rows, recaps, delivery state, policy, and result state.';
comment on table public.ai_work_run_sources is
  'Evidence and source projection rows attached to AI workflow runs.';

commit;
