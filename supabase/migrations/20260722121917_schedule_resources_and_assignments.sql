begin;

alter table public.schedule_revisions
  add column if not exists resource_context_provenance text;
update public.schedule_revisions
set resource_context_provenance = 'not_available'
where resource_context_provenance is null;
alter table public.schedule_revisions
  alter column resource_context_provenance set default 'captured',
  alter column resource_context_provenance set not null;
do $$
begin
  alter table public.schedule_revisions
    add constraint schedule_revisions_resource_context_provenance_check
    check (resource_context_provenance in ('captured', 'not_available'));
exception when duplicate_object then null;
end;
$$;

create unique index if not exists schedule_tasks_id_project_id_unique
  on public.schedule_tasks(id, project_id);

create table public.schedule_resources (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_resources_project_person_unique unique(project_id, person_id),
  constraint schedule_resources_id_project_unique unique(id, project_id),
  constraint schedule_resources_active_membership_fkey
    foreign key(project_id, person_id)
    references public.project_directory_memberships(project_id, person_id)
    on delete restrict
);

create table public.schedule_task_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  task_id uuid not null,
  resource_id uuid not null,
  allocation_percent smallint not null default 100
    constraint schedule_task_assignments_allocation_percent_check check(allocation_percent between 1 and 100),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_task_assignments_task_resource_unique unique(task_id, resource_id),
  constraint schedule_task_assignments_task_project_fkey
    foreign key(task_id, project_id)
    references public.schedule_tasks(id, project_id)
    on delete cascade,
  constraint schedule_task_assignments_resource_project_fkey
    foreign key(resource_id, project_id)
    references public.schedule_resources(id, project_id)
    on delete restrict
);

create index schedule_resources_project_idx on public.schedule_resources(project_id);
create index schedule_resources_person_idx on public.schedule_resources(person_id);
create index schedule_resources_created_by_idx on public.schedule_resources(created_by_user_id);
create index schedule_task_assignments_project_task_idx
  on public.schedule_task_assignments(project_id, task_id);
create index schedule_task_assignments_project_resource_idx
  on public.schedule_task_assignments(project_id, resource_id);
create index schedule_task_assignments_resource_project_idx
  on public.schedule_task_assignments(resource_id, project_id);
create index schedule_task_assignments_created_by_idx
  on public.schedule_task_assignments(created_by_user_id);
create index schedule_task_assignments_updated_by_idx
  on public.schedule_task_assignments(updated_by_user_id);

create trigger schedule_resources_set_updated_at
before update on public.schedule_resources
for each row execute function public.update_updated_at_column();
create trigger schedule_task_assignments_set_updated_at
before update on public.schedule_task_assignments
for each row execute function public.update_updated_at_column();

create table public.schedule_revision_resource_snapshots (
  revision_id uuid not null references public.schedule_revisions(id) on delete cascade,
  source_resource_id uuid not null,
  source_person_id uuid not null,
  display_name text not null,
  email text,
  job_title text,
  person_status text not null,
  membership_status text not null,
  primary key(revision_id, source_resource_id)
);

create table public.schedule_revision_assignment_snapshots (
  revision_id uuid not null references public.schedule_revisions(id) on delete cascade,
  source_assignment_id uuid not null,
  task_source_id uuid not null,
  resource_source_id uuid not null,
  allocation_percent smallint not null
    constraint schedule_revision_assignment_allocation_percent_check check(allocation_percent between 1 and 100),
  primary key(revision_id, source_assignment_id),
  constraint schedule_revision_assignment_task_snapshot_fkey
    foreign key(revision_id, task_source_id)
    references public.schedule_revision_task_snapshots(revision_id, source_task_id)
    on delete cascade,
  constraint schedule_revision_assignment_resource_snapshot_fkey
    foreign key(revision_id, resource_source_id)
    references public.schedule_revision_resource_snapshots(revision_id, source_resource_id)
    on delete cascade
);

create index schedule_revision_resource_snapshots_person_idx
  on public.schedule_revision_resource_snapshots(revision_id, source_person_id);
create index schedule_revision_assignment_snapshots_task_idx
  on public.schedule_revision_assignment_snapshots(revision_id, task_source_id);
create index schedule_revision_assignment_snapshots_resource_idx
  on public.schedule_revision_assignment_snapshots(revision_id, resource_source_id);

alter table public.schedule_resources enable row level security;
alter table public.schedule_task_assignments enable row level security;
alter table public.schedule_revision_resource_snapshots enable row level security;
alter table public.schedule_revision_assignment_snapshots enable row level security;

revoke all on public.schedule_resources, public.schedule_task_assignments,
  public.schedule_revision_resource_snapshots, public.schedule_revision_assignment_snapshots
  from public, anon, authenticated, service_role;
grant select on public.schedule_resources, public.schedule_task_assignments,
  public.schedule_revision_resource_snapshots, public.schedule_revision_assignment_snapshots
  to authenticated;
grant all on public.schedule_resources, public.schedule_task_assignments to service_role;
grant select on public.schedule_revision_resource_snapshots,
  public.schedule_revision_assignment_snapshots to service_role;

create policy schedule_resources_project_member_read
  on public.schedule_resources for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));
create policy schedule_task_assignments_project_member_read
  on public.schedule_task_assignments for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));
create policy schedule_revision_resource_snapshots_project_member_read
  on public.schedule_revision_resource_snapshots for select to authenticated
  using (exists (
    select 1 from public.schedule_revisions revision
    where revision.id = revision_id
      and (public.current_is_app_admin() or public.current_is_project_member(revision.project_id::bigint))
  ));
create policy schedule_revision_assignment_snapshots_project_member_read
  on public.schedule_revision_assignment_snapshots for select to authenticated
  using (exists (
    select 1 from public.schedule_revisions revision
    where revision.id = revision_id
      and (public.current_is_app_admin() or public.current_is_project_member(revision.project_id::bigint))
  ));

create trigger schedule_revision_resource_snapshots_immutable
before update or delete on public.schedule_revision_resource_snapshots
for each row execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_revision_assignment_snapshots_immutable
before update or delete on public.schedule_revision_assignment_snapshots
for each row execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_revision_resource_snapshots_no_truncate
before truncate on public.schedule_revision_resource_snapshots
for each statement execute function public.reject_schedule_snapshot_mutation();
create trigger schedule_revision_assignment_snapshots_no_truncate
before truncate on public.schedule_revision_assignment_snapshots
for each statement execute function public.reject_schedule_snapshot_mutation();

create or replace function public.replace_schedule_task_assignments(
  p_project_id integer,
  p_task_id uuid,
  p_assignments jsonb
)
returns setof public.schedule_task_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item jsonb;
  v_input_count integer;
  v_allocation numeric;
begin
  if v_actor is null or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'You do not have permission to manage this project schedule.' using errcode = '42501';
  end if;

  perform 1
  from public.schedule_tasks task
  where task.id = p_task_id and task.project_id = p_project_id
  for update;
  if not found then
    raise exception 'Schedule task not found in this project.' using errcode = 'P0002';
  end if;

  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Assignments must be a JSON array.' using errcode = '22023';
  end if;
  v_input_count := jsonb_array_length(p_assignments);
  if v_input_count > 100 then
    raise exception 'A task cannot have more than 100 resource assignments.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_assignments) loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'person_id')
       or not (v_item ? 'allocation_percent')
       or (v_item - 'person_id' - 'allocation_percent') <> '{}'::jsonb then
      raise exception 'Each assignment requires only person_id and an integer allocation_percent from 1 through 100.' using errcode = '22023';
    end if;

    if jsonb_typeof(v_item->'person_id') is distinct from 'string'
       or (v_item->>'person_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Each assignment requires a valid person_id UUID.' using errcode = '22023';
    end if;

    if jsonb_typeof(v_item->'allocation_percent') is distinct from 'number' then
      raise exception 'Each allocation_percent must be a whole number from 1 through 100.' using errcode = '22023';
    end if;

    begin
      v_allocation := (v_item->>'allocation_percent')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Each allocation_percent must be a whole number from 1 through 100.' using errcode = '22023';
    end;

    if v_allocation <> trunc(v_allocation) or v_allocation not between 1 and 100 then
      raise exception 'Each allocation_percent must be a whole number from 1 through 100.' using errcode = '22023';
    end if;
  end loop;

  if (
    select count(distinct (value->>'person_id')::uuid)
    from jsonb_array_elements(p_assignments)
  ) <> v_input_count then
    raise exception 'A person can be assigned to a task only once.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) input
    where not exists (
      select 1
      from public.project_directory_memberships membership
      join public.people person on person.id = membership.person_id
      where membership.project_id = p_project_id
        and membership.person_id = (input->>'person_id')::uuid
        and membership.status = 'active'
        and person.status = 'active'
    )
  ) then
    raise exception 'Every assigned person must be active in the project directory.' using errcode = '22023';
  end if;

  insert into public.schedule_resources(project_id, person_id, created_by_user_id)
  select p_project_id, (input->>'person_id')::uuid, v_actor
  from jsonb_array_elements(p_assignments) input
  on conflict(project_id, person_id) do update set updated_at = now();

  delete from public.schedule_task_assignments assignment
  where assignment.project_id = p_project_id
    and assignment.task_id = p_task_id
    and not exists (
      select 1
      from jsonb_array_elements(p_assignments) input
      join public.schedule_resources resource
        on resource.project_id = p_project_id
       and resource.person_id = (input->>'person_id')::uuid
      where resource.id = assignment.resource_id
    );

  insert into public.schedule_task_assignments(
    project_id, task_id, resource_id, allocation_percent,
    created_by_user_id, updated_by_user_id
  )
  select p_project_id, p_task_id, resource.id,
    (input->>'allocation_percent')::smallint, v_actor, v_actor
  from jsonb_array_elements(p_assignments) input
  join public.schedule_resources resource
    on resource.project_id = p_project_id
   and resource.person_id = (input->>'person_id')::uuid
  on conflict(task_id, resource_id) do update
  set allocation_percent = excluded.allocation_percent,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now();

  return query
  select assignment.*
  from public.schedule_task_assignments assignment
  where assignment.project_id = p_project_id and assignment.task_id = p_task_id
  order by assignment.resource_id;
end;
$$;

revoke all on function public.replace_schedule_task_assignments(integer, uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.replace_schedule_task_assignments(integer, uuid, jsonb)
  to authenticated;

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
