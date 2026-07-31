begin;

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.project_schedule_calendars
  add column if not exists timezone_name text not null default 'America/Indiana/Indianapolis';

alter table public.schedule_tasks
  add column if not exists work_minutes integer,
  add column if not exists allow_leveling_split boolean not null default true,
  add column if not exists leveling_priority smallint not null default 500,
  add column if not exists schedule_version bigint not null default 1;

do $$
begin
  alter table public.schedule_tasks
    add constraint schedule_tasks_work_minutes_check
    check (work_minutes is null or work_minutes >= 0);
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.schedule_tasks
    add constraint schedule_tasks_leveling_priority_check
    check (leveling_priority between 0 and 1000);
exception when duplicate_object then null;
end;
$$;

create table public.schedule_person_work_calendars (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  timezone_name text not null,
  slot_minutes smallint not null default 15,
  version bigint not null default 1,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_person_work_calendars_person_unique unique(person_id),
  constraint schedule_person_work_calendars_slot_check check(slot_minutes = 15),
  constraint schedule_person_work_calendars_version_check check(version > 0)
);

create table public.schedule_person_work_weekly_intervals (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.schedule_person_work_calendars(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6),
  start_minute smallint not null check(start_minute between 0 and 1439),
  end_minute smallint not null check(end_minute between 1 and 1440),
  capacity_percent smallint not null default 100 check(capacity_percent between 0 and 100),
  created_at timestamptz not null default now(),
  constraint schedule_person_work_weekly_interval_positive check(start_minute < end_minute),
  constraint schedule_person_work_weekly_interval_grid check(start_minute % 15 = 0 and end_minute % 15 = 0),
  constraint schedule_person_work_weekly_interval_unique unique(calendar_id, weekday, start_minute, end_minute),
  constraint schedule_person_work_weekly_interval_no_overlap exclude using gist (
    calendar_id with =,
    weekday with =,
    int4range(start_minute::integer, end_minute::integer, '[)') with &&
  )
);

create table public.schedule_person_work_date_intervals (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.schedule_person_work_calendars(id) on delete cascade,
  local_date date not null,
  start_minute smallint not null check(start_minute between 0 and 1439),
  end_minute smallint not null check(end_minute between 1 and 1440),
  capacity_percent smallint not null default 100 check(capacity_percent between 0 and 100),
  reason text,
  created_at timestamptz not null default now(),
  constraint schedule_person_work_date_interval_positive check(start_minute < end_minute),
  constraint schedule_person_work_date_interval_grid check(start_minute % 15 = 0 and end_minute % 15 = 0),
  constraint schedule_person_work_date_interval_reason_check check(reason is null or char_length(reason) between 1 and 500),
  constraint schedule_person_work_date_interval_unique unique(calendar_id, local_date, start_minute, end_minute),
  constraint schedule_person_work_date_interval_no_overlap exclude using gist (
    calendar_id with =,
    local_date with =,
    int4range(start_minute::integer, end_minute::integer, '[)') with &&
  )
);

create table public.schedule_person_allocation_revisions (
  person_id uuid primary key references public.people(id) on delete cascade,
  version bigint not null default 1 check(version > 0),
  updated_at timestamptz not null default now()
);

create table public.schedule_task_segments (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  task_id uuid not null,
  segment_index integer not null check(segment_index >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  planned_minutes integer not null check(planned_minutes > 0 and planned_minutes % 15 = 0),
  lock_reason text check(lock_reason is null or lock_reason in ('fixed', 'progressed')),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_task_segments_task_project_fkey
    foreign key(task_id, project_id)
    references public.schedule_tasks(id, project_id)
    on delete cascade,
  constraint schedule_task_segments_task_index_unique unique(task_id, segment_index),
  constraint schedule_task_segments_id_project_unique unique(id, project_id),
  constraint schedule_task_segments_positive check(starts_at < ends_at),
  constraint schedule_task_segments_grid check(
    mod(extract(epoch from starts_at)::bigint, 900) = 0
    and mod(extract(epoch from ends_at)::bigint, 900) = 0
  ),
  constraint schedule_task_segments_no_overlap exclude using gist (
    task_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

create table public.schedule_revision_segment_snapshots (
  revision_id uuid not null references public.schedule_revisions(id) on delete cascade,
  source_segment_id uuid not null,
  task_source_id uuid not null,
  segment_index integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  planned_minutes integer not null,
  lock_reason text,
  primary key(revision_id, source_segment_id),
  constraint schedule_revision_segment_task_fkey
    foreign key(revision_id, task_source_id)
    references public.schedule_revision_task_snapshots(revision_id, source_task_id)
    on delete cascade
    deferrable initially deferred
);

create table public.schedule_leveling_runs (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  algorithm_version text not null,
  slot_minutes smallint not null default 15 check(slot_minutes = 15),
  source_token text not null,
  person_revision_vector jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint schedule_leveling_runs_source_token_check check(char_length(source_token) between 16 and 256),
  constraint schedule_leveling_runs_expiry_check check(expires_at > created_at),
  constraint schedule_leveling_runs_person_vector_object check(jsonb_typeof(person_revision_vector) = 'object'),
  constraint schedule_leveling_runs_config_object check(jsonb_typeof(configuration) = 'object'),
  constraint schedule_leveling_runs_diagnostics_array check(jsonb_typeof(diagnostics) = 'array')
);

create table public.schedule_leveling_run_changes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.schedule_leveling_runs(id) on delete cascade,
  project_id integer not null references public.projects(id) on delete cascade,
  task_id uuid not null,
  change_index integer not null check(change_index >= 0),
  expected_task_version bigint not null check(expected_task_version > 0),
  before_state jsonb not null,
  after_state jsonb not null,
  before_state_hash text not null,
  after_state_hash text not null,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint schedule_leveling_run_changes_task_project_fkey
    foreign key(task_id, project_id)
    references public.schedule_tasks(id, project_id)
    on delete restrict,
  constraint schedule_leveling_run_changes_run_task_unique unique(run_id, task_id),
  constraint schedule_leveling_run_changes_run_index_unique unique(run_id, change_index),
  constraint schedule_leveling_run_changes_before_object check(jsonb_typeof(before_state) = 'object'),
  constraint schedule_leveling_run_changes_after_object check(jsonb_typeof(after_state) = 'object'),
  constraint schedule_leveling_run_changes_reasons_array check(jsonb_typeof(reasons) = 'array')
);

create table public.schedule_leveling_events (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.schedule_leveling_runs(id) on delete restrict,
  event_type text not null check(event_type in ('applied', 'undone')),
  related_event_id uuid references public.schedule_leveling_events(id) on delete restrict,
  source_revision_id uuid not null references public.schedule_revisions(id) on delete restrict,
  target_revision_id uuid not null references public.schedule_revisions(id) on delete restrict,
  before_state_hash text not null,
  after_state_hash text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  constraint schedule_leveling_events_reason_check check(reason is null or char_length(reason) between 1 and 1000),
  constraint schedule_leveling_events_apply_related_check check(
    (event_type = 'applied' and related_event_id is null)
    or (event_type = 'undone' and related_event_id is not null)
  )
);

create unique index schedule_leveling_events_one_apply_per_run
  on public.schedule_leveling_events(run_id)
  where event_type = 'applied';
create unique index schedule_leveling_events_one_undo_per_apply
  on public.schedule_leveling_events(related_event_id)
  where event_type = 'undone';
create index schedule_person_work_weekly_calendar_idx
  on public.schedule_person_work_weekly_intervals(calendar_id, weekday, start_minute);
create index schedule_person_work_date_calendar_idx
  on public.schedule_person_work_date_intervals(calendar_id, local_date, start_minute);
create index schedule_task_segments_project_task_idx
  on public.schedule_task_segments(project_id, task_id, segment_index);
create index schedule_task_segments_task_time_idx
  on public.schedule_task_segments(task_id, starts_at, ends_at);
create index schedule_revision_segment_task_idx
  on public.schedule_revision_segment_snapshots(revision_id, task_source_id, segment_index);
create index schedule_leveling_runs_project_created_idx
  on public.schedule_leveling_runs(project_id, created_at desc);
create index schedule_leveling_run_changes_run_idx
  on public.schedule_leveling_run_changes(run_id, change_index);
create index schedule_leveling_events_project_created_idx
  on public.schedule_leveling_events(project_id, created_at desc);

create trigger schedule_person_work_calendars_set_updated_at
before update on public.schedule_person_work_calendars
for each row execute function public.update_updated_at_column();
create trigger schedule_task_segments_set_updated_at
before update on public.schedule_task_segments
for each row execute function public.update_updated_at_column();

alter table public.schedule_person_work_calendars enable row level security;
alter table public.schedule_person_work_weekly_intervals enable row level security;
alter table public.schedule_person_work_date_intervals enable row level security;
alter table public.schedule_person_allocation_revisions enable row level security;
alter table public.schedule_task_segments enable row level security;
alter table public.schedule_revision_segment_snapshots enable row level security;
alter table public.schedule_leveling_runs enable row level security;
alter table public.schedule_leveling_run_changes enable row level security;
alter table public.schedule_leveling_events enable row level security;

revoke all on public.schedule_person_work_calendars,
  public.schedule_person_work_weekly_intervals,
  public.schedule_person_work_date_intervals,
  public.schedule_person_allocation_revisions,
  public.schedule_task_segments,
  public.schedule_revision_segment_snapshots,
  public.schedule_leveling_runs,
  public.schedule_leveling_run_changes,
  public.schedule_leveling_events
  from public, anon, authenticated, service_role;

grant select on public.schedule_person_work_calendars,
  public.schedule_person_work_weekly_intervals,
  public.schedule_person_work_date_intervals,
  public.schedule_person_allocation_revisions,
  public.schedule_task_segments,
  public.schedule_revision_segment_snapshots,
  public.schedule_leveling_runs,
  public.schedule_leveling_run_changes,
  public.schedule_leveling_events
  to authenticated;

grant all on public.schedule_person_work_calendars,
  public.schedule_person_work_weekly_intervals,
  public.schedule_person_work_date_intervals,
  public.schedule_person_allocation_revisions,
  public.schedule_task_segments
  to service_role;
grant select on public.schedule_revision_segment_snapshots,
  public.schedule_leveling_runs,
  public.schedule_leveling_run_changes,
  public.schedule_leveling_events
  to service_role;

create policy schedule_person_work_calendars_member_read
on public.schedule_person_work_calendars for select to authenticated
using (
  public.current_is_app_admin()
  or exists (
    select 1 from public.schedule_resources resource
    where resource.person_id = schedule_person_work_calendars.person_id
      and public.current_is_project_member(resource.project_id::bigint)
  )
);

create policy schedule_person_work_weekly_member_read
on public.schedule_person_work_weekly_intervals for select to authenticated
using (exists (
  select 1 from public.schedule_person_work_calendars calendar
  where calendar.id = schedule_person_work_weekly_intervals.calendar_id
    and (
      public.current_is_app_admin()
      or exists (
        select 1 from public.schedule_resources resource
        where resource.person_id = calendar.person_id
          and public.current_is_project_member(resource.project_id::bigint)
      )
    )
));

create policy schedule_person_work_date_member_read
on public.schedule_person_work_date_intervals for select to authenticated
using (exists (
  select 1 from public.schedule_person_work_calendars calendar
  where calendar.id = schedule_person_work_date_intervals.calendar_id
    and (
      public.current_is_app_admin()
      or exists (
        select 1 from public.schedule_resources resource
        where resource.person_id = calendar.person_id
          and public.current_is_project_member(resource.project_id::bigint)
      )
    )
));

create policy schedule_person_allocation_revisions_member_read
on public.schedule_person_allocation_revisions for select to authenticated
using (
  public.current_is_app_admin()
  or exists (
    select 1 from public.schedule_resources resource
    where resource.person_id = schedule_person_allocation_revisions.person_id
      and public.current_is_project_member(resource.project_id::bigint)
  )
);

create policy schedule_task_segments_project_member_read
on public.schedule_task_segments for select to authenticated
using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));

create policy schedule_revision_segments_project_member_read
on public.schedule_revision_segment_snapshots for select to authenticated
using (exists (
  select 1 from public.schedule_revisions revision
  where revision.id = schedule_revision_segment_snapshots.revision_id
    and (public.current_is_app_admin() or public.current_is_project_member(revision.project_id::bigint))
));

create policy schedule_leveling_runs_project_member_read
on public.schedule_leveling_runs for select to authenticated
using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));

create policy schedule_leveling_run_changes_project_member_read
on public.schedule_leveling_run_changes for select to authenticated
using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));

create policy schedule_leveling_events_project_member_read
on public.schedule_leveling_events for select to authenticated
using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));

create or replace function private.bump_person_allocation_revision(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_person_id is null then return; end if;
  insert into public.schedule_person_allocation_revisions(person_id, version, updated_at)
  values (p_person_id, 1, now())
  on conflict(person_id) do update
  set version = public.schedule_person_allocation_revisions.version + 1,
      updated_at = now();
end;
$$;

create or replace function private.bump_assignment_person_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person_id uuid;
begin
  select person_id into v_person_id
  from public.schedule_resources
  where id = coalesce(new.resource_id, old.resource_id);
  perform private.bump_person_allocation_revision(v_person_id);
  return coalesce(new, old);
end;
$$;

create or replace function private.bump_task_people_revisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid := coalesce(new.task_id, old.task_id);
  v_person_id uuid;
begin
  for v_person_id in
    select resource.person_id
    from public.schedule_task_assignments assignment
    join public.schedule_resources resource on resource.id = assignment.resource_id
    where assignment.task_id = v_task_id
    order by resource.person_id
  loop
    perform private.bump_person_allocation_revision(v_person_id);
  end loop;
  return coalesce(new, old);
end;
$$;

create or replace function private.bump_schedule_task_people_revisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person_id uuid;
begin
  for v_person_id in
    select resource.person_id
    from public.schedule_task_assignments assignment
    join public.schedule_resources resource on resource.id = assignment.resource_id
    where assignment.task_id = coalesce(new.id, old.id)
    order by resource.person_id
  loop
    perform private.bump_person_allocation_revision(v_person_id);
  end loop;
  return coalesce(new, old);
end;
$$;

create or replace function private.bump_schedule_task_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.start_date, new.finish_date, new.forecast_start_date, new.forecast_finish_date,
    new.actual_start_date, new.actual_finish_date, new.duration_days,
    new.remaining_duration_days, new.percent_complete, new.status,
    new.constraint_type, new.constraint_date, new.work_minutes,
    new.allow_leveling_split, new.leveling_priority
  ) is distinct from row(
    old.start_date, old.finish_date, old.forecast_start_date, old.forecast_finish_date,
    old.actual_start_date, old.actual_finish_date, old.duration_days,
    old.remaining_duration_days, old.percent_complete, old.status,
    old.constraint_type, old.constraint_date, old.work_minutes,
    old.allow_leveling_split, old.leveling_priority
  ) and new.schedule_version = old.schedule_version then
    new.schedule_version := old.schedule_version + 1;
  end if;
  return new;
end;
$$;

create trigger schedule_tasks_bump_schedule_version
before update on public.schedule_tasks
for each row execute function private.bump_schedule_task_version();

create trigger schedule_task_assignments_bump_person_revision
after insert or update or delete on public.schedule_task_assignments
for each row execute function private.bump_assignment_person_revision();

create trigger schedule_task_segments_bump_person_revision
after insert or update or delete on public.schedule_task_segments
for each row execute function private.bump_task_people_revisions();

create trigger schedule_tasks_bump_person_revision
after update of start_date, finish_date, forecast_start_date, forecast_finish_date,
  actual_start_date, actual_finish_date, duration_days, remaining_duration_days,
  percent_complete, status, constraint_type, constraint_date, work_minutes,
  allow_leveling_split, leveling_priority
on public.schedule_tasks
for each row execute function private.bump_schedule_task_people_revisions();

create or replace function private.capture_schedule_revision_segments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_count integer;
  v_inserted_count integer;
begin
  lock table public.schedule_task_segments in share mode;
  select count(*) into v_source_count
  from public.schedule_task_segments segment
  where segment.project_id = new.project_id;

  insert into public.schedule_revision_segment_snapshots(
    revision_id, source_segment_id, task_source_id, segment_index,
    starts_at, ends_at, planned_minutes, lock_reason
  )
  select
    new.id, segment.id, segment.task_id, segment.segment_index,
    segment.starts_at, segment.ends_at, segment.planned_minutes, segment.lock_reason
  from public.schedule_task_segments segment
  where segment.project_id = new.project_id
  order by segment.task_id, segment.segment_index;
  get diagnostics v_inserted_count = row_count;

  if v_inserted_count <> v_source_count then
    raise exception 'Schedule segment snapshot count mismatch.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger schedule_revisions_capture_segments
after insert on public.schedule_revisions
for each row execute function private.capture_schedule_revision_segments();

create trigger schedule_revision_segment_snapshots_immutable
before update or delete on public.schedule_revision_segment_snapshots
for each row execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_revision_segment_snapshots_no_truncate
before truncate on public.schedule_revision_segment_snapshots
for each statement execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_leveling_runs_immutable
before update or delete on public.schedule_leveling_runs
for each row execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_leveling_runs_no_truncate
before truncate on public.schedule_leveling_runs
for each statement execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_leveling_run_changes_immutable
before update or delete on public.schedule_leveling_run_changes
for each row execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_leveling_run_changes_no_truncate
before truncate on public.schedule_leveling_run_changes
for each statement execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_leveling_events_immutable
before update or delete on public.schedule_leveling_events
for each row execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_leveling_events_no_truncate
before truncate on public.schedule_leveling_events
for each statement execute function public.reject_schedule_snapshot_mutation();

create or replace function private.schedule_state_hash_from_payload(p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function private.schedule_task_hourly_state(p_task_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'task', jsonb_build_object(
      'start_date', task.start_date,
      'finish_date', task.finish_date,
      'forecast_start_date', task.forecast_start_date,
      'forecast_finish_date', task.forecast_finish_date,
      'work_minutes', task.work_minutes,
      'allow_leveling_split', task.allow_leveling_split,
      'leveling_priority', task.leveling_priority
    ),
    'segments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'segment_index', segment.segment_index,
        'starts_at', segment.starts_at,
        'ends_at', segment.ends_at,
        'planned_minutes', segment.planned_minutes,
        'lock_reason', segment.lock_reason
      ) order by segment.segment_index)
      from public.schedule_task_segments segment
      where segment.task_id = task.id
    ), '[]'::jsonb)
  )
  from public.schedule_tasks task
  where task.id = p_task_id;
$$;

create or replace function private.schedule_task_hourly_state_hash(p_task_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.schedule_state_hash_from_payload(private.schedule_task_hourly_state(p_task_id));
$$;

create or replace function private.canonical_schedule_hourly_state(p_payload jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'task', jsonb_build_object(
      'start_date', p_payload #> '{task,start_date}',
      'finish_date', p_payload #> '{task,finish_date}',
      'forecast_start_date', p_payload #> '{task,forecast_start_date}',
      'forecast_finish_date', p_payload #> '{task,forecast_finish_date}',
      'work_minutes', p_payload #> '{task,work_minutes}',
      'allow_leveling_split', coalesce(p_payload #> '{task,allow_leveling_split}', 'true'::jsonb),
      'leveling_priority', coalesce(p_payload #> '{task,leveling_priority}', '500'::jsonb)
    ),
    'segments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'segment_index', (segment->>'segment_index')::integer,
        'starts_at', (segment->>'starts_at')::timestamptz,
        'ends_at', (segment->>'ends_at')::timestamptz,
        'planned_minutes', (segment->>'planned_minutes')::integer,
        'lock_reason', nullif(segment->>'lock_reason', '')
      ) order by (segment->>'segment_index')::integer)
      from jsonb_array_elements(coalesce(p_payload->'segments', '[]'::jsonb)) segment
    ), '[]'::jsonb)
  );
$$;

create or replace function private.schedule_project_leveling_source_token(p_project_id integer)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.schedule_state_hash_from_payload(jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(to_jsonb(task) order by task.id)
      from public.schedule_tasks task where task.project_id = p_project_id), '[]'::jsonb),
    'dependencies', coalesce((select jsonb_agg(to_jsonb(dependency) order by dependency.id)
      from public.schedule_dependencies dependency
      join public.schedule_tasks task on task.id = dependency.task_id
      where task.project_id = p_project_id), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(to_jsonb(assignment) order by assignment.id)
      from public.schedule_task_assignments assignment where assignment.project_id = p_project_id), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(to_jsonb(resource) order by resource.id)
      from public.schedule_resources resource where resource.project_id = p_project_id), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(to_jsonb(segment) order by segment.task_id, segment.segment_index)
      from public.schedule_task_segments segment where segment.project_id = p_project_id), '[]'::jsonb),
    'project_calendar', coalesce((select to_jsonb(calendar)
      from public.project_schedule_calendars calendar where calendar.project_id = p_project_id), '{}'::jsonb),
    'project_calendar_exceptions', coalesce((select jsonb_agg(to_jsonb(exception) order by exception.exception_date)
      from public.project_schedule_calendar_exceptions exception where exception.project_id = p_project_id), '[]'::jsonb),
    'capacity_profiles', coalesce((select jsonb_agg(to_jsonb(profile) order by profile.resource_id)
      from public.schedule_resource_capacity_profiles profile where profile.project_id = p_project_id), '[]'::jsonb),
    'capacity_weekdays', coalesce((select jsonb_agg(to_jsonb(weekday) order by weekday.resource_id, weekday.weekday)
      from public.schedule_resource_weekday_capacity_overrides weekday where weekday.project_id = p_project_id), '[]'::jsonb),
    'capacity_exceptions', coalesce((select jsonb_agg(to_jsonb(exception) order by exception.resource_id, exception.exception_date)
      from public.schedule_resource_capacity_exceptions exception where exception.project_id = p_project_id), '[]'::jsonb),
    'person_revisions', coalesce((
      select jsonb_object_agg(resource.person_id::text, coalesce(revision.version, 0))
      from public.schedule_resources resource
      left join public.schedule_person_allocation_revisions revision on revision.person_id = resource.person_id
      where resource.project_id = p_project_id
    ), '{}'::jsonb)
  ));
$$;

revoke all on function private.bump_person_allocation_revision(uuid),
  private.bump_assignment_person_revision(),
  private.bump_task_people_revisions(),
  private.bump_schedule_task_people_revisions(),
  private.bump_schedule_task_version(),
  private.capture_schedule_revision_segments(),
  private.schedule_state_hash_from_payload(jsonb),
  private.schedule_task_hourly_state(uuid),
  private.schedule_task_hourly_state_hash(uuid),
  private.canonical_schedule_hourly_state(jsonb),
  private.schedule_project_leveling_source_token(integer)
  from public, anon, authenticated, service_role;

create or replace function public.replace_schedule_person_work_calendar(
  p_project_id integer,
  p_person_id uuid,
  p_timezone_name text,
  p_weekly_intervals jsonb,
  p_date_intervals jsonb,
  p_expected_version bigint default null
)
returns public.schedule_person_work_calendars
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_calendar public.schedule_person_work_calendars;
  v_existing boolean := false;
  v_item jsonb;
begin
  if v_actor is null or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'You do not have permission to manage this project schedule.' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.schedule_resources resource
    join public.people person on person.id = resource.person_id
    join public.project_directory_memberships membership
      on membership.project_id = resource.project_id and membership.person_id = resource.person_id
    where resource.project_id = p_project_id
      and resource.person_id = p_person_id
      and person.status = 'active'
      and membership.status = 'active'
  ) then
    raise exception 'The person must be an active schedule resource in this project.' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone_name) then
    raise exception 'The person work calendar timezone is invalid.' using errcode = '22023';
  end if;
  if p_weekly_intervals is null or jsonb_typeof(p_weekly_intervals) <> 'array'
     or p_date_intervals is null or jsonb_typeof(p_date_intervals) <> 'array' then
    raise exception 'Weekly and dated work intervals must be JSON arrays.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_weekly_intervals) > 100
     or jsonb_array_length(p_date_intervals) > 2000 then
    raise exception 'The person work calendar exceeds the supported interval limit.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_person_id::text, 9173));
  select * into v_calendar
  from public.schedule_person_work_calendars
  where person_id = p_person_id
  for update;
  v_existing := found;

  if v_existing and p_expected_version is distinct from v_calendar.version then
    raise exception 'The person work calendar changed after it was loaded.' using errcode = '40001';
  elsif not v_existing and p_expected_version is not null then
    raise exception 'The person work calendar no longer matches the requested version.' using errcode = '40001';
  end if;

  if not v_existing then
    insert into public.schedule_person_work_calendars(
      person_id, timezone_name, created_by_user_id, updated_by_user_id
    ) values (
      p_person_id, p_timezone_name, v_actor, v_actor
    ) returning * into v_calendar;
  else
    update public.schedule_person_work_calendars
    set timezone_name = p_timezone_name,
        version = version + 1,
        updated_by_user_id = v_actor,
        updated_at = now()
    where id = v_calendar.id
    returning * into v_calendar;
  end if;

  delete from public.schedule_person_work_weekly_intervals where calendar_id = v_calendar.id;
  for v_item in select value from jsonb_array_elements(p_weekly_intervals) loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['weekday', 'start_minute', 'end_minute', 'capacity_percent']) then
      raise exception 'Every weekly interval requires weekday, start_minute, end_minute, and capacity_percent.' using errcode = '22023';
    end if;
    begin
      insert into public.schedule_person_work_weekly_intervals(
        calendar_id, weekday, start_minute, end_minute, capacity_percent
      ) values (
        v_calendar.id,
        (v_item->>'weekday')::smallint,
        (v_item->>'start_minute')::smallint,
        (v_item->>'end_minute')::smallint,
        (v_item->>'capacity_percent')::smallint
      );
    exception
      when invalid_text_representation or numeric_value_out_of_range or check_violation or exclusion_violation or unique_violation then
        raise exception 'Weekly work intervals must be unique, non-overlapping same-day 15-minute ranges with capacity from 0 through 100.' using errcode = '22023';
    end;
  end loop;

  delete from public.schedule_person_work_date_intervals where calendar_id = v_calendar.id;
  for v_item in select value from jsonb_array_elements(p_date_intervals) loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['local_date', 'start_minute', 'end_minute', 'capacity_percent']) then
      raise exception 'Every dated interval requires local_date, start_minute, end_minute, and capacity_percent.' using errcode = '22023';
    end if;
    begin
      insert into public.schedule_person_work_date_intervals(
        calendar_id, local_date, start_minute, end_minute, capacity_percent, reason
      ) values (
        v_calendar.id,
        (v_item->>'local_date')::date,
        (v_item->>'start_minute')::smallint,
        (v_item->>'end_minute')::smallint,
        (v_item->>'capacity_percent')::smallint,
        nullif(btrim(v_item->>'reason'), '')
      );
    exception
      when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range
        or check_violation or exclusion_violation or unique_violation then
        raise exception 'Dated work intervals must be unique, non-overlapping same-day 15-minute ranges with a valid date and capacity.' using errcode = '22023';
    end;
  end loop;

  perform private.bump_person_allocation_revision(p_person_id);
  return v_calendar;
end;
$$;

create or replace function public.replace_schedule_task_segments(
  p_project_id integer,
  p_task_id uuid,
  p_segments jsonb,
  p_expected_task_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.schedule_tasks;
  v_item jsonb;
  v_count integer;
  v_timezone text;
  v_min_start timestamptz;
  v_max_finish timestamptz;
  v_work_minutes integer;
begin
  if v_actor is null or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'You do not have permission to manage this project schedule.' using errcode = '42501';
  end if;
  if p_segments is null or jsonb_typeof(p_segments) <> 'array' then
    raise exception 'Task segments must be a JSON array.' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_segments);
  if v_count > 1000 then
    raise exception 'A task cannot contain more than 1000 schedule segments.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(17419, p_project_id);
  select * into v_task
  from public.schedule_tasks
  where id = p_task_id and project_id = p_project_id
  for update;
  if not found then raise exception 'Schedule task not found in this project.' using errcode = 'P0002'; end if;
  if v_task.schedule_version is distinct from p_expected_task_version then
    raise exception 'The schedule task changed after it was loaded.' using errcode = '40001';
  end if;
  if coalesce(v_task.percent_complete, 0) > 0
     or v_task.status in ('in_progress', 'complete')
     or v_task.actual_start_date is not null
     or v_task.actual_finish_date is not null then
    raise exception 'Progressed or actual-dated task segments cannot be replaced.' using errcode = '55000';
  end if;

  if v_count > 0 and (
    select count(distinct (value->>'segment_index')::integer) <> v_count
      or min((value->>'segment_index')::integer) <> 0
      or max((value->>'segment_index')::integer) <> v_count - 1
    from jsonb_array_elements(p_segments)
  ) then
    raise exception 'Task segment indexes must be unique and contiguous from zero.' using errcode = '22023';
  end if;

  delete from public.schedule_task_segments where task_id = p_task_id;
  for v_item in select value from jsonb_array_elements(p_segments) order by (value->>'segment_index')::integer loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['segment_index', 'starts_at', 'ends_at', 'planned_minutes']) then
      raise exception 'Every task segment requires segment_index, starts_at, ends_at, and planned_minutes.' using errcode = '22023';
    end if;
    begin
      insert into public.schedule_task_segments(
        project_id, task_id, segment_index, starts_at, ends_at, planned_minutes,
        lock_reason, created_by_user_id, updated_by_user_id
      ) values (
        p_project_id,
        p_task_id,
        (v_item->>'segment_index')::integer,
        (v_item->>'starts_at')::timestamptz,
        (v_item->>'ends_at')::timestamptz,
        (v_item->>'planned_minutes')::integer,
        nullif(v_item->>'lock_reason', ''),
        v_actor,
        v_actor
      );
    exception
      when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range
        or check_violation or exclusion_violation or unique_violation then
        raise exception 'Task segments must be ordered, non-overlapping positive 15-minute intervals.' using errcode = '22023';
    end;
  end loop;

  if v_count > 0 then
    select min(starts_at), max(ends_at), sum(planned_minutes)::integer
    into v_min_start, v_max_finish, v_work_minutes
    from public.schedule_task_segments
    where task_id = p_task_id;
    select coalesce(calendar.timezone_name, 'America/Indiana/Indianapolis')
    into v_timezone
    from (select 1) seed
    left join public.project_schedule_calendars calendar on calendar.project_id = p_project_id;

    update public.schedule_tasks
    set start_date = (v_min_start at time zone v_timezone)::date,
        finish_date = (v_max_finish at time zone v_timezone)::date,
        work_minutes = v_work_minutes,
        schedule_version = schedule_version + 1,
        updated_at = now()
    where id = p_task_id;
  else
    update public.schedule_tasks
    set work_minutes = null,
        schedule_version = schedule_version + 1,
        updated_at = now()
    where id = p_task_id;
  end if;

  return jsonb_build_object(
    'task_id', p_task_id,
    'task_version', (select schedule_version from public.schedule_tasks where id = p_task_id),
    'state', private.schedule_task_hourly_state(p_task_id)
  );
end;
$$;

create or replace function public.get_schedule_enterprise_capacity(
  p_project_id integer,
  p_person_ids uuid[],
  p_range_start timestamptz,
  p_range_finish timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to view this project schedule.' using errcode = '42501';
  end if;
  if p_range_start is null or p_range_finish is null or p_range_finish <= p_range_start then
    raise exception 'Enterprise capacity requires an ascending timestamp range.' using errcode = '22023';
  end if;
  if p_range_finish > p_range_start + interval '92 days' then
    raise exception 'Enterprise capacity reads cannot exceed 92 calendar days.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_person_ids, 1), 0) > 100 then
    raise exception 'Enterprise capacity reads cannot exceed 100 people.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_person_ids, array[]::uuid[])) person_id
    where not exists (
      select 1 from public.schedule_resources resource
      where resource.project_id = p_project_id and resource.person_id = person_id
    )
  ) then
    raise exception 'Enterprise capacity can be requested only for resources in this project.' using errcode = '22023';
  end if;

  with requested_people as (
    select unnest(coalesce(p_person_ids, array[]::uuid[])) person_id
  ), reservations as (
    select
      resource.person_id,
      assignment.project_id,
      assignment.task_id,
      project.name as project_name,
      task.name as task_name,
      segment.starts_at,
      segment.ends_at,
      assignment.allocation_percent
    from requested_people requested
    join public.schedule_resources resource on resource.person_id = requested.person_id
    join public.schedule_task_assignments assignment on assignment.resource_id = resource.id
    join public.schedule_tasks task on task.id = assignment.task_id
    join public.projects project on project.id = assignment.project_id
    join public.schedule_task_segments segment on segment.task_id = task.id
    where segment.starts_at < p_range_finish and segment.ends_at > p_range_start

    union all

    select
      resource.person_id,
      assignment.project_id,
      assignment.task_id,
      project.name as project_name,
      task.name as task_name,
      ((coalesce(task.forecast_start_date, task.start_date) + time '08:00') at time zone
        coalesce(calendar.timezone_name, 'America/Indiana/Indianapolis')) as starts_at,
      ((coalesce(task.forecast_finish_date, task.finish_date) + time '17:00') at time zone
        coalesce(calendar.timezone_name, 'America/Indiana/Indianapolis')) as ends_at,
      assignment.allocation_percent
    from requested_people requested
    join public.schedule_resources resource on resource.person_id = requested.person_id
    join public.schedule_task_assignments assignment on assignment.resource_id = resource.id
    join public.schedule_tasks task on task.id = assignment.task_id
    join public.projects project on project.id = assignment.project_id
    left join public.project_schedule_calendars calendar on calendar.project_id = assignment.project_id
    where coalesce(task.forecast_start_date, task.start_date) is not null
      and coalesce(task.forecast_finish_date, task.finish_date) is not null
      and not exists (select 1 from public.schedule_task_segments segment where segment.task_id = task.id)
      and ((coalesce(task.forecast_start_date, task.start_date) + time '08:00') at time zone
        coalesce(calendar.timezone_name, 'America/Indiana/Indianapolis')) < p_range_finish
      and ((coalesce(task.forecast_finish_date, task.finish_date) + time '17:00') at time zone
        coalesce(calendar.timezone_name, 'America/Indiana/Indianapolis')) > p_range_start
  )
  select jsonb_build_object(
    'project_id', p_project_id,
    'source_token', private.schedule_project_leveling_source_token(p_project_id),
    'range', jsonb_build_object('start', p_range_start, 'finish', p_range_finish),
    'person_revisions', coalesce((
      select jsonb_object_agg(requested.person_id::text, coalesce(revision.version, 0))
      from requested_people requested
      left join public.schedule_person_allocation_revisions revision on revision.person_id = requested.person_id
    ), '{}'::jsonb),
    'calendars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'person_id', requested.person_id,
        'calendar_id', calendar.id,
        'timezone_name', coalesce(calendar.timezone_name, project_calendar.timezone_name, 'America/Indiana/Indianapolis'),
        'slot_minutes', coalesce(calendar.slot_minutes, 15),
        'version', calendar.version,
        'weekly_intervals', coalesce((
          select jsonb_agg(to_jsonb(weekly) - 'id' - 'calendar_id' - 'created_at'
            order by weekly.weekday, weekly.start_minute)
          from public.schedule_person_work_weekly_intervals weekly
          where weekly.calendar_id = calendar.id
        ), '[]'::jsonb),
        'date_intervals', coalesce((
          select jsonb_agg(to_jsonb(dated) - 'id' - 'calendar_id' - 'created_at'
            order by dated.local_date, dated.start_minute)
          from public.schedule_person_work_date_intervals dated
          where dated.calendar_id = calendar.id
            and dated.local_date between (p_range_start at time zone coalesce(calendar.timezone_name, project_calendar.timezone_name, 'America/Indiana/Indianapolis'))::date
              and (p_range_finish at time zone coalesce(calendar.timezone_name, project_calendar.timezone_name, 'America/Indiana/Indianapolis'))::date
        ), '[]'::jsonb)
      ) order by requested.person_id)
      from requested_people requested
      left join public.schedule_person_work_calendars calendar on calendar.person_id = requested.person_id
      left join public.project_schedule_calendars project_calendar on project_calendar.project_id = p_project_id
    ), '[]'::jsonb),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'person_id', reservation.person_id,
        'project_id', case when public.current_is_app_admin() or public.current_is_project_member(reservation.project_id::bigint) then reservation.project_id else null end,
        'task_id', case when public.current_is_app_admin() or public.current_is_project_member(reservation.project_id::bigint) then reservation.task_id else null end,
        'project_name', case when public.current_is_app_admin() or public.current_is_project_member(reservation.project_id::bigint) then reservation.project_name else null end,
        'task_name', case when public.current_is_app_admin() or public.current_is_project_member(reservation.project_id::bigint) then reservation.task_name else null end,
        'redacted', not (public.current_is_app_admin() or public.current_is_project_member(reservation.project_id::bigint)),
        'starts_at', reservation.starts_at,
        'ends_at', reservation.ends_at,
        'allocation_percent', reservation.allocation_percent
      ) order by reservation.person_id, reservation.starts_at, reservation.project_id, reservation.task_id)
      from reservations reservation
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function private.assert_schedule_person_revision_vector(p_vector jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_person_text text;
  v_expected_text text;
  v_person_id uuid;
  v_expected bigint;
  v_actual bigint;
begin
  if p_vector is null or jsonb_typeof(p_vector) <> 'object' then
    raise exception 'The person revision vector must be a JSON object.' using errcode = '22023';
  end if;
  for v_person_text, v_expected_text in select key, value from jsonb_each_text(p_vector) loop
    begin
      v_person_id := v_person_text::uuid;
      v_expected := v_expected_text::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'The person revision vector contains an invalid entry.' using errcode = '22023';
    end;
    select coalesce(revision.version, 0) into v_actual
    from (select v_person_id person_id) person
    left join public.schedule_person_allocation_revisions revision on revision.person_id = person.person_id;
    if v_actual is distinct from v_expected then
      raise exception 'Enterprise resource allocations changed after the leveling preview.' using errcode = '40001';
    end if;
  end loop;
end;
$$;

create or replace function public.create_schedule_leveling_run(
  p_project_id integer,
  p_algorithm_version text,
  p_source_token text,
  p_person_revision_vector jsonb,
  p_configuration jsonb,
  p_diagnostics jsonb,
  p_changes jsonb,
  p_expires_at timestamptz default (now() + interval '30 minutes')
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.schedule_leveling_runs;
  v_task public.schedule_tasks;
  v_item jsonb;
  v_after_state jsonb;
  v_before_state jsonb;
  v_change_index integer := 0;
  v_segment_count integer;
begin
  if v_actor is null or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'You do not have permission to manage this project schedule.' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array'
     or p_diagnostics is null or jsonb_typeof(p_diagnostics) <> 'array'
     or p_configuration is null or jsonb_typeof(p_configuration) <> 'object' then
    raise exception 'Leveling changes and diagnostics must be arrays and configuration must be an object.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) > 1000 then
    raise exception 'A leveling run cannot change more than 1000 tasks.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_algorithm_version, '')) not between 1 and 100
     or char_length(coalesce(p_source_token, '')) not between 16 and 256 then
    raise exception 'The leveling algorithm version or source token is invalid.' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '24 hours' then
    raise exception 'A leveling run must expire within the next 24 hours.' using errcode = '22023';
  end if;
  if (
    select count(distinct (value->>'task_id')::uuid)
    from jsonb_array_elements(p_changes)
  ) <> jsonb_array_length(p_changes) then
    raise exception 'A leveling run can change each task only once.' using errcode = '23505';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(17419, p_project_id);
  perform private.assert_schedule_person_revision_vector(p_person_revision_vector);
  if private.schedule_project_leveling_source_token(p_project_id) is distinct from p_source_token then
    raise exception 'The project schedule changed after the leveling preview was calculated.' using errcode = '40001';
  end if;

  insert into public.schedule_leveling_runs(
    project_id, algorithm_version, source_token, person_revision_vector,
    configuration, diagnostics, expires_at, created_by_user_id
  ) values (
    p_project_id, p_algorithm_version, p_source_token, p_person_revision_vector,
    p_configuration, p_diagnostics, p_expires_at, v_actor
  ) returning * into v_run;

  for v_item in select value from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['task_id', 'expected_task_version', 'after_state']) then
      raise exception 'Every leveling change requires task_id, expected_task_version, and after_state.' using errcode = '22023';
    end if;
    begin
      select * into v_task
      from public.schedule_tasks
      where id = (v_item->>'task_id')::uuid and project_id = p_project_id;
    exception when invalid_text_representation then
      raise exception 'A leveling change contains an invalid task_id.' using errcode = '22023';
    end;
    if not found then raise exception 'A leveling task was not found in this project.' using errcode = 'P0002'; end if;
    if v_task.schedule_version is distinct from (v_item->>'expected_task_version')::bigint then
      raise exception 'A leveling task changed after the preview was calculated.' using errcode = '40001';
    end if;
    if coalesce(v_task.percent_complete, 0) > 0
       or v_task.status in ('in_progress', 'complete')
       or v_task.actual_start_date is not null
       or v_task.actual_finish_date is not null
       or v_task.leveling_priority = 1000 then
      raise exception 'Fixed, progressed, actual-dated, or priority-1000 work cannot be leveled.' using errcode = '55000';
    end if;

    begin
      v_after_state := private.canonical_schedule_hourly_state(v_item->'after_state');
    exception when others then
      raise exception 'A leveling change contains an invalid after_state.' using errcode = '22023';
    end;
    if jsonb_typeof(v_after_state->'segments') <> 'array' then
      raise exception 'A leveling after_state requires a segment array.' using errcode = '22023';
    end if;
    v_segment_count := jsonb_array_length(v_after_state->'segments');
    if v_segment_count = 0 and coalesce((v_after_state #>> '{task,work_minutes}')::integer, 0) > 0 then
      raise exception 'A leveled task with remaining work requires at least one segment.' using errcode = '22023';
    end if;
    if v_segment_count > 0 and exists (
      with segments as (
        select
          (segment->>'segment_index')::integer segment_index,
          (segment->>'starts_at')::timestamptz starts_at,
          (segment->>'ends_at')::timestamptz ends_at,
          (segment->>'planned_minutes')::integer planned_minutes
        from jsonb_array_elements(v_after_state->'segments') segment
      ), checked as (
        select *, lag(ends_at) over(order by segment_index) previous_finish
        from segments
      )
      select 1 from checked
      where segment_index < 0
        or starts_at >= ends_at
        or mod(extract(epoch from starts_at)::bigint, 900) <> 0
        or mod(extract(epoch from ends_at)::bigint, 900) <> 0
        or planned_minutes <= 0
        or planned_minutes % 15 <> 0
        or previous_finish > starts_at
    ) then
      raise exception 'Leveled task segments must be ordered, non-overlapping positive 15-minute intervals.' using errcode = '22023';
    end if;
    if v_segment_count > 0 and (
      select count(distinct (segment->>'segment_index')::integer) <> v_segment_count
        or min((segment->>'segment_index')::integer) <> 0
        or max((segment->>'segment_index')::integer) <> v_segment_count - 1
      from jsonb_array_elements(v_after_state->'segments') segment
    ) then
      raise exception 'Leveled task segment indexes must be unique and contiguous from zero.' using errcode = '22023';
    end if;

    v_before_state := private.schedule_task_hourly_state(v_task.id);
    insert into public.schedule_leveling_run_changes(
      run_id, project_id, task_id, change_index, expected_task_version,
      before_state, after_state, before_state_hash, after_state_hash, reasons
    ) values (
      v_run.id, p_project_id, v_task.id, v_change_index, v_task.schedule_version,
      v_before_state, v_after_state,
      private.schedule_state_hash_from_payload(v_before_state),
      private.schedule_state_hash_from_payload(v_after_state),
      coalesce(v_item->'reasons', '[]'::jsonb)
    );
    v_change_index := v_change_index + 1;
  end loop;

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'changes', coalesce((
      select jsonb_agg(to_jsonb(change) order by change.change_index)
      from public.schedule_leveling_run_changes change where change.run_id = v_run.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.write_schedule_hourly_state(
  p_project_id integer,
  p_task_id uuid,
  p_state jsonb,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_segment jsonb;
begin
  delete from public.schedule_task_segments where task_id = p_task_id and project_id = p_project_id;
  for v_segment in
    select value from jsonb_array_elements(coalesce(p_state->'segments', '[]'::jsonb))
    order by (value->>'segment_index')::integer
  loop
    insert into public.schedule_task_segments(
      project_id, task_id, segment_index, starts_at, ends_at, planned_minutes,
      lock_reason, created_by_user_id, updated_by_user_id
    ) values (
      p_project_id,
      p_task_id,
      (v_segment->>'segment_index')::integer,
      (v_segment->>'starts_at')::timestamptz,
      (v_segment->>'ends_at')::timestamptz,
      (v_segment->>'planned_minutes')::integer,
      nullif(v_segment->>'lock_reason', ''),
      p_actor,
      p_actor
    );
  end loop;

  update public.schedule_tasks
  set start_date = nullif(p_state #>> '{task,start_date}', '')::date,
      finish_date = nullif(p_state #>> '{task,finish_date}', '')::date,
      forecast_start_date = nullif(p_state #>> '{task,forecast_start_date}', '')::date,
      forecast_finish_date = nullif(p_state #>> '{task,forecast_finish_date}', '')::date,
      work_minutes = nullif(p_state #>> '{task,work_minutes}', '')::integer,
      allow_leveling_split = coalesce((p_state #>> '{task,allow_leveling_split}')::boolean, true),
      leveling_priority = coalesce((p_state #>> '{task,leveling_priority}')::smallint, 500),
      schedule_version = schedule_version + 1,
      updated_at = now()
  where id = p_task_id and project_id = p_project_id;
  if not found then raise exception 'A leveling task disappeared during the transaction.' using errcode = '40001'; end if;
end;
$$;

revoke all on function private.assert_schedule_person_revision_vector(jsonb),
  private.write_schedule_hourly_state(integer, uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.apply_schedule_leveling_run(
  p_project_id integer,
  p_run_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.schedule_leveling_runs;
  v_change public.schedule_leveling_run_changes;
  v_before_revision public.schedule_revisions;
  v_after_revision public.schedule_revisions;
  v_event public.schedule_leveling_events;
  v_before_hash text;
  v_after_hash text;
begin
  if v_actor is null or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'You do not have permission to manage this project schedule.' using errcode = '42501';
  end if;
  if p_reason is not null and char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'A leveling reason cannot exceed 1000 characters.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(17419, p_project_id);
  select * into v_run
  from public.schedule_leveling_runs
  where id = p_run_id and project_id = p_project_id;
  if not found then raise exception 'Leveling run not found in this project.' using errcode = 'P0002'; end if;
  if v_run.expires_at <= now() then
    raise exception 'The leveling run expired. Refresh the preview before applying.' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.schedule_leveling_events event
    where event.run_id = p_run_id and event.event_type = 'applied'
  ) then
    raise exception 'The leveling run has already been applied.' using errcode = '40001';
  end if;
  perform private.assert_schedule_person_revision_vector(v_run.person_revision_vector);
  if private.schedule_project_leveling_source_token(p_project_id) is distinct from v_run.source_token then
    raise exception 'The project schedule changed after the leveling run was created.' using errcode = '40001';
  end if;

  perform 1
  from public.schedule_tasks task
  join public.schedule_leveling_run_changes change on change.task_id = task.id
  where change.run_id = p_run_id and task.project_id = p_project_id
  order by task.id
  for update of task;

  for v_change in
    select * from public.schedule_leveling_run_changes
    where run_id = p_run_id
    order by task_id
  loop
    if (select schedule_version from public.schedule_tasks where id = v_change.task_id)
       is distinct from v_change.expected_task_version
       or private.schedule_task_hourly_state_hash(v_change.task_id) is distinct from v_change.before_state_hash then
      raise exception 'A leveling task changed after the run was created.' using errcode = '40001';
    end if;
  end loop;

  v_before_revision := public.create_schedule_revision_snapshot(p_project_id, null);
  for v_change in
    select * from public.schedule_leveling_run_changes
    where run_id = p_run_id
    order by change_index
  loop
    perform private.write_schedule_hourly_state(p_project_id, v_change.task_id, v_change.after_state, v_actor);
    if private.schedule_task_hourly_state_hash(v_change.task_id) is distinct from v_change.after_state_hash then
      raise exception 'The applied leveling state failed its integrity check.' using errcode = '55000';
    end if;
  end loop;
  v_after_revision := public.create_schedule_revision_snapshot(p_project_id, null);

  select private.schedule_state_hash_from_payload(coalesce(jsonb_agg(change.before_state_hash order by change.change_index), '[]'::jsonb)),
         private.schedule_state_hash_from_payload(coalesce(jsonb_agg(change.after_state_hash order by change.change_index), '[]'::jsonb))
  into v_before_hash, v_after_hash
  from public.schedule_leveling_run_changes change
  where change.run_id = p_run_id;

  insert into public.schedule_leveling_events(
    project_id, run_id, event_type, source_revision_id, target_revision_id,
    before_state_hash, after_state_hash, actor_user_id, reason
  ) values (
    p_project_id, p_run_id, 'applied', v_before_revision.id, v_after_revision.id,
    v_before_hash, v_after_hash, v_actor, nullif(btrim(p_reason), '')
  ) returning * into v_event;

  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'source_revision', to_jsonb(v_before_revision),
    'target_revision', to_jsonb(v_after_revision)
  );
end;
$$;

create or replace function public.undo_schedule_leveling_event(
  p_project_id integer,
  p_apply_event_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_apply_event public.schedule_leveling_events;
  v_change public.schedule_leveling_run_changes;
  v_before_revision public.schedule_revisions;
  v_after_revision public.schedule_revisions;
  v_event public.schedule_leveling_events;
begin
  if v_actor is null or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'You do not have permission to manage this project schedule.' using errcode = '42501';
  end if;
  if p_reason is not null and char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'An undo reason cannot exceed 1000 characters.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(17419, p_project_id);
  select * into v_apply_event
  from public.schedule_leveling_events
  where id = p_apply_event_id and project_id = p_project_id and event_type = 'applied';
  if not found then raise exception 'Applied leveling event not found in this project.' using errcode = 'P0002'; end if;
  if exists (
    select 1 from public.schedule_leveling_events event
    where event.related_event_id = p_apply_event_id and event.event_type = 'undone'
  ) then
    raise exception 'The leveling application has already been undone.' using errcode = '40001';
  end if;

  perform 1
  from public.schedule_tasks task
  join public.schedule_leveling_run_changes change on change.task_id = task.id
  where change.run_id = v_apply_event.run_id and task.project_id = p_project_id
  order by task.id
  for update of task;

  for v_change in
    select * from public.schedule_leveling_run_changes
    where run_id = v_apply_event.run_id
    order by task_id
  loop
    if private.schedule_task_hourly_state_hash(v_change.task_id) is distinct from v_change.after_state_hash then
      raise exception 'Leveling undo conflict: affected schedule state changed after apply.' using errcode = '40001';
    end if;
  end loop;

  v_before_revision := public.create_schedule_revision_snapshot(p_project_id, null);
  for v_change in
    select * from public.schedule_leveling_run_changes
    where run_id = v_apply_event.run_id
    order by change_index
  loop
    perform private.write_schedule_hourly_state(p_project_id, v_change.task_id, v_change.before_state, v_actor);
    if private.schedule_task_hourly_state_hash(v_change.task_id) is distinct from v_change.before_state_hash then
      raise exception 'The undone leveling state failed its integrity check.' using errcode = '55000';
    end if;
  end loop;
  v_after_revision := public.create_schedule_revision_snapshot(p_project_id, null);

  insert into public.schedule_leveling_events(
    project_id, run_id, event_type, related_event_id,
    source_revision_id, target_revision_id,
    before_state_hash, after_state_hash, actor_user_id, reason
  ) values (
    p_project_id, v_apply_event.run_id, 'undone', v_apply_event.id,
    v_before_revision.id, v_after_revision.id,
    v_apply_event.after_state_hash, v_apply_event.before_state_hash,
    v_actor, nullif(btrim(p_reason), '')
  ) returning * into v_event;

  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'source_revision', to_jsonb(v_before_revision),
    'target_revision', to_jsonb(v_after_revision)
  );
end;
$$;

create or replace function public.get_schedule_leveling_history(
  p_project_id integer,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to view this project schedule.' using errcode = '42501';
  end if;
  if p_limit not between 1 and 100 then
    raise exception 'Leveling history limit must be from 1 through 100.' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(history.item order by history.created_at desc)
    from (
      select event.created_at, jsonb_build_object(
        'event', to_jsonb(event),
        'run', to_jsonb(run),
        'change_count', (select count(*) from public.schedule_leveling_run_changes change where change.run_id = run.id),
        'can_undo', event.event_type = 'applied' and not exists (
          select 1 from public.schedule_leveling_events undo
          where undo.related_event_id = event.id and undo.event_type = 'undone'
        )
      ) item
      from public.schedule_leveling_events event
      join public.schedule_leveling_runs run on run.id = event.run_id
      where event.project_id = p_project_id
      order by event.created_at desc
      limit p_limit
    ) history
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.replace_schedule_person_work_calendar(integer, uuid, text, jsonb, jsonb, bigint),
  public.replace_schedule_task_segments(integer, uuid, jsonb, bigint),
  public.get_schedule_enterprise_capacity(integer, uuid[], timestamptz, timestamptz),
  public.create_schedule_leveling_run(integer, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz),
  public.apply_schedule_leveling_run(integer, uuid, text),
  public.undo_schedule_leveling_event(integer, uuid, text),
  public.get_schedule_leveling_history(integer, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.replace_schedule_person_work_calendar(integer, uuid, text, jsonb, jsonb, bigint),
  public.replace_schedule_task_segments(integer, uuid, jsonb, bigint),
  public.get_schedule_enterprise_capacity(integer, uuid[], timestamptz, timestamptz),
  public.create_schedule_leveling_run(integer, text, text, jsonb, jsonb, jsonb, jsonb, timestamptz),
  public.apply_schedule_leveling_run(integer, uuid, text),
  public.undo_schedule_leveling_event(integer, uuid, text),
  public.get_schedule_leveling_history(integer, integer)
  to authenticated, service_role;

commit;
