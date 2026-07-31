begin;

-- Phase 3 keeps revision snapshots as the one immutable schedule-history owner.
-- A named baseline is only a project designation of an approved revision.

alter table public.projects
  add column if not exists current_schedule_revision_id uuid;

update public.projects p
set current_schedule_revision_id = (
  select r.id
  from public.schedule_revisions r
  where r.project_id = p.id and r.status = 'published'
  order by r.revision_number desc
  limit 1
)
where p.current_schedule_revision_id is null
  and exists (
    select 1 from public.schedule_revisions r
    where r.project_id = p.id and r.status = 'published'
  );

do $$
begin
  alter table public.projects
    add constraint projects_current_schedule_revision_id_fkey
    foreign key (current_schedule_revision_id)
    references public.schedule_revisions(id)
    on delete set null;
exception when duplicate_object then null;
end;
$$;

alter table public.schedule_revision_task_snapshots
  add column if not exists deadline_date date;

update public.schedule_revision_task_snapshots snapshot
set deadline_date = deadline.deadline_date
from public.schedule_deadlines deadline
where deadline.task_id = snapshot.source_task_id
  and snapshot.deadline_date is null;

alter table public.schedule_revision_submittal_snapshots
  add column if not exists submittal_number text,
  add column if not exists title text,
  add column if not exists response_statuses text[] not null default '{}';

update public.schedule_revision_submittal_snapshots snapshot
set submittal_number = submittal.submittal_number,
    title = submittal.title,
    response_statuses = coalesce((
      select array_agg(response.response_status order by response.responded_at nulls last, response.id)
      from public.submittal_responses response
      where response.submittal_id = snapshot.submittal_id
    ), '{}'::text[])
from public.submittals submittal
where submittal.id = snapshot.submittal_id;

alter table public.schedule_revision_submittal_snapshots
  alter column submittal_number set not null,
  alter column title set not null;

create table if not exists public.schedule_revision_calendar_snapshots (
  revision_id uuid primary key references public.schedule_revisions(id) on delete cascade,
  working_weekdays smallint[] not null,
  exceptions jsonb not null default '[]'::jsonb,
  constraint schedule_revision_calendar_weekdays_check check (
    cardinality(working_weekdays) > 0
    and working_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  constraint schedule_revision_calendar_exceptions_array_check check (jsonb_typeof(exceptions) = 'array')
);

insert into public.schedule_revision_calendar_snapshots(revision_id, working_weekdays, exceptions)
select
  revision.id,
  coalesce(calendar.working_weekdays, array[1, 2, 3, 4, 5]::smallint[]),
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'date', exception.exception_date,
        'is_working', exception.is_working,
        'reason', exception.reason
      ) order by exception.exception_date
    )
    from public.project_schedule_calendar_exceptions exception
    where exception.project_id = revision.project_id
  ), '[]'::jsonb)
from public.schedule_revisions revision
left join public.project_schedule_calendars calendar on calendar.project_id = revision.project_id
on conflict (revision_id) do nothing;

create table if not exists public.schedule_baselines (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  revision_id uuid not null references public.schedule_revisions(id) on delete restrict,
  name text not null,
  is_active boolean not null default false,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  activated_by_user_id uuid,
  activated_at timestamptz,
  deactivated_by_user_id uuid,
  deactivated_at timestamptz,
  constraint schedule_baselines_name_check check (
    name = btrim(name) and char_length(name) between 1 and 80
  )
);

create unique index if not exists schedule_baselines_project_name_unique
  on public.schedule_baselines(project_id, lower(name));
create unique index if not exists schedule_baselines_project_revision_unique
  on public.schedule_baselines(project_id, revision_id);
create unique index if not exists schedule_baselines_one_active_per_project
  on public.schedule_baselines(project_id) where is_active;

create table if not exists public.schedule_baseline_events (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  baseline_id uuid not null references public.schedule_baselines(id) on delete cascade,
  event_type text not null check (event_type in ('captured', 'activated', 'deactivated')),
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now()
);

create index if not exists schedule_baseline_events_project_occurred_at_idx
  on public.schedule_baseline_events(project_id, occurred_at desc);

alter table public.schedule_revision_calendar_snapshots enable row level security;
alter table public.schedule_baselines enable row level security;
alter table public.schedule_baseline_events enable row level security;

revoke all on public.schedule_revision_calendar_snapshots, public.schedule_baselines,
  public.schedule_baseline_events from anon, authenticated;
grant select on public.schedule_revision_calendar_snapshots, public.schedule_baselines,
  public.schedule_baseline_events to authenticated;

create policy schedule_revision_calendar_snapshots_project_member_read
  on public.schedule_revision_calendar_snapshots for select to authenticated
  using (exists (
    select 1 from public.schedule_revisions revision
    where revision.id = revision_id
      and (public.current_is_app_admin() or public.current_is_project_member(revision.project_id))
  ));

create policy schedule_baselines_project_member_read
  on public.schedule_baselines for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id));

create policy schedule_baseline_events_project_member_read
  on public.schedule_baseline_events for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id));

create or replace function public.current_can_manage_schedule(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_is_app_admin() or exists (
    select 1
    from public.project_directory_memberships membership
    where membership.project_id = p_project_id
      and membership.person_id = public.current_person_id()
      and membership.status = 'active'
      and case
        when exists (
          select 1 from public.user_module_permissions override_permission
          where override_permission.project_id = p_project_id
            and override_permission.person_id = membership.person_id
            and override_permission.module = 'schedule'
        ) then exists (
          select 1 from public.user_module_permissions override_permission
          where override_permission.project_id = p_project_id
            and override_permission.person_id = membership.person_id
            and override_permission.module = 'schedule'
            and override_permission.level = 'admin'
        )
        when membership.permission_template_id is not null then exists (
          select 1 from public.permission_templates template
          where template.id = membership.permission_template_id
            and coalesce(template.rules_json->'schedule', '[]'::jsonb) ? 'admin'
        )
        else exists (
          select 1
          from public.person_company_templates company_assignment
          join public.permission_templates template on template.id = company_assignment.template_id
          where company_assignment.person_id = membership.person_id
            and coalesce(template.rules_json->'schedule', '[]'::jsonb) ? 'admin'
        )
      end
  );
$$;

create or replace function public.reject_schedule_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Parent cleanup still works; direct historical mutation never does.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'Schedule revision snapshots and audit events are immutable.' using errcode = '55000';
end;
$$;

do $$
declare snapshot_table text;
begin
  foreach snapshot_table in array array[
    'schedule_revision_task_snapshots',
    'schedule_revision_dependency_snapshots',
    'schedule_revision_submittal_snapshots',
    'schedule_revision_calendar_snapshots',
    'schedule_revision_events',
    'schedule_baseline_events'
  ] loop
    execute format('drop trigger if exists %I on public.%I', snapshot_table || '_immutable', snapshot_table);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function public.reject_schedule_snapshot_mutation()',
      snapshot_table || '_immutable', snapshot_table
    );
  end loop;
end;
$$;

create or replace function public.create_schedule_revision_snapshot(
  p_project_id integer,
  p_baseline_revision_id uuid default null
)
returns public.schedule_revisions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_revision public.schedule_revisions;
  v_next_revision_number integer;
  v_active_baseline_revision_id uuid;
  v_working_weekdays smallint[];
  v_calendar_exceptions jsonb;
  v_source_count integer;
  v_inserted_count integer;
begin
  if auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to snapshot this project schedule.' using errcode = '42501';
  end if;

  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;

  select baseline.revision_id into v_active_baseline_revision_id
  from public.schedule_baselines baseline
  where baseline.project_id = p_project_id and baseline.is_active;

  if p_baseline_revision_id is not null
     and p_baseline_revision_id is distinct from v_active_baseline_revision_id then
    raise exception 'The requested baseline is not the project active baseline.' using errcode = '22023';
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_next_revision_number
  from public.schedule_revisions where project_id = p_project_id;

  insert into public.schedule_revisions(project_id, revision_number, baseline_revision_id, created_by_user_id)
  values (p_project_id, v_next_revision_number, v_active_baseline_revision_id, auth.uid())
  returning * into v_revision;

  select count(*) into v_source_count from public.schedule_tasks where project_id = p_project_id;
  insert into public.schedule_revision_task_snapshots(
    revision_id, source_task_id, name, parent_source_task_id, start_date, finish_date,
    duration_days, percent_complete, status, is_milestone, wbs_code, sort_order,
    actual_start_date, actual_finish_date, forecast_start_date, forecast_finish_date,
    remaining_duration_days, constraint_type, constraint_date, assignee_person_id, deadline_date
  )
  select
    v_revision.id, task.id, task.name, task.parent_task_id, task.start_date, task.finish_date,
    task.duration_days, task.percent_complete, task.status, task.is_milestone, task.wbs_code, task.sort_order,
    task.actual_start_date, task.actual_finish_date, task.forecast_start_date, task.forecast_finish_date,
    task.remaining_duration_days, task.constraint_type, task.constraint_date, task.assignee_person_id,
    deadline.deadline_date
  from public.schedule_tasks task
  left join lateral (
    select schedule_deadline.deadline_date
    from public.schedule_deadlines schedule_deadline
    where schedule_deadline.task_id = task.id
    order by schedule_deadline.created_at desc
    limit 1
  ) deadline on true
  where task.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule task snapshot count mismatch.' using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_dependencies dependency
  join public.schedule_tasks task on task.id = dependency.task_id
  where task.project_id = p_project_id;
  insert into public.schedule_revision_dependency_snapshots(
    revision_id, source_dependency_id, task_source_id, predecessor_source_id, dependency_type, lag_days
  )
  select v_revision.id, dependency.id, dependency.task_id, dependency.predecessor_task_id,
    dependency.dependency_type, coalesce(dependency.lag_days, 0)
  from public.schedule_dependencies dependency
  join public.schedule_tasks task on task.id = dependency.task_id
  where task.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule dependency snapshot count mismatch.' using errcode = '55000';
  end if;

  insert into public.schedule_revision_submittal_snapshots(
    revision_id, source_task_id, submittal_id, submittal_status,
    required_approval_date, submittal_number, title, response_statuses
  )
  select
    v_revision.id, link.task_id, submittal.id, submittal.status,
    submittal.required_approval_date, submittal.submittal_number, submittal.title,
    coalesce((
      select array_agg(response.response_status order by response.responded_at nulls last, response.id)
      from public.submittal_responses response
      where response.submittal_id = submittal.id
    ), '{}'::text[])
  from public.schedule_task_submittal_links link
  join public.submittals submittal on submittal.id = link.submittal_id
  where link.project_id = p_project_id;

  select coalesce(calendar.working_weekdays, array[1, 2, 3, 4, 5]::smallint[])
  into v_working_weekdays
  from (select 1) seed
  left join public.project_schedule_calendars calendar on calendar.project_id = p_project_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', exception.exception_date,
      'is_working', exception.is_working,
      'reason', exception.reason
    ) order by exception.exception_date
  ), '[]'::jsonb)
  into v_calendar_exceptions
  from public.project_schedule_calendar_exceptions exception
  where exception.project_id = p_project_id;

  insert into public.schedule_revision_calendar_snapshots(revision_id, working_weekdays, exceptions)
  values (v_revision.id, v_working_weekdays, v_calendar_exceptions);

  insert into public.schedule_revision_events(project_id, revision_id, event_type, to_status, actor_user_id)
  values (p_project_id, v_revision.id, 'created', 'draft', auth.uid());

  return v_revision;
end;
$$;

create or replace function public.transition_schedule_revision(
  p_project_id integer,
  p_revision_id uuid,
  p_to_status text
)
returns public.schedule_revisions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_revision public.schedule_revisions;
  v_superseded record;
begin
  if auth.uid() is null
     or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'Only a project schedule admin can transition a schedule revision.' using errcode = '42501';
  end if;

  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;

  select * into v_revision from public.schedule_revisions
  where id = p_revision_id and project_id = p_project_id for update;
  if not found then raise exception 'Schedule revision not found in this project.' using errcode = 'P0002'; end if;

  if p_to_status = 'review' and v_revision.status = 'draft' then
    update public.schedule_revisions
    set status = 'review', reviewed_at = now()
    where id = p_revision_id returning * into v_revision;
    insert into public.schedule_revision_events(project_id, revision_id, event_type, from_status, to_status, actor_user_id)
    values (p_project_id, p_revision_id, 'review_requested', 'draft', 'review', auth.uid());
  elsif p_to_status = 'published' and v_revision.status = 'review' then
    for v_superseded in
      update public.schedule_revisions
      set status = 'superseded', superseded_at = now()
      where project_id = p_project_id and status = 'published' and id <> p_revision_id
      returning id
    loop
      insert into public.schedule_revision_events(project_id, revision_id, event_type, from_status, to_status, actor_user_id)
      values (p_project_id, v_superseded.id, 'superseded', 'published', 'superseded', auth.uid());
    end loop;

    update public.schedule_revisions
    set status = 'published', published_at = now(), superseded_at = null
    where id = p_revision_id returning * into v_revision;
    update public.projects set current_schedule_revision_id = p_revision_id where id = p_project_id;
    insert into public.schedule_revision_events(project_id, revision_id, event_type, from_status, to_status, actor_user_id)
    values (p_project_id, p_revision_id, 'published', 'review', 'published', auth.uid());
  else
    raise exception 'Invalid schedule revision transition from % to %.', v_revision.status, p_to_status using errcode = '22023';
  end if;

  return v_revision;
end;
$$;

create or replace function public.capture_schedule_baseline(
  p_project_id integer,
  p_revision_id uuid,
  p_name text,
  p_activate boolean default true
)
returns public.schedule_baselines
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_baseline public.schedule_baselines;
  v_old record;
begin
  if auth.uid() is null
     or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'Only a project schedule admin can capture a baseline.' using errcode = '42501';
  end if;
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 1 and 80 then
    raise exception 'Baseline name must contain 1 to 80 trimmed characters.' using errcode = '22023';
  end if;

  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;
  perform 1 from public.schedule_revisions
  where id = p_revision_id and project_id = p_project_id and status in ('published', 'superseded')
  for update;
  if not found then
    raise exception 'A baseline must reference a published or superseded revision in this project.' using errcode = '22023';
  end if;

  insert into public.schedule_baselines(
    project_id, revision_id, name, created_by_user_id
  ) values (
    p_project_id, p_revision_id, p_name, auth.uid()
  ) returning * into v_baseline;
  insert into public.schedule_baseline_events(project_id, baseline_id, event_type, actor_user_id)
  values (p_project_id, v_baseline.id, 'captured', auth.uid());

  if p_activate then
    for v_old in
      update public.schedule_baselines
      set is_active = false, deactivated_by_user_id = auth.uid(), deactivated_at = now()
      where project_id = p_project_id and is_active and id <> v_baseline.id
      returning id
    loop
      insert into public.schedule_baseline_events(project_id, baseline_id, event_type, actor_user_id)
      values (p_project_id, v_old.id, 'deactivated', auth.uid());
    end loop;
    update public.schedule_baselines
    set is_active = true, activated_by_user_id = auth.uid(), activated_at = now(),
      deactivated_by_user_id = null, deactivated_at = null
    where id = v_baseline.id returning * into v_baseline;
    insert into public.schedule_baseline_events(project_id, baseline_id, event_type, actor_user_id)
    values (p_project_id, v_baseline.id, 'activated', auth.uid());
  end if;

  return v_baseline;
exception
  when unique_violation then
    raise exception 'That baseline name or revision is already used in this project.' using errcode = '23505';
end;
$$;

create or replace function public.activate_schedule_baseline(
  p_project_id integer,
  p_baseline_id uuid
)
returns public.schedule_baselines
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_baseline public.schedule_baselines;
  v_old record;
begin
  if auth.uid() is null
     or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'Only a project schedule admin can activate a baseline.' using errcode = '42501';
  end if;

  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;
  select * into v_baseline from public.schedule_baselines
  where id = p_baseline_id and project_id = p_project_id for update;
  if not found then raise exception 'Baseline not found in this project.' using errcode = 'P0002'; end if;
  if v_baseline.is_active then return v_baseline; end if;

  for v_old in
    update public.schedule_baselines
    set is_active = false, deactivated_by_user_id = auth.uid(), deactivated_at = now()
    where project_id = p_project_id and is_active
    returning id
  loop
    insert into public.schedule_baseline_events(project_id, baseline_id, event_type, actor_user_id)
    values (p_project_id, v_old.id, 'deactivated', auth.uid());
  end loop;

  update public.schedule_baselines
  set is_active = true, activated_by_user_id = auth.uid(), activated_at = now(),
    deactivated_by_user_id = null, deactivated_at = null
  where id = p_baseline_id returning * into v_baseline;
  insert into public.schedule_baseline_events(project_id, baseline_id, event_type, actor_user_id)
  values (p_project_id, p_baseline_id, 'activated', auth.uid());
  return v_baseline;
end;
$$;

revoke all on function public.current_can_manage_schedule(bigint) from public, anon;
grant execute on function public.current_can_manage_schedule(bigint) to authenticated;
revoke all on function public.create_schedule_revision_snapshot(integer, uuid) from public, anon;
grant execute on function public.create_schedule_revision_snapshot(integer, uuid) to authenticated;
revoke all on function public.transition_schedule_revision(integer, uuid, text) from public, anon;
grant execute on function public.transition_schedule_revision(integer, uuid, text) to authenticated;
revoke all on function public.capture_schedule_baseline(integer, uuid, text, boolean) from public, anon;
grant execute on function public.capture_schedule_baseline(integer, uuid, text, boolean) to authenticated;
revoke all on function public.activate_schedule_baseline(integer, uuid) from public, anon;
grant execute on function public.activate_schedule_baseline(integer, uuid) to authenticated;

commit;
