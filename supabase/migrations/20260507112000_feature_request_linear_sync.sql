alter table public.feature_requests
  add column if not exists linear_sync_status text not null default 'not_started'
    check (linear_sync_status in ('not_started', 'drafted', 'created', 'synced', 'blocked')),
  add column if not exists linear_last_synced_at timestamptz null,
  add column if not exists linear_sync_error text null;

create index if not exists idx_feature_requests_linear_sync_status
  on public.feature_requests(linear_sync_status);

create table if not exists public.feature_request_linear_sub_issues (
  id uuid primary key default gen_random_uuid(),
  feature_request_id uuid not null references public.feature_requests(id) on delete cascade,
  implementation_plan_id uuid null references public.implementation_plans(id) on delete set null,
  title text not null,
  body text not null,
  sort_order integer not null default 0,
  source_step text null,
  status text not null default 'draft'
    check (status in ('draft', 'created', 'synced', 'blocked')),
  linear_issue_id text null,
  linear_issue_url text null,
  linear_state text null,
  sync_notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feature_request_linear_sub_issues_request
  on public.feature_request_linear_sub_issues(feature_request_id, sort_order);

create index if not exists idx_feature_request_linear_sub_issues_plan
  on public.feature_request_linear_sub_issues(implementation_plan_id);

create index if not exists idx_feature_request_linear_sub_issues_linear_issue_id
  on public.feature_request_linear_sub_issues(linear_issue_id);

create table if not exists public.feature_request_linear_events (
  id uuid primary key default gen_random_uuid(),
  feature_request_id uuid not null references public.feature_requests(id) on delete cascade,
  sub_issue_id uuid null references public.feature_request_linear_sub_issues(id) on delete cascade,
  linear_issue_id text null,
  event_type text not null,
  title text not null,
  body text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feature_request_linear_events_request
  on public.feature_request_linear_events(feature_request_id, created_at desc);

create index if not exists idx_feature_request_linear_events_sub_issue
  on public.feature_request_linear_events(sub_issue_id, created_at desc);

drop trigger if exists feature_request_linear_sub_issues_set_updated_at on public.feature_request_linear_sub_issues;
create trigger feature_request_linear_sub_issues_set_updated_at
  before update on public.feature_request_linear_sub_issues
  for each row execute function public.set_feature_request_updated_at();

alter table public.feature_request_linear_sub_issues enable row level security;
alter table public.feature_request_linear_events enable row level security;

drop policy if exists feature_request_linear_sub_issues_select on public.feature_request_linear_sub_issues;
create policy feature_request_linear_sub_issues_select
  on public.feature_request_linear_sub_issues
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.feature_requests fr
      where fr.id = feature_request_linear_sub_issues.feature_request_id
        and (fr.project_id is null or public.current_is_project_member(fr.project_id::bigint))
    )
  );

drop policy if exists feature_request_linear_sub_issues_service_write on public.feature_request_linear_sub_issues;
create policy feature_request_linear_sub_issues_service_write
  on public.feature_request_linear_sub_issues
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists feature_request_linear_events_select on public.feature_request_linear_events;
create policy feature_request_linear_events_select
  on public.feature_request_linear_events
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.feature_requests fr
      where fr.id = feature_request_linear_events.feature_request_id
        and (fr.project_id is null or public.current_is_project_member(fr.project_id::bigint))
    )
  );

drop policy if exists feature_request_linear_events_service_write on public.feature_request_linear_events;
create policy feature_request_linear_events_service_write
  on public.feature_request_linear_events
  for all
  to service_role
  using (true)
  with check (true);

comment on column public.feature_requests.linear_sync_status is
  'Packet-side Linear bridge state. Linear remains the work tracker; this records whether the packet has a draft, created issue, synced status, or blocker.';
comment on table public.feature_request_linear_sub_issues is
  'Drafted and attached Linear sub-issues generated from broad implementation plans.';
comment on table public.feature_request_linear_events is
  'Packet-side audit trail for Linear creation, status, comment, and sync events.';
