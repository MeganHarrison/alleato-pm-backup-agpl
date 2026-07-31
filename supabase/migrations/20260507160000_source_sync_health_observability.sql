-- Source sync and intelligence health observability.
--
-- Adds a durable control-plane ledger for source sync, vectorization,
-- extraction, compiler, and packet refresh health without changing existing
-- ingestion behavior.

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

create table if not exists public.source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  resource_id text not null default 'default',
  resource_name text,
  stage text not null
    check (
      stage in (
        'source_sync',
        'delta_fetch',
        'webhook',
        'text_extraction',
        'vectorization',
        'task_extraction',
        'intelligence_compile',
        'packet_refresh'
      )
    ),
  status text not null default 'running'
    check (status in ('queued','running','succeeded','failed','skipped','warning')),
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

create table if not exists public.source_sync_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  resource_id text not null default 'default',
  resource_name text,
  status text not null default 'unknown'
    check (status in ('healthy','warning','critical','unknown')),
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

create table if not exists public.graph_subscriptions (
  id uuid primary key default gen_random_uuid(),
  graph_subscription_id text unique,
  resource text not null,
  source text not null,
  resource_id text not null default 'default',
  resource_name text,
  change_type text not null,
  notification_url text,
  client_state_hash text,
  lifecycle_notification_url text,
  status text not null default 'unknown'
    check (status in ('active','renewal_due','expired','removed','failed','unknown')),
  expiration_at timestamptz,
  last_renewed_at timestamptz,
  last_notification_at timestamptz,
  last_lifecycle_event_at timestamptz,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_sync_runs_source_stage_started_idx
  on public.source_sync_runs(source, stage, started_at desc);
create index if not exists source_sync_runs_status_started_idx
  on public.source_sync_runs(status, started_at desc);
create index if not exists source_sync_health_snapshots_status_idx
  on public.source_sync_health_snapshots(status, source);
create index if not exists source_sync_health_snapshots_generated_idx
  on public.source_sync_health_snapshots(generated_at desc);
create index if not exists graph_subscriptions_status_expiration_idx
  on public.graph_subscriptions(status, expiration_at);
create index if not exists graph_subscriptions_source_resource_idx
  on public.graph_subscriptions(source, resource_id);

drop trigger if exists source_sync_runs_set_updated_at
  on public.source_sync_runs;
create trigger source_sync_runs_set_updated_at
  before update on public.source_sync_runs
  for each row execute function public.set_updated_at();

drop trigger if exists source_sync_health_snapshots_set_updated_at
  on public.source_sync_health_snapshots;
create trigger source_sync_health_snapshots_set_updated_at
  before update on public.source_sync_health_snapshots
  for each row execute function public.set_updated_at();

drop trigger if exists graph_subscriptions_set_updated_at
  on public.graph_subscriptions;
create trigger graph_subscriptions_set_updated_at
  before update on public.graph_subscriptions
  for each row execute function public.set_updated_at();

alter table public.source_sync_runs enable row level security;
alter table public.source_sync_health_snapshots enable row level security;
alter table public.graph_subscriptions enable row level security;

drop policy if exists source_sync_runs_admin_select on public.source_sync_runs;
create policy source_sync_runs_admin_select
  on public.source_sync_runs
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists source_sync_runs_service_write on public.source_sync_runs;
create policy source_sync_runs_service_write
  on public.source_sync_runs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists source_sync_health_snapshots_admin_select
  on public.source_sync_health_snapshots;
create policy source_sync_health_snapshots_admin_select
  on public.source_sync_health_snapshots
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists source_sync_health_snapshots_service_write
  on public.source_sync_health_snapshots;
create policy source_sync_health_snapshots_service_write
  on public.source_sync_health_snapshots
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists graph_subscriptions_admin_select on public.graph_subscriptions;
create policy graph_subscriptions_admin_select
  on public.graph_subscriptions
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists graph_subscriptions_service_write on public.graph_subscriptions;
create policy graph_subscriptions_service_write
  on public.graph_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

grant select on
  public.source_sync_runs,
  public.source_sync_health_snapshots,
  public.graph_subscriptions
to authenticated;

grant all on
  public.source_sync_runs,
  public.source_sync_health_snapshots,
  public.graph_subscriptions
to service_role;

comment on table public.source_sync_runs is
  'Append-only run ledger for source sync, vectorization, task extraction, compiler, and packet refresh stages.';
comment on table public.source_sync_health_snapshots is
  'Latest per-source health read model used by admin source sync operations.';
comment on table public.graph_subscriptions is
  'Microsoft Graph webhook subscription inventory and renewal health state.';

commit;
