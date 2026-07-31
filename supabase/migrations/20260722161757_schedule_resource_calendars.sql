begin;

alter table public.schedule_revisions
  add column if not exists resource_capacity_context_provenance text;

update public.schedule_revisions
set resource_capacity_context_provenance = 'not_available'
where resource_capacity_context_provenance is null;

alter table public.schedule_revisions
  alter column resource_capacity_context_provenance set default 'captured',
  alter column resource_capacity_context_provenance set not null;

do $$
begin
  alter table public.schedule_revisions
    add constraint schedule_revisions_resource_capacity_context_provenance_check
    check (resource_capacity_context_provenance in ('captured', 'not_available'));
exception when duplicate_object then null;
end;
$$;

create table public.schedule_resource_capacity_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  resource_id uuid not null,
  version integer not null default 1
    constraint schedule_resource_capacity_profiles_version_check check (version > 0),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_resource_capacity_profiles_project_resource_unique
    unique (project_id, resource_id),
  constraint schedule_resource_capacity_profiles_id_project_resource_unique
    unique (id, project_id, resource_id),
  constraint schedule_resource_capacity_profiles_resource_project_fkey
    foreign key (resource_id, project_id)
    references public.schedule_resources(id, project_id)
    on delete cascade
);

create table public.schedule_resource_weekday_capacity_overrides (
  profile_id uuid not null,
  project_id integer not null,
  resource_id uuid not null,
  weekday smallint not null
    constraint schedule_resource_weekday_capacity_overrides_weekday_check
      check (weekday between 0 and 6),
  capacity_percent smallint not null
    constraint schedule_resource_weekday_capacity_overrides_capacity_check
      check (capacity_percent between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (profile_id, weekday),
  constraint schedule_resource_weekday_capacity_project_resource_day_key
    unique (project_id, resource_id, weekday),
  constraint schedule_resource_weekday_capacity_profile_tenant_fkey
    foreign key (profile_id, project_id, resource_id)
    references public.schedule_resource_capacity_profiles(id, project_id, resource_id)
    on delete cascade
);

create table public.schedule_resource_capacity_exceptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  project_id integer not null,
  resource_id uuid not null,
  exception_date date not null,
  capacity_percent smallint not null
    constraint schedule_resource_capacity_exceptions_capacity_check
      check (capacity_percent between 0 and 100),
  reason text,
  created_at timestamptz not null default now(),
  constraint schedule_resource_capacity_exceptions_reason_check check (
    reason is null
    or (
      reason = btrim(reason)
      and char_length(reason) between 1 and 240
    )
  ),
  constraint schedule_resource_capacity_exception_project_resource_date_key
    unique (project_id, resource_id, exception_date),
  constraint schedule_resource_capacity_exceptions_profile_tenant_fkey
    foreign key (profile_id, project_id, resource_id)
    references public.schedule_resource_capacity_profiles(id, project_id, resource_id)
    on delete cascade
);

create index schedule_resource_capacity_profiles_resource_project_idx
  on public.schedule_resource_capacity_profiles(resource_id, project_id);
create index schedule_resource_capacity_profiles_created_by_idx
  on public.schedule_resource_capacity_profiles(created_by_user_id);
create index schedule_resource_capacity_profiles_updated_by_idx
  on public.schedule_resource_capacity_profiles(updated_by_user_id);
create index schedule_resource_weekday_capacity_overrides_profile_idx
  on public.schedule_resource_weekday_capacity_overrides(profile_id, project_id, resource_id);
create index schedule_resource_capacity_exceptions_profile_idx
  on public.schedule_resource_capacity_exceptions(profile_id, project_id, resource_id);

create trigger schedule_resource_capacity_profiles_set_updated_at
before update on public.schedule_resource_capacity_profiles
for each row execute function public.update_updated_at_column();

create table public.schedule_revision_resource_capacity_snapshots (
  revision_id uuid not null references public.schedule_revisions(id) on delete cascade,
  resource_source_id uuid not null,
  profile_configured boolean not null,
  source_profile_id uuid,
  source_profile_version integer,
  weekday_overrides jsonb not null default '[]'::jsonb,
  dated_exceptions jsonb not null default '[]'::jsonb,
  primary key (revision_id, resource_source_id),
  constraint schedule_revision_resource_capacity_profile_source_check check (
    (
      not profile_configured
      and source_profile_id is null
      and source_profile_version is null
    )
    or (
      profile_configured
      and source_profile_id is not null
      and source_profile_version is not null
      and source_profile_version > 0
    )
  ),
  constraint schedule_revision_resource_capacity_weekdays_array_check
    check (jsonb_typeof(weekday_overrides) = 'array'),
  constraint schedule_revision_resource_capacity_exceptions_array_check
    check (jsonb_typeof(dated_exceptions) = 'array'),
  constraint schedule_revision_resource_capacity_resource_snapshot_fkey
    foreign key (revision_id, resource_source_id)
    references public.schedule_revision_resource_snapshots(revision_id, source_resource_id)
    on delete cascade
);

create index schedule_revision_resource_capacity_profile_idx
  on public.schedule_revision_resource_capacity_snapshots(source_profile_id)
  where source_profile_id is not null;

alter table public.schedule_resource_capacity_profiles enable row level security;
alter table public.schedule_resource_weekday_capacity_overrides enable row level security;
alter table public.schedule_resource_capacity_exceptions enable row level security;
alter table public.schedule_revision_resource_capacity_snapshots enable row level security;

revoke all on
  public.schedule_resource_capacity_profiles,
  public.schedule_resource_weekday_capacity_overrides,
  public.schedule_resource_capacity_exceptions,
  public.schedule_revision_resource_capacity_snapshots
from public, anon, authenticated, service_role;

grant select on
  public.schedule_resource_capacity_profiles,
  public.schedule_resource_weekday_capacity_overrides,
  public.schedule_resource_capacity_exceptions,
  public.schedule_revision_resource_capacity_snapshots
to authenticated;

grant select, insert, update, delete on
  public.schedule_resource_capacity_profiles,
  public.schedule_resource_weekday_capacity_overrides,
  public.schedule_resource_capacity_exceptions
to service_role;

grant select on public.schedule_revision_resource_capacity_snapshots to service_role;

create policy schedule_resource_capacity_profiles_project_member_read
  on public.schedule_resource_capacity_profiles for select to authenticated
  using (
    public.current_is_app_admin()
    or public.current_is_project_member(project_id::bigint)
  );

create policy schedule_resource_weekday_capacity_project_member_read
  on public.schedule_resource_weekday_capacity_overrides for select to authenticated
  using (
    public.current_is_app_admin()
    or public.current_is_project_member(project_id::bigint)
  );

create policy schedule_resource_capacity_exceptions_project_member_read
  on public.schedule_resource_capacity_exceptions for select to authenticated
  using (
    public.current_is_app_admin()
    or public.current_is_project_member(project_id::bigint)
  );

create policy schedule_revision_resource_capacity_project_member_read
  on public.schedule_revision_resource_capacity_snapshots for select to authenticated
  using (exists (
    select 1
    from public.schedule_revisions revision
    where revision.id = revision_id
      and (
        public.current_is_app_admin()
        or public.current_is_project_member(revision.project_id::bigint)
      )
  ));

create trigger schedule_revision_resource_capacity_snapshots_immutable
before update or delete on public.schedule_revision_resource_capacity_snapshots
for each row execute function public.reject_schedule_snapshot_mutation();

create trigger schedule_revision_resource_capacity_snapshots_no_truncate
before truncate on public.schedule_revision_resource_capacity_snapshots
for each statement execute function public.reject_schedule_snapshot_mutation();

create or replace function public.replace_schedule_resource_capacity_profile(
  p_project_id integer,
  p_resource_id uuid,
  p_weekday_overrides jsonb,
  p_exceptions jsonb
)
returns public.schedule_resource_capacity_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_resource_project_id integer;
  v_person_id uuid;
  v_person_status text;
  v_membership_status text;
  v_item jsonb;
  v_weekday numeric;
  v_capacity numeric;
  v_exception_date date;
  v_profile public.schedule_resource_capacity_profiles;
begin
  if v_actor is null then
    raise exception 'You do not have permission to manage resource capacity for this project.'
      using errcode = '42501';
  end if;

  if p_project_id is null or p_project_id <= 0 then
    raise exception 'Project ID must be a positive integer.' using errcode = '22023';
  end if;

  if not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'You do not have permission to manage resource capacity for this project.'
      using errcode = '42501';
  end if;

  select resource.project_id, resource.person_id
  into v_resource_project_id, v_person_id
  from public.schedule_resources resource
  where resource.id = p_resource_id
  for update;

  if not found then
    raise exception 'Schedule resource not found.' using errcode = 'P0002';
  end if;

  if v_resource_project_id <> p_project_id then
    raise exception 'Schedule resource does not belong to the requested project.'
      using errcode = '23503';
  end if;

  select person.status
  into v_person_status
  from public.people person
  where person.id = v_person_id
  for share;

  if not found then
    raise exception 'The schedule resource person no longer exists.' using errcode = '23503';
  end if;

  if v_person_status is distinct from 'active' then
    raise exception 'Resource capacity can be changed only for an active person.'
      using errcode = '23514';
  end if;

  select membership.status
  into v_membership_status
  from public.project_directory_memberships membership
  where membership.project_id = p_project_id
    and membership.person_id = v_person_id
  for share;

  if not found then
    raise exception 'The schedule resource no longer has a project directory membership.'
      using errcode = '23503';
  end if;

  if v_membership_status is distinct from 'active' then
    raise exception 'Resource capacity can be changed only for an active project member.'
      using errcode = '23514';
  end if;

  if p_weekday_overrides is null
     or jsonb_typeof(p_weekday_overrides) <> 'array' then
    raise exception 'Weekday overrides must be a JSON array.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_weekday_overrides) > 7 then
    raise exception 'A resource capacity profile cannot contain more than 7 weekday overrides.'
      using errcode = '54000';
  end if;

  for v_item in select value from jsonb_array_elements(p_weekday_overrides)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'weekday')
       or not (v_item ? 'capacity_percent')
       or (v_item - 'weekday' - 'capacity_percent') <> '{}'::jsonb then
      raise exception 'Each weekday override requires only weekday and capacity_percent.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_item->'weekday') is distinct from 'number' then
      raise exception 'Each weekday must be a whole number from 0 through 6.'
        using errcode = '22023';
    end if;

    begin
      v_weekday := (v_item->>'weekday')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Each weekday must be a whole number from 0 through 6.'
          using errcode = '22023';
    end;

    if v_weekday <> trunc(v_weekday) or v_weekday not between 0 and 6 then
      raise exception 'Each weekday must be a whole number from 0 through 6.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_item->'capacity_percent') is distinct from 'number' then
      raise exception 'Each weekday capacity_percent must be a whole number from 0 through 100.'
        using errcode = '22003';
    end if;

    begin
      v_capacity := (v_item->>'capacity_percent')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Each weekday capacity_percent must be a whole number from 0 through 100.'
          using errcode = '22003';
    end;

    if v_capacity <> trunc(v_capacity) or v_capacity not between 0 and 100 then
      raise exception 'Each weekday capacity_percent must be a whole number from 0 through 100.'
        using errcode = '22003';
    end if;
  end loop;

  if (
    select count(distinct (input.value->>'weekday')::smallint)
    from jsonb_array_elements(p_weekday_overrides) input
  ) <> jsonb_array_length(p_weekday_overrides) then
    raise exception 'A weekday can be overridden only once per resource capacity profile.'
      using errcode = '23505';
  end if;

  if p_exceptions is null or jsonb_typeof(p_exceptions) <> 'array' then
    raise exception 'Capacity exceptions must be a JSON array.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_exceptions) > 1000 then
    raise exception 'A resource capacity profile cannot contain more than 1000 dated exceptions.'
      using errcode = '54000';
  end if;

  for v_item in select value from jsonb_array_elements(p_exceptions)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'date')
       or not (v_item ? 'capacity_percent')
       or (v_item - 'date' - 'capacity_percent' - 'reason') <> '{}'::jsonb then
      raise exception 'Each capacity exception requires date and capacity_percent, with only an optional reason.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_item->'date') is distinct from 'string'
       or (v_item->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Each capacity exception date must use valid YYYY-MM-DD format.'
        using errcode = '22007';
    end if;

    begin
      v_exception_date := (v_item->>'date')::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        raise exception 'Each capacity exception date must use valid YYYY-MM-DD format.'
          using errcode = '22007';
    end;

    if to_char(v_exception_date, 'YYYY-MM-DD') <> (v_item->>'date') then
      raise exception 'Each capacity exception date must use valid YYYY-MM-DD format.'
        using errcode = '22007';
    end if;

    if jsonb_typeof(v_item->'capacity_percent') is distinct from 'number' then
      raise exception 'Each exception capacity_percent must be a whole number from 0 through 100.'
        using errcode = '22003';
    end if;

    begin
      v_capacity := (v_item->>'capacity_percent')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Each exception capacity_percent must be a whole number from 0 through 100.'
          using errcode = '22003';
    end;

    if v_capacity <> trunc(v_capacity) or v_capacity not between 0 and 100 then
      raise exception 'Each exception capacity_percent must be a whole number from 0 through 100.'
        using errcode = '22003';
    end if;

    if v_item ? 'reason'
       and jsonb_typeof(v_item->'reason') is distinct from 'null' then
      if jsonb_typeof(v_item->'reason') is distinct from 'string'
         or (v_item->>'reason') <> btrim(v_item->>'reason')
         or char_length(v_item->>'reason') not between 1 and 240 then
        raise exception 'A capacity exception reason must contain 1 to 240 trimmed characters or be null.'
          using errcode = '22001';
      end if;
    end if;
  end loop;

  if (
    select count(distinct (input.value->>'date')::date)
    from jsonb_array_elements(p_exceptions) input
  ) <> jsonb_array_length(p_exceptions) then
    raise exception 'A date can appear only once per resource capacity profile.'
      using errcode = '23505';
  end if;

  insert into public.schedule_resource_capacity_profiles as existing_profile(
    project_id,
    resource_id,
    version,
    created_by_user_id,
    updated_by_user_id
  )
  values (p_project_id, p_resource_id, 1, v_actor, v_actor)
  on conflict (project_id, resource_id) do update
  set version = existing_profile.version + 1,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now()
  returning * into v_profile;

  delete from public.schedule_resource_weekday_capacity_overrides override_row
  where override_row.profile_id = v_profile.id
    and override_row.project_id = p_project_id
    and override_row.resource_id = p_resource_id;

  delete from public.schedule_resource_capacity_exceptions exception_row
  where exception_row.profile_id = v_profile.id
    and exception_row.project_id = p_project_id
    and exception_row.resource_id = p_resource_id;

  insert into public.schedule_resource_weekday_capacity_overrides(
    profile_id,
    project_id,
    resource_id,
    weekday,
    capacity_percent
  )
  select
    v_profile.id,
    p_project_id,
    p_resource_id,
    (input.value->>'weekday')::smallint,
    (input.value->>'capacity_percent')::smallint
  from jsonb_array_elements(p_weekday_overrides) input
  order by (input.value->>'weekday')::smallint;

  insert into public.schedule_resource_capacity_exceptions(
    profile_id,
    project_id,
    resource_id,
    exception_date,
    capacity_percent,
    reason
  )
  select
    v_profile.id,
    p_project_id,
    p_resource_id,
    (input.value->>'date')::date,
    (input.value->>'capacity_percent')::smallint,
    case
      when input.value ? 'reason' and jsonb_typeof(input.value->'reason') = 'string'
        then input.value->>'reason'
      else null
    end
  from jsonb_array_elements(p_exceptions) input
  order by (input.value->>'date')::date;

  return v_profile;
end;
$$;

revoke all on function public.replace_schedule_resource_capacity_profile(
  integer,
  uuid,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.replace_schedule_resource_capacity_profile(
  integer,
  uuid,
  jsonb,
  jsonb
) to authenticated;

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
    raise exception 'You do not have permission to snapshot this project schedule.' using errcode = '42501';
  end if;

  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;

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

  select count(*) into v_source_count
  from public.schedule_task_submittal_links link
  join public.submittals submittal on submittal.id = link.submittal_id
  where link.project_id = p_project_id;
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
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule submittal snapshot count mismatch.' using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resources resource
  where resource.project_id = p_project_id;
  insert into public.schedule_revision_resource_snapshots(
    revision_id, source_resource_id, source_person_id, display_name,
    email, job_title, person_status, membership_status
  )
  select v_revision.id, resource.id, resource.person_id,
    coalesce(nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''), person.email, 'Unnamed resource'),
    person.email, person.job_title, coalesce(person.status, 'inactive'),
    coalesce(membership.status, 'inactive')
  from public.schedule_resources resource
  join public.people person on person.id = resource.person_id
  join public.project_directory_memberships membership
    on membership.project_id = resource.project_id and membership.person_id = resource.person_id
  where resource.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource snapshot count mismatch.' using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_task_assignments assignment
  where assignment.project_id = p_project_id;
  insert into public.schedule_revision_assignment_snapshots(
    revision_id, source_assignment_id, task_source_id, resource_source_id, allocation_percent
  )
  select v_revision.id, assignment.id, assignment.task_id, assignment.resource_id,
    assignment.allocation_percent
  from public.schedule_task_assignments assignment
  where assignment.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule assignment snapshot count mismatch.' using errcode = '55000';
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
      ) order by weekday_override.weekday
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
      ) order by capacity_exception.exception_date
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
    raise exception 'Schedule resource capacity snapshot count mismatch.' using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resource_capacity_profiles profile
  where profile.project_id = p_project_id;
  select count(*) into v_inserted_count
  from public.schedule_revision_resource_capacity_snapshots capacity_snapshot
  where capacity_snapshot.revision_id = v_revision.id
    and capacity_snapshot.source_profile_id is not null;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource capacity profile snapshot count mismatch.' using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resource_weekday_capacity_overrides weekday_override
  where weekday_override.project_id = p_project_id;
  select coalesce(sum(jsonb_array_length(capacity_snapshot.weekday_overrides)), 0)::integer
  into v_inserted_count
  from public.schedule_revision_resource_capacity_snapshots capacity_snapshot
  where capacity_snapshot.revision_id = v_revision.id;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource weekday capacity snapshot count mismatch.' using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_resource_capacity_exceptions capacity_exception
  where capacity_exception.project_id = p_project_id;
  select coalesce(sum(jsonb_array_length(capacity_snapshot.dated_exceptions)), 0)::integer
  into v_inserted_count
  from public.schedule_revision_resource_capacity_snapshots capacity_snapshot
  where capacity_snapshot.revision_id = v_revision.id;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule resource dated capacity snapshot count mismatch.' using errcode = '55000';
  end if;

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

revoke all on function public.create_schedule_revision_snapshot(integer, uuid)
  from public, anon, service_role;
grant execute on function public.create_schedule_revision_snapshot(integer, uuid)
  to authenticated;

commit;
