create table if not exists public.app_error_groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  signature text not null unique,
  source text not null,
  severity text not null default 'medium',
  status text not null default 'new',
  event_count integer not null default 0,
  affected_user_count integer not null default 0,
  affected_project_count integer not null default 0,
  latest_event_id uuid null,
  latest_message text not null,
  latest_route text null,
  latest_action text null,
  latest_error_code text null,
  latest_request_id text null,
  latest_user_id uuid null references public.user_profiles(id) on delete set null,
  latest_project_id integer null references public.projects(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  linear_issue_id text null,
  linear_issue_url text null,
  constraint app_error_groups_source_check
    check (source in ('client', 'api', 'server', 'background', 'sync', 'ai_tool')),
  constraint app_error_groups_severity_check
    check (severity in ('critical', 'high', 'medium', 'low')),
  constraint app_error_groups_status_check
    check (status in ('new', 'triaged', 'in_progress', 'fixed', 'ignored', 'needs_human'))
);

create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  group_id uuid null references public.app_error_groups(id) on delete set null,
  source text not null,
  severity text not null default 'medium',
  user_id uuid null references public.user_profiles(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
  page_url text null,
  page_path text null,
  route text null,
  action text null,
  error_code text null,
  error_message text not null,
  stack text null,
  component_stack text null,
  request_id text null,
  status_code integer null,
  user_agent text null,
  app_version text null,
  release_sha text null,
  fingerprint text not null,
  browser_metadata jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  constraint app_error_events_source_check
    check (source in ('client', 'api', 'server', 'background', 'sync', 'ai_tool')),
  constraint app_error_events_severity_check
    check (severity in ('critical', 'high', 'medium', 'low'))
);

alter table public.app_error_groups
  add constraint app_error_groups_latest_event_fkey
  foreign key (latest_event_id)
  references public.app_error_events(id)
  on delete set null
  deferrable initially deferred;

create index if not exists idx_app_error_events_created_at
  on public.app_error_events (created_at desc);

create index if not exists idx_app_error_events_group_created_at
  on public.app_error_events (group_id, created_at desc);

create index if not exists idx_app_error_events_request_id
  on public.app_error_events (request_id)
  where request_id is not null;

create index if not exists idx_app_error_events_project_id
  on public.app_error_events (project_id, created_at desc)
  where project_id is not null;

create index if not exists idx_app_error_groups_status_last_seen
  on public.app_error_groups (status, last_seen_at desc);

create index if not exists idx_app_error_groups_severity_last_seen
  on public.app_error_groups (severity, last_seen_at desc);

drop trigger if exists set_app_error_groups_updated_at on public.app_error_groups;
create trigger set_app_error_groups_updated_at
  before update on public.app_error_groups
  for each row
  execute function public.update_updated_at_column();

create or replace function public.record_app_error_event(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_group_id uuid;
  v_signature text;
  v_source text;
  v_severity text;
  v_message text;
  v_route text;
  v_action text;
  v_error_code text;
  v_request_id text;
  v_user_id uuid;
  v_project_id integer;
begin
  v_source := coalesce(nullif(payload ->> 'source', ''), 'client');
  v_severity := coalesce(nullif(payload ->> 'severity', ''), 'medium');
  v_message := left(coalesce(nullif(payload ->> 'error_message', ''), 'Unknown application error'), 2000);
  v_route := nullif(payload ->> 'route', '');
  v_action := nullif(payload ->> 'action', '');
  v_error_code := nullif(payload ->> 'error_code', '');
  v_request_id := nullif(payload ->> 'request_id', '');
  v_user_id := nullif(payload ->> 'user_id', '')::uuid;
  v_project_id := nullif(payload ->> 'project_id', '')::integer;

  if v_source not in ('client', 'api', 'server', 'background', 'sync', 'ai_tool') then
    v_source := 'client';
  end if;

  if v_severity not in ('critical', 'high', 'medium', 'low') then
    v_severity := 'medium';
  end if;

  v_signature := coalesce(
    nullif(payload ->> 'fingerprint', ''),
    md5(concat_ws(
      '|',
      v_source,
      coalesce(v_error_code, ''),
      coalesce(v_route, ''),
      coalesce(v_action, ''),
      lower(regexp_replace(v_message, '\s+', ' ', 'g')),
      left(coalesce(payload ->> 'stack', ''), 500)
    ))
  );

  insert into public.app_error_groups (
    signature,
    source,
    severity,
    first_seen_at,
    last_seen_at,
    latest_message,
    latest_route,
    latest_action,
    latest_error_code,
    latest_request_id,
    latest_user_id,
    latest_project_id,
    metadata
  )
  values (
    v_signature,
    v_source,
    v_severity,
    now(),
    now(),
    v_message,
    v_route,
    v_action,
    v_error_code,
    v_request_id,
    v_user_id,
    v_project_id,
    coalesce(payload -> 'group_metadata', '{}'::jsonb)
  )
  on conflict (signature) do update
    set
      last_seen_at = excluded.last_seen_at,
      source = excluded.source,
      severity = case
        when app_error_groups.severity = 'critical' or excluded.severity = 'critical' then 'critical'
        when app_error_groups.severity = 'high' or excluded.severity = 'high' then 'high'
        when app_error_groups.severity = 'medium' or excluded.severity = 'medium' then 'medium'
        else 'low'
      end,
      latest_message = excluded.latest_message,
      latest_route = excluded.latest_route,
      latest_action = excluded.latest_action,
      latest_error_code = excluded.latest_error_code,
      latest_request_id = excluded.latest_request_id,
      latest_user_id = excluded.latest_user_id,
      latest_project_id = excluded.latest_project_id,
      status = case
        when app_error_groups.status in ('fixed', 'ignored') then 'new'
        else app_error_groups.status
      end
  returning id into v_group_id;

  insert into public.app_error_events (
    group_id,
    source,
    severity,
    user_id,
    project_id,
    page_url,
    page_path,
    route,
    action,
    error_code,
    error_message,
    stack,
    component_stack,
    request_id,
    status_code,
    user_agent,
    app_version,
    release_sha,
    fingerprint,
    browser_metadata,
    context
  )
  values (
    v_group_id,
    v_source,
    v_severity,
    v_user_id,
    v_project_id,
    nullif(payload ->> 'page_url', ''),
    nullif(payload ->> 'page_path', ''),
    v_route,
    v_action,
    v_error_code,
    v_message,
    nullif(payload ->> 'stack', ''),
    nullif(payload ->> 'component_stack', ''),
    v_request_id,
    nullif(payload ->> 'status_code', '')::integer,
    nullif(payload ->> 'user_agent', ''),
    nullif(payload ->> 'app_version', ''),
    nullif(payload ->> 'release_sha', ''),
    v_signature,
    coalesce(payload -> 'browser_metadata', '{}'::jsonb),
    coalesce(payload -> 'context', '{}'::jsonb)
  )
  returning id into v_event_id;

  update public.app_error_groups
  set
    latest_event_id = v_event_id,
    event_count = (
      select count(*)
      from public.app_error_events
      where group_id = v_group_id
    ),
    affected_user_count = (
      select count(distinct user_id)
      from public.app_error_events
      where group_id = v_group_id and user_id is not null
    ),
    affected_project_count = (
      select count(distinct project_id)
      from public.app_error_events
      where group_id = v_group_id and project_id is not null
    )
  where id = v_group_id;

  return v_event_id;
end;
$$;

alter table public.app_error_events enable row level security;
alter table public.app_error_groups enable row level security;

drop policy if exists app_error_events_admin_select on public.app_error_events;
create policy app_error_events_admin_select
  on public.app_error_events
  for select
  using (public.current_is_app_admin());

drop policy if exists app_error_groups_admin_select on public.app_error_groups;
create policy app_error_groups_admin_select
  on public.app_error_groups
  for select
  using (public.current_is_app_admin());

drop policy if exists app_error_groups_admin_update on public.app_error_groups;
create policy app_error_groups_admin_update
  on public.app_error_groups
  for update
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

grant execute on function public.record_app_error_event(jsonb) to authenticated, service_role;

comment on table public.app_error_events is
  'Append-only raw application error telemetry captured from client, API, server, sync, and AI tool surfaces.';

comment on table public.app_error_groups is
  'Grouped repair queue for repeated application errors, keyed by stable signature and surfaced to admins.';
