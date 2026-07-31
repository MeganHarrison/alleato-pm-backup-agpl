-- Explicit schedule cost facts for people, equipment, and materials.
-- Actual cost is never inferred; it is either recorded directly or calculated
-- from explicit actual units and an explicit/current rate.

begin;

alter table public.schedule_resources
  drop constraint if exists schedule_resources_active_membership_fkey;
alter table public.schedule_resources
  alter column person_id drop not null;
alter table public.schedule_resources
  add column if not exists resource_kind text,
  add column if not exists display_name text,
  add column if not exists standard_rate numeric(16, 4),
  add column if not exists cost_per_use numeric(16, 2),
  add column if not exists rate_unit text,
  add column if not exists cost_version integer not null default 1;

update public.schedule_resources resource
set
  resource_kind = coalesce(resource.resource_kind, 'person'),
  display_name = coalesce(
    nullif(resource.display_name, ''),
    (
      select coalesce(
        nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''),
        person.email,
        'Unnamed person'
      )
      from public.people person
      where person.id = resource.person_id
    ),
    'Unnamed resource'
  )
where resource.resource_kind is null
   or resource.display_name is null
   or resource.display_name = '';

alter table public.schedule_resources
  alter column resource_kind set default 'person',
  alter column resource_kind set not null,
  alter column display_name set not null;

do $$
begin
  alter table public.schedule_resources
    add constraint schedule_resources_kind_check
    check (resource_kind in ('person', 'equipment', 'material'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.schedule_resources
    add constraint schedule_resources_person_kind_check
    check (
      (resource_kind = 'person' and person_id is not null)
      or (resource_kind in ('equipment', 'material') and person_id is null)
    );
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.schedule_resources
    add constraint schedule_resources_rate_check
    check (
      (standard_rate is null or standard_rate >= 0)
      and (cost_per_use is null or cost_per_use >= 0)
      and (
        rate_unit is null
        or (resource_kind = 'person' and rate_unit = 'hour')
        or (resource_kind = 'equipment' and rate_unit = 'day')
        or (resource_kind = 'material' and rate_unit = 'unit')
      )
    );
exception when duplicate_object then null;
end;
$$;

create unique index if not exists schedule_resources_project_person_unique_v2
  on public.schedule_resources(project_id, person_id)
  where resource_kind = 'person';

create index if not exists schedule_resources_project_kind_idx
  on public.schedule_resources(project_id, resource_kind, display_name);

alter table public.schedule_task_assignments
  add column if not exists planned_units numeric(16, 4),
  add column if not exists actual_units numeric(16, 4),
  add column if not exists actual_rate numeric(16, 4),
  add column if not exists actual_cost numeric(16, 2),
  add column if not exists cost_version integer not null default 1;

do $$
begin
  alter table public.schedule_task_assignments
    add constraint schedule_task_assignments_cost_facts_check
    check (
      (planned_units is null or planned_units >= 0)
      and (actual_units is null or actual_units >= 0)
      and (actual_rate is null or actual_rate >= 0)
      and (actual_cost is null or actual_cost >= 0)
    );
exception when duplicate_object then null;
end;
$$;

alter table public.schedule_revision_resource_snapshots
  alter column source_person_id drop not null,
  alter column person_status drop not null,
  alter column membership_status drop not null,
  add column if not exists resource_kind text,
  add column if not exists standard_rate numeric(16, 4),
  add column if not exists cost_per_use numeric(16, 2),
  add column if not exists rate_unit text,
  add column if not exists source_cost_version integer;

update public.schedule_revision_resource_snapshots
set resource_kind = coalesce(resource_kind, 'person'),
    source_cost_version = coalesce(source_cost_version, 1)
where resource_kind is null or source_cost_version is null;

alter table public.schedule_revision_resource_snapshots
  alter column resource_kind set not null,
  alter column source_cost_version set not null;

do $$
begin
  alter table public.schedule_revision_resource_snapshots
    add constraint schedule_revision_resource_kind_check
    check (resource_kind in ('person', 'equipment', 'material'));
exception when duplicate_object then null;
end;
$$;

alter table public.schedule_revision_assignment_snapshots
  add column if not exists planned_units numeric(16, 4),
  add column if not exists actual_units numeric(16, 4),
  add column if not exists actual_rate numeric(16, 4),
  add column if not exists actual_cost numeric(16, 2),
  add column if not exists source_cost_version integer;

update public.schedule_revision_assignment_snapshots
set source_cost_version = coalesce(source_cost_version, 1)
where source_cost_version is null;

alter table public.schedule_revision_assignment_snapshots
  alter column source_cost_version set not null;

create or replace function private.bump_schedule_resource_cost_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.resource_kind,
    new.display_name,
    new.person_id,
    new.standard_rate,
    new.cost_per_use,
    new.rate_unit
  ) is distinct from (
    old.resource_kind,
    old.display_name,
    old.person_id,
    old.standard_rate,
    old.cost_per_use,
    old.rate_unit
  ) and new.cost_version = old.cost_version then
    new.cost_version := old.cost_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_resources_bump_cost_version
  on public.schedule_resources;
create trigger schedule_resources_bump_cost_version
before update on public.schedule_resources
for each row execute function private.bump_schedule_resource_cost_version();

create or replace function private.bump_schedule_assignment_cost_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.allocation_percent,
    new.planned_units,
    new.actual_units,
    new.actual_rate,
    new.actual_cost
  ) is distinct from (
    old.allocation_percent,
    old.planned_units,
    old.actual_units,
    old.actual_rate,
    old.actual_cost
  ) and new.cost_version = old.cost_version then
    new.cost_version := old.cost_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_task_assignments_bump_cost_version
  on public.schedule_task_assignments;
create trigger schedule_task_assignments_bump_cost_version
before update on public.schedule_task_assignments
for each row execute function private.bump_schedule_assignment_cost_version();

create or replace function public.upsert_schedule_cost_resource(
  p_project_id integer,
  p_resource_id uuid,
  p_resource_kind text,
  p_display_name text,
  p_standard_rate numeric,
  p_cost_per_use numeric,
  p_rate_unit text,
  p_expected_cost_version integer default null
)
returns public.schedule_resources
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.schedule_resources;
  v_resource public.schedule_resources;
begin
  if v_actor is null
     or public.current_can_manage_schedule(p_project_id::bigint) is distinct from true then
    raise exception 'Only a project schedule manager can change cost resources.'
      using errcode = '42501';
  end if;
  if p_resource_kind not in ('person', 'equipment', 'material') then
    raise exception 'Unsupported schedule resource kind.'
      using errcode = '22023';
  end if;
  if nullif(trim(p_display_name), '') is null then
    raise exception 'Resource name is required.' using errcode = '22023';
  end if;
  if p_standard_rate is not null and p_standard_rate < 0
     or p_cost_per_use is not null and p_cost_per_use < 0 then
    raise exception 'Resource rates cannot be negative.' using errcode = '22023';
  end if;
  if p_rate_unit is not null
     and (
       (p_resource_kind = 'person' and p_rate_unit <> 'hour')
       or (p_resource_kind = 'equipment' and p_rate_unit <> 'day')
       or (p_resource_kind = 'material' and p_rate_unit <> 'unit')
     ) then
    raise exception 'People use hour rates, equipment uses day rates, and material uses unit rates.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('schedule-project:' || p_project_id, 0));

  if p_resource_id is null then
    if p_resource_kind = 'person' then
      raise exception 'Person resources are created from active project-directory members.'
        using errcode = '22023';
    end if;
    if p_expected_cost_version is not null then
      raise exception 'A new resource cannot have an expected version.'
        using errcode = '22023';
    end if;
    insert into public.schedule_resources(
      project_id,
      person_id,
      resource_kind,
      display_name,
      standard_rate,
      cost_per_use,
      rate_unit,
      created_by_user_id
    )
    values (
      p_project_id,
      null,
      p_resource_kind,
      trim(p_display_name),
      p_standard_rate,
      p_cost_per_use,
      p_rate_unit,
      v_actor
    )
    returning * into v_resource;
    return v_resource;
  end if;

  select * into v_existing
  from public.schedule_resources resource
  where resource.id = p_resource_id
    and resource.project_id = p_project_id
  for update;
  if not found then
    raise exception 'Cost resource not found in this project.' using errcode = 'P0002';
  end if;
  if p_expected_cost_version is null
     or v_existing.cost_version <> p_expected_cost_version then
    raise exception 'Cost resource changed since it was loaded.'
      using errcode = '40001';
  end if;
  if v_existing.resource_kind <> p_resource_kind then
    raise exception 'Resource kind cannot be changed after creation.'
      using errcode = '22023';
  end if;

  update public.schedule_resources
  set display_name = case
        when v_existing.resource_kind = 'person' then v_existing.display_name
        else trim(p_display_name)
      end,
      standard_rate = p_standard_rate,
      cost_per_use = p_cost_per_use,
      rate_unit = p_rate_unit
  where id = p_resource_id
  returning * into v_resource;
  return v_resource;
end;
$$;

revoke all on function public.upsert_schedule_cost_resource(
  integer, uuid, text, text, numeric, numeric, text, integer
) from public, anon, service_role;
grant execute on function public.upsert_schedule_cost_resource(
  integer, uuid, text, text, numeric, numeric, text, integer
) to authenticated;

create or replace function public.delete_schedule_cost_resource(
  p_project_id integer,
  p_resource_id uuid,
  p_expected_cost_version integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_resource public.schedule_resources;
begin
  if auth.uid() is null
     or public.current_can_manage_schedule(p_project_id::bigint) is distinct from true then
    raise exception 'Only a project schedule manager can delete cost resources.'
      using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('schedule-project:' || p_project_id, 0));
  select * into v_resource
  from public.schedule_resources resource
  where resource.id = p_resource_id
    and resource.project_id = p_project_id
  for update;
  if not found then
    raise exception 'Cost resource not found in this project.' using errcode = 'P0002';
  end if;
  if v_resource.resource_kind = 'person' then
    raise exception 'Person resources are managed from the project directory.'
      using errcode = '22023';
  end if;
  if v_resource.cost_version <> p_expected_cost_version then
    raise exception 'Cost resource changed since it was loaded.'
      using errcode = '40001';
  end if;
  if exists (
    select 1
    from public.schedule_task_assignments assignment
    where assignment.resource_id = p_resource_id
      and assignment.project_id = p_project_id
  ) then
    raise exception 'Remove this resource from its schedule activities before deleting it.'
      using errcode = '23503';
  end if;
  delete from public.schedule_resources where id = p_resource_id;
end;
$$;

revoke all on function public.delete_schedule_cost_resource(integer, uuid, integer)
  from public, anon, service_role;
grant execute on function public.delete_schedule_cost_resource(integer, uuid, integer)
  to authenticated;

create or replace function public.upsert_schedule_cost_assignment(
  p_project_id integer,
  p_task_id uuid,
  p_resource_id uuid,
  p_allocation_percent integer,
  p_planned_units numeric,
  p_actual_units numeric,
  p_actual_rate numeric,
  p_actual_cost numeric,
  p_expected_cost_version integer default null
)
returns public.schedule_task_assignments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.schedule_task_assignments;
  v_assignment public.schedule_task_assignments;
begin
  if v_actor is null
     or public.current_can_manage_schedule(p_project_id::bigint) is distinct from true then
    raise exception 'Only a project schedule manager can change cost assignments.'
      using errcode = '42501';
  end if;
  if p_allocation_percent not between 1 and 100 then
    raise exception 'Allocation percent must be from 1 through 100.'
      using errcode = '22023';
  end if;
  if p_planned_units is not null and p_planned_units < 0
     or p_actual_units is not null and p_actual_units < 0
     or p_actual_rate is not null and p_actual_rate < 0
     or p_actual_cost is not null and p_actual_cost < 0 then
    raise exception 'Cost assignment facts cannot be negative.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('schedule-project:' || p_project_id, 0));
  perform 1
  from public.schedule_tasks task
  where task.id = p_task_id and task.project_id = p_project_id
  for update;
  if not found then
    raise exception 'Schedule task not found in this project.' using errcode = 'P0002';
  end if;
  perform 1
  from public.schedule_resources resource
  where resource.id = p_resource_id and resource.project_id = p_project_id
  for update;
  if not found then
    raise exception 'Schedule resource not found in this project.' using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.schedule_task_assignments assignment
  where assignment.task_id = p_task_id
    and assignment.resource_id = p_resource_id
    and assignment.project_id = p_project_id
  for update;

  if found then
    if p_expected_cost_version is null
       or v_existing.cost_version <> p_expected_cost_version then
      raise exception 'Cost assignment changed since it was loaded.'
        using errcode = '40001';
    end if;
    update public.schedule_task_assignments
    set allocation_percent = p_allocation_percent,
        planned_units = p_planned_units,
        actual_units = p_actual_units,
        actual_rate = p_actual_rate,
        actual_cost = p_actual_cost,
        updated_by_user_id = v_actor
    where id = v_existing.id
    returning * into v_assignment;
  else
    if p_expected_cost_version is not null then
      raise exception 'A new assignment cannot have an expected version.'
        using errcode = '22023';
    end if;
    insert into public.schedule_task_assignments(
      project_id,
      task_id,
      resource_id,
      allocation_percent,
      planned_units,
      actual_units,
      actual_rate,
      actual_cost,
      created_by_user_id,
      updated_by_user_id
    )
    values (
      p_project_id,
      p_task_id,
      p_resource_id,
      p_allocation_percent,
      p_planned_units,
      p_actual_units,
      p_actual_rate,
      p_actual_cost,
      v_actor,
      v_actor
    )
    returning * into v_assignment;
  end if;
  return v_assignment;
end;
$$;

revoke all on function public.upsert_schedule_cost_assignment(
  integer, uuid, uuid, integer, numeric, numeric, numeric, numeric, integer
) from public, anon, service_role;
grant execute on function public.upsert_schedule_cost_assignment(
  integer, uuid, uuid, integer, numeric, numeric, numeric, numeric, integer
) to authenticated;

create or replace function public.delete_schedule_cost_assignment(
  p_project_id integer,
  p_assignment_id uuid,
  p_expected_cost_version integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_assignment public.schedule_task_assignments;
begin
  if auth.uid() is null
     or public.current_can_manage_schedule(p_project_id::bigint) is distinct from true then
    raise exception 'Only a project schedule manager can delete cost assignments.'
      using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('schedule-project:' || p_project_id, 0));
  select * into v_assignment
  from public.schedule_task_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.project_id = p_project_id
  for update;
  if not found then
    raise exception 'Cost assignment not found in this project.' using errcode = 'P0002';
  end if;
  if v_assignment.cost_version <> p_expected_cost_version then
    raise exception 'Cost assignment changed since it was loaded.'
      using errcode = '40001';
  end if;
  delete from public.schedule_task_assignments where id = p_assignment_id;
end;
$$;

revoke all on function public.delete_schedule_cost_assignment(integer, uuid, integer)
  from public, anon, service_role;
grant execute on function public.delete_schedule_cost_assignment(integer, uuid, integer)
  to authenticated;

-- Preserve the existing all-or-nothing revision snapshot contract while
-- capturing the new immutable cost facts for every resource kind.
create or replace function public.create_schedule_revision_snapshot(
  p_project_id integer,
  p_baseline_revision_id uuid default null
)
returns public.schedule_revisions
language plpgsql
security definer
set search_path = ''
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
    raise exception 'You do not have permission to snapshot this project schedule.'
      using errcode = '42501';
  end if;

  perform 1 from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found.' using errcode = 'P0002';
  end if;

  lock table
    public.schedule_tasks,
    public.schedule_dependencies,
    public.schedule_deadlines,
    public.schedule_task_submittal_links,
    public.submittals,
    public.submittal_responses,
    public.project_schedule_calendars,
    public.project_schedule_calendar_exceptions,
    public.schedule_resources,
    public.schedule_task_assignments,
    public.schedule_resource_capacity_profiles,
    public.schedule_resource_weekday_capacity_overrides,
    public.schedule_resource_capacity_exceptions,
    public.people,
    public.project_directory_memberships
  in share mode;

  select baseline.revision_id into v_active_baseline_revision_id
  from public.schedule_baselines baseline
  where baseline.project_id = p_project_id and baseline.is_active;

  if p_baseline_revision_id is not null
     and p_baseline_revision_id is distinct from v_active_baseline_revision_id then
    raise exception 'The requested baseline is not the project active baseline.'
      using errcode = '22023';
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_next_revision_number
  from public.schedule_revisions
  where project_id = p_project_id;

  insert into public.schedule_revisions(
    project_id,
    revision_number,
    baseline_revision_id,
    created_by_user_id
  )
  values (
    p_project_id,
    v_next_revision_number,
    v_active_baseline_revision_id,
    auth.uid()
  )
  returning * into v_revision;

  select count(*) into v_source_count
  from public.schedule_tasks
  where project_id = p_project_id;
  insert into public.schedule_revision_task_snapshots(
    revision_id,
    source_task_id,
    name,
    parent_source_task_id,
    start_date,
    finish_date,
    duration_days,
    percent_complete,
    status,
    is_milestone,
    wbs_code,
    sort_order,
    actual_start_date,
    actual_finish_date,
    forecast_start_date,
    forecast_finish_date,
    remaining_duration_days,
    constraint_type,
    constraint_date,
    assignee_person_id,
    deadline_date
  )
  select
    v_revision.id,
    task.id,
    task.name,
    task.parent_task_id,
    task.start_date,
    task.finish_date,
    task.duration_days,
    task.percent_complete,
    task.status,
    task.is_milestone,
    task.wbs_code,
    task.sort_order,
    task.actual_start_date,
    task.actual_finish_date,
    task.forecast_start_date,
    task.forecast_finish_date,
    task.remaining_duration_days,
    task.constraint_type,
    task.constraint_date,
    task.assignee_person_id,
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
    revision_id,
    source_dependency_id,
    task_source_id,
    predecessor_source_id,
    dependency_type,
    lag_days
  )
  select
    v_revision.id,
    dependency.id,
    dependency.task_id,
    dependency.predecessor_task_id,
    dependency.dependency_type,
    coalesce(dependency.lag_days, 0)
  from public.schedule_dependencies dependency
  join public.schedule_tasks task on task.id = dependency.task_id
  where task.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule dependency snapshot count mismatch.'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_task_submittal_links link
  join public.submittals submittal on submittal.id = link.submittal_id
  where link.project_id = p_project_id;
  insert into public.schedule_revision_submittal_snapshots(
    revision_id,
    source_task_id,
    submittal_id,
    submittal_status,
    required_approval_date,
    submittal_number,
    title,
    response_statuses
  )
  select
    v_revision.id,
    link.task_id,
    submittal.id,
    submittal.status,
    submittal.required_approval_date,
    submittal.submittal_number,
    submittal.title,
    coalesce((
      select array_agg(
        response.response_status
        order by response.responded_at nulls last, response.id
      )
      from public.submittal_responses response
      where response.submittal_id = submittal.id
    ), '{}'::text[])
  from public.schedule_task_submittal_links link
  join public.submittals submittal on submittal.id = link.submittal_id
  where link.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule submittal snapshot count mismatch.'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resources resource
  where resource.project_id = p_project_id;
  insert into public.schedule_revision_resource_snapshots(
    revision_id,
    source_resource_id,
    source_person_id,
    display_name,
    email,
    job_title,
    person_status,
    membership_status,
    resource_kind,
    standard_rate,
    cost_per_use,
    rate_unit,
    source_cost_version
  )
  select
    v_revision.id,
    resource.id,
    resource.person_id,
    resource.display_name,
    person.email,
    person.job_title,
    case when resource.resource_kind = 'person'
      then coalesce(person.status, 'inactive')
      else null
    end,
    case when resource.resource_kind = 'person'
      then coalesce(membership.status, 'inactive')
      else null
    end,
    resource.resource_kind,
    resource.standard_rate,
    resource.cost_per_use,
    resource.rate_unit,
    resource.cost_version
  from public.schedule_resources resource
  left join public.people person on person.id = resource.person_id
  left join public.project_directory_memberships membership
    on membership.project_id = resource.project_id
   and membership.person_id = resource.person_id
  where resource.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource snapshot count mismatch.'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_task_assignments assignment
  where assignment.project_id = p_project_id;
  insert into public.schedule_revision_assignment_snapshots(
    revision_id,
    source_assignment_id,
    task_source_id,
    resource_source_id,
    allocation_percent,
    planned_units,
    actual_units,
    actual_rate,
    actual_cost,
    source_cost_version
  )
  select
    v_revision.id,
    assignment.id,
    assignment.task_id,
    assignment.resource_id,
    assignment.allocation_percent,
    assignment.planned_units,
    assignment.actual_units,
    assignment.actual_rate,
    assignment.actual_cost,
    assignment.cost_version
  from public.schedule_task_assignments assignment
  where assignment.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule assignment snapshot count mismatch.'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resources resource
  where resource.project_id = p_project_id;
  insert into public.schedule_revision_resource_capacity_snapshots(
    revision_id,
    resource_source_id,
    profile_configured,
    source_profile_id,
    source_profile_version,
    weekday_overrides,
    dated_exceptions
  )
  select
    v_revision.id,
    resource.id,
    profile.id is not null,
    profile.id,
    profile.version,
    coalesce(weekday_facts.facts, '[]'::jsonb),
    coalesce(exception_facts.facts, '[]'::jsonb)
  from public.schedule_resources resource
  left join public.schedule_resource_capacity_profiles profile
    on profile.project_id = resource.project_id
   and profile.resource_id = resource.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'weekday', weekday_override.weekday,
        'capacity_percent', weekday_override.capacity_percent
      )
      order by weekday_override.weekday
    ) as facts
    from public.schedule_resource_weekday_capacity_overrides weekday_override
    where weekday_override.profile_id = profile.id
      and weekday_override.project_id = resource.project_id
      and weekday_override.resource_id = resource.id
  ) weekday_facts on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'date', capacity_exception.exception_date,
        'capacity_percent', capacity_exception.capacity_percent,
        'reason', capacity_exception.reason
      )
      order by capacity_exception.exception_date
    ) as facts
    from public.schedule_resource_capacity_exceptions capacity_exception
    where capacity_exception.profile_id = profile.id
      and capacity_exception.project_id = resource.project_id
      and capacity_exception.resource_id = resource.id
  ) exception_facts on true
  where resource.project_id = p_project_id
  order by resource.id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource capacity snapshot count mismatch.'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resource_capacity_profiles profile
  where profile.project_id = p_project_id;
  select count(*) into v_inserted_count
  from public.schedule_revision_resource_capacity_snapshots capacity_snapshot
  where capacity_snapshot.revision_id = v_revision.id
    and capacity_snapshot.source_profile_id is not null;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource capacity profile snapshot count mismatch.'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resource_weekday_capacity_overrides weekday_override
  where weekday_override.project_id = p_project_id;
  select coalesce(
    sum(jsonb_array_length(capacity_snapshot.weekday_overrides)),
    0
  )::integer
  into v_inserted_count
  from public.schedule_revision_resource_capacity_snapshots capacity_snapshot
  where capacity_snapshot.revision_id = v_revision.id;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource weekday capacity snapshot count mismatch.'
      using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resource_capacity_exceptions capacity_exception
  where capacity_exception.project_id = p_project_id;
  select coalesce(
    sum(jsonb_array_length(capacity_snapshot.dated_exceptions)),
    0
  )::integer
  into v_inserted_count
  from public.schedule_revision_resource_capacity_snapshots capacity_snapshot
  where capacity_snapshot.revision_id = v_revision.id;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource dated capacity snapshot count mismatch.'
      using errcode = '55000';
  end if;

  select coalesce(
    calendar.working_weekdays,
    array[1, 2, 3, 4, 5]::smallint[]
  )
  into v_working_weekdays
  from (select 1) seed
  left join public.project_schedule_calendars calendar
    on calendar.project_id = p_project_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', exception.exception_date,
      'is_working', exception.is_working,
      'reason', exception.reason
    )
    order by exception.exception_date
  ), '[]'::jsonb)
  into v_calendar_exceptions
  from public.project_schedule_calendar_exceptions exception
  where exception.project_id = p_project_id;

  insert into public.schedule_revision_calendar_snapshots(
    revision_id,
    working_weekdays,
    exceptions
  )
  values (v_revision.id, v_working_weekdays, v_calendar_exceptions);

  insert into public.schedule_revision_events(
    project_id,
    revision_id,
    event_type,
    to_status,
    actor_user_id
  )
  values (
    p_project_id,
    v_revision.id,
    'created',
    'draft',
    auth.uid()
  );

  return v_revision;
end;
$$;

revoke all on function public.create_schedule_revision_snapshot(integer, uuid)
  from public, anon, service_role;
grant execute on function public.create_schedule_revision_snapshot(integer, uuid)
  to authenticated;

commit;
