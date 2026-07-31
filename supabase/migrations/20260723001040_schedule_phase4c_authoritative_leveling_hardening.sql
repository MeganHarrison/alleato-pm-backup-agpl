begin;

-- Historical preview records retain task UUIDs as audit identities. They must
-- not keep live tasks undeletable forever.
alter table public.schedule_leveling_run_changes
  drop constraint if exists schedule_leveling_run_changes_task_project_fkey;

alter table public.schedule_leveling_run_changes
  add column if not exists expected_undo_task_version bigint
    check(expected_undo_task_version is null or expected_undo_task_version > 0);

create unique index if not exists schedule_leveling_runs_id_project_unique
  on public.schedule_leveling_runs(id, project_id);
create unique index if not exists schedule_leveling_events_id_project_unique
  on public.schedule_leveling_events(id, project_id);
create index if not exists schedule_leveling_run_changes_task_project_idx
  on public.schedule_leveling_run_changes(task_id, project_id);
create index if not exists schedule_leveling_events_run_project_idx
  on public.schedule_leveling_events(run_id, project_id);
create index if not exists schedule_leveling_events_source_revision_idx
  on public.schedule_leveling_events(source_revision_id);
create index if not exists schedule_leveling_events_target_revision_idx
  on public.schedule_leveling_events(target_revision_id);
create index if not exists schedule_leveling_events_actor_idx
  on public.schedule_leveling_events(actor_user_id);
create index if not exists schedule_leveling_runs_created_by_idx
  on public.schedule_leveling_runs(created_by_user_id);

alter table public.schedule_leveling_run_changes
  add constraint schedule_leveling_run_changes_run_project_fkey
  foreign key(run_id, project_id)
  references public.schedule_leveling_runs(id, project_id)
  on delete cascade;

alter table public.schedule_leveling_events
  drop constraint if exists schedule_leveling_events_run_id_fkey;
alter table public.schedule_leveling_events
  add constraint schedule_leveling_events_run_project_fkey
  foreign key(run_id, project_id)
  references public.schedule_leveling_runs(id, project_id)
  on delete restrict;

-- A person's reusable shift calendar is enterprise data. Project schedule
-- managers can read it for capacity planning, but only app admins may change it.
create or replace function private.require_enterprise_calendar_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.current_is_app_admin() then
    raise exception 'Only an application administrator can manage enterprise person work calendars.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists schedule_person_work_calendars_require_admin
  on public.schedule_person_work_calendars;
create trigger schedule_person_work_calendars_require_admin
before insert or update or delete on public.schedule_person_work_calendars
for each row execute function private.require_enterprise_calendar_admin();

drop trigger if exists schedule_person_work_weekly_require_admin
  on public.schedule_person_work_weekly_intervals;
create trigger schedule_person_work_weekly_require_admin
before insert or update or delete on public.schedule_person_work_weekly_intervals
for each row execute function private.require_enterprise_calendar_admin();

drop trigger if exists schedule_person_work_date_require_admin
  on public.schedule_person_work_date_intervals;
create trigger schedule_person_work_date_require_admin
before insert or update or delete on public.schedule_person_work_date_intervals
for each row execute function private.require_enterprise_calendar_admin();

-- Assignment reassignment must invalidate both the old and new person's
-- enterprise-capacity snapshot, in a deterministic lock order.
create or replace function private.bump_assignment_person_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_old_resource_id uuid;
  v_new_resource_id uuid;
begin
  if tg_op <> 'INSERT' then v_old_resource_id := old.resource_id; end if;
  if tg_op <> 'DELETE' then v_new_resource_id := new.resource_id; end if;
  for v_person_id in
    select distinct resource.person_id
    from public.schedule_resources resource
    where resource.id = any(array_remove(array[v_old_resource_id, v_new_resource_id], null))
    order by resource.person_id
  loop
    perform private.bump_person_allocation_revision(v_person_id);
  end loop;
  return coalesce(new, old);
end;
$$;

-- This existing assertion is intentionally upgraded into a locking assertion.
-- Every apply/create that shares a person now serializes on the same revision
-- row across projects before comparing the snapshot version.
create or replace function private.assert_schedule_person_revision_vector(p_vector jsonb)
returns void
language plpgsql
volatile
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

  for v_person_text, v_expected_text in
    select key, value from jsonb_each_text(p_vector) order by key
  loop
    begin
      v_person_id := v_person_text::uuid;
      v_expected := v_expected_text::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'The person revision vector contains an invalid entry.' using errcode = '22023';
    end;

    insert into public.schedule_person_allocation_revisions(person_id, version, updated_at)
    values (v_person_id, 1, now())
    on conflict(person_id) do nothing;

    select revision.version into v_actual
    from public.schedule_person_allocation_revisions revision
    where revision.person_id = v_person_id
    for update;

    if v_actual is distinct from v_expected then
      raise exception 'Enterprise resource allocations changed after the leveling preview.' using errcode = '40001';
    end if;
  end loop;
end;
$$;

revoke all on function private.require_enterprise_calendar_admin(),
  private.bump_assignment_person_revision(),
  private.assert_schedule_person_revision_vector(jsonb)
  from public, anon, authenticated, service_role;

-- One coherent server snapshot feeds the application-owned hourly algorithm.
-- The browser supplies only a time horizon; it never supplies task changes,
-- source tokens, revision vectors, dependencies, or after-state JSON.
create or replace function public.get_schedule_hourly_leveling_context(
  p_project_id integer,
  p_range_start timestamptz,
  p_range_finish timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_person_ids uuid[];
  v_capacity jsonb;
  v_timezone text;
begin
  if auth.uid() is null or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'You do not have permission to manage this project schedule.' using errcode = '42501';
  end if;
  if p_range_start is null or p_range_finish is null or p_range_finish <= p_range_start
     or p_range_finish > p_range_start + interval '92 days' then
    raise exception 'Hourly leveling requires an ascending range of no more than 92 days.' using errcode = '22023';
  end if;

  select coalesce(array_agg(resource.person_id order by resource.person_id), array[]::uuid[])
  into v_person_ids
  from public.schedule_resources resource
  join public.people person on person.id = resource.person_id and person.status = 'active'
  join public.project_directory_memberships membership
    on membership.project_id = resource.project_id
   and membership.person_id = resource.person_id
   and membership.status = 'active'
  where resource.project_id = p_project_id;

  insert into public.schedule_person_allocation_revisions(person_id, version, updated_at)
  select person_id, 1, now() from unnest(v_person_ids) person_id
  on conflict(person_id) do nothing;

  v_capacity := public.get_schedule_enterprise_capacity(
    p_project_id, v_person_ids, p_range_start, p_range_finish
  );

  select coalesce(calendar.timezone_name, 'America/Indiana/Indianapolis')
  into v_timezone
  from (select p_project_id project_id) requested
  left join public.project_schedule_calendars calendar on calendar.project_id = requested.project_id;

  return v_capacity || jsonb_build_object(
    'project_timezone', v_timezone,
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', task.id,
        'name', task.name,
        'start_date', task.start_date,
        'finish_date', task.finish_date,
        'forecast_start_date', task.forecast_start_date,
        'forecast_finish_date', task.forecast_finish_date,
        'duration_days', task.duration_days,
        'remaining_duration_days', task.remaining_duration_days,
        'percent_complete', task.percent_complete,
        'status', task.status,
        'is_milestone', task.is_milestone,
        'actual_start_date', task.actual_start_date,
        'actual_finish_date', task.actual_finish_date,
        'constraint_type', task.constraint_type,
        'constraint_date', task.constraint_date,
        'work_minutes', task.work_minutes,
        'allow_leveling_split', task.allow_leveling_split,
        'leveling_priority', task.leveling_priority,
        'schedule_version', task.schedule_version,
        'segments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', segment.id,
            'task_id', segment.task_id,
            'segment_index', segment.segment_index,
            'starts_at', segment.starts_at,
            'ends_at', segment.ends_at,
            'planned_minutes', segment.planned_minutes,
            'lock_reason', segment.lock_reason
          ) order by segment.segment_index)
          from public.schedule_task_segments segment
          where segment.task_id = task.id
        ), '[]'::jsonb)
      ) order by task.sort_order, task.id)
      from public.schedule_tasks task
      where task.project_id = p_project_id
    ), '[]'::jsonb),
    'dependencies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'task_id', dependency.task_id,
        'predecessor_task_id', dependency.predecessor_task_id,
        'dependency_type', dependency.dependency_type,
        'lag_minutes', coalesce(dependency.lag_days, 0) * 480
      ) order by dependency.task_id, dependency.predecessor_task_id, dependency.id)
      from public.schedule_dependencies dependency
      join public.schedule_tasks task on task.id = dependency.task_id
      where task.project_id = p_project_id
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'task_id', assignment.task_id,
        'person_id', resource.person_id,
        'allocation_percent', assignment.allocation_percent
      ) order by assignment.task_id, resource.person_id)
      from public.schedule_task_assignments assignment
      join public.schedule_resources resource on resource.id = assignment.resource_id
      where assignment.project_id = p_project_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_schedule_hourly_leveling_context(integer, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_schedule_hourly_leveling_context(integer, timestamptz, timestamptz)
  to authenticated, service_role;

-- Canonical task dates and work are always derived from validated segments in
-- the project timezone. Any caller-supplied task sub-object is discarded.
create or replace function private.canonicalize_leveling_change_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_segments jsonb;
  v_start_date date;
  v_finish_date date;
  v_work_minutes integer;
  v_allow_split boolean;
  v_priority smallint;
begin
  v_segments := private.canonical_schedule_hourly_state(new.after_state)->'segments';
  if jsonb_array_length(v_segments) = 0 then
    raise exception 'A leveled task requires at least one schedule segment.' using errcode = '22023';
  end if;

  select
    coalesce(calendar.timezone_name, 'America/Indiana/Indianapolis'),
    task.allow_leveling_split,
    task.leveling_priority
  into v_timezone, v_allow_split, v_priority
  from public.schedule_tasks task
  left join public.project_schedule_calendars calendar on calendar.project_id = task.project_id
  where task.id = new.task_id and task.project_id = new.project_id;
  if not found then
    raise exception 'A leveling task was not found in this project.' using errcode = 'P0002';
  end if;

  select
    min((segment->>'starts_at')::timestamptz at time zone v_timezone)::date,
    max(((segment->>'ends_at')::timestamptz - interval '1 microsecond') at time zone v_timezone)::date,
    sum((segment->>'planned_minutes')::integer)
  into v_start_date, v_finish_date, v_work_minutes
  from jsonb_array_elements(v_segments) segment;

  new.after_state := jsonb_build_object(
    'task', jsonb_build_object(
      'start_date', v_start_date,
      'finish_date', v_finish_date,
      'forecast_start_date', v_start_date,
      'forecast_finish_date', v_finish_date,
      'work_minutes', v_work_minutes,
      'allow_leveling_split', v_allow_split,
      'leveling_priority', v_priority
    ),
    'segments', v_segments
  );
  new.after_state_hash := private.schedule_state_hash_from_payload(new.after_state);
  new.expected_undo_task_version := new.expected_task_version + 1;
  return new;
end;
$$;

drop trigger if exists schedule_leveling_run_changes_canonicalize
  on public.schedule_leveling_run_changes;
create trigger schedule_leveling_run_changes_canonicalize
before insert on public.schedule_leveling_run_changes
for each row execute function private.canonicalize_leveling_change_before_insert();

-- At commit, require at least one change and an exact person vector for the
-- people assigned to the changed tasks. Missing and extra entries are rejected.
create or replace function private.validate_leveling_run_person_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected jsonb;
  v_change_count integer;
begin
  select count(*) into v_change_count
  from public.schedule_leveling_run_changes change
  where change.run_id = new.id;
  if v_change_count = 0 then
    raise exception 'A saved leveling run must contain at least one task change.' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(person.person_id::text, revision.version), '{}'::jsonb)
  into v_expected
  from (
    select distinct resource.person_id
    from public.schedule_leveling_run_changes change
    join public.schedule_task_assignments assignment on assignment.task_id = change.task_id
    join public.schedule_resources resource on resource.id = assignment.resource_id
    where change.run_id = new.id
  ) person
  join public.schedule_person_allocation_revisions revision on revision.person_id = person.person_id;

  if new.person_revision_vector is distinct from v_expected then
    raise exception 'The leveling person revision vector must exactly match changed-task assignments.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_leveling_runs_validate_person_vector
  on public.schedule_leveling_runs;
create constraint trigger schedule_leveling_runs_validate_person_vector
after insert on public.schedule_leveling_runs
deferrable initially deferred
for each row execute function private.validate_leveling_run_person_vector();

revoke all on function private.canonicalize_leveling_change_before_insert(),
  private.validate_leveling_run_person_vector()
  from public, anon, authenticated, service_role;

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
  if not found then
    raise exception 'Applied leveling event not found in this project.' using errcode = 'P0002';
  end if;
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
    if (select task.schedule_version from public.schedule_tasks task
        where task.id = v_change.task_id and task.project_id = p_project_id)
         is distinct from v_change.expected_undo_task_version
       or exists (
         select 1 from public.schedule_tasks task
         where task.id = v_change.task_id and task.project_id = p_project_id
           and (coalesce(task.percent_complete, 0) > 0
             or task.status in ('in_progress', 'complete')
             or task.actual_start_date is not null
             or task.actual_finish_date is not null)
       )
       or private.schedule_task_hourly_state_hash(v_change.task_id)
         is distinct from v_change.after_state_hash then
      raise exception 'Leveling undo conflict: affected schedule state changed after apply.' using errcode = '40001';
    end if;
  end loop;

  v_before_revision := public.create_schedule_revision_snapshot(p_project_id, null);
  for v_change in
    select * from public.schedule_leveling_run_changes
    where run_id = v_apply_event.run_id
    order by change_index
  loop
    perform private.write_schedule_hourly_state(
      p_project_id, v_change.task_id, v_change.before_state, v_actor
    );
    if private.schedule_task_hourly_state_hash(v_change.task_id)
       is distinct from v_change.before_state_hash then
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

revoke all on function public.undo_schedule_leveling_event(integer, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.undo_schedule_leveling_event(integer, uuid, text)
  to authenticated, service_role;

commit;
