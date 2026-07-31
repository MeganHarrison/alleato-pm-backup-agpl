-- Keep the legacy people-assignment editor compatible with cost resources.
--
-- The editor owns only person-kind assignments. Equipment and material cost
-- assignments are managed by the cost API and must survive a people replace.

begin;

-- Dependency edits are schedule-version mutations for both endpoints. This
-- makes the task version vector a durable graph-race guard even for callers
-- that loaded the graph before entering the authoritative project lock.
create or replace function private.bump_schedule_dependency_task_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.schedule_tasks task
  set schedule_version = task.schedule_version + 1
  where task.id in (
    case when tg_op in ('UPDATE', 'DELETE') then old.task_id else null end,
    case when tg_op in ('UPDATE', 'DELETE') then old.predecessor_task_id else null end,
    case when tg_op in ('INSERT', 'UPDATE') then new.task_id else null end,
    case when tg_op in ('INSERT', 'UPDATE') then new.predecessor_task_id else null end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_dependencies_bump_task_versions
  on public.schedule_dependencies;
create trigger schedule_dependencies_bump_task_versions
after insert or update or delete on public.schedule_dependencies
for each row execute function private.bump_schedule_dependency_task_versions();

drop function if exists public.replace_schedule_task_assignments(integer, uuid, jsonb);

create function public.replace_schedule_task_assignments(
  p_project_id integer,
  p_task_id uuid,
  p_assignments jsonb,
  p_expected_assignments jsonb
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
  v_current_assignments jsonb;
  v_submitted_assignments jsonb;
begin
  if v_actor is null
     or public.current_can_manage_schedule(p_project_id::bigint) is distinct from true then
    raise exception 'You do not have permission to manage this project schedule.'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('schedule-project:' || p_project_id, 0)
  );

  perform 1
  from public.schedule_tasks task
  where task.id = p_task_id
    and task.project_id = p_project_id
  for update;
  if not found then
    raise exception 'Schedule task not found in this project.' using errcode = 'P0002';
  end if;

  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Assignments must be a JSON array.' using errcode = '22023';
  end if;
  if p_expected_assignments is null
     or jsonb_typeof(p_expected_assignments) <> 'array' then
    raise exception 'Expected assignments must be a JSON array.' using errcode = '22023';
  end if;
  v_input_count := jsonb_array_length(p_assignments);
  if v_input_count > 100 or jsonb_array_length(p_expected_assignments) > 100 then
    raise exception 'A task cannot have more than 100 resource assignments.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_assignments) loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'person_id')
       or not (v_item ? 'allocation_percent')
       or (v_item - 'person_id' - 'allocation_percent') <> '{}'::jsonb then
      raise exception 'Each assignment requires only person_id and an integer allocation_percent from 1 through 100.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_item -> 'person_id') is distinct from 'string'
       or (v_item ->> 'person_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Each assignment requires a valid person_id UUID.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'allocation_percent') is distinct from 'number' then
      raise exception 'Each allocation_percent must be a whole number from 1 through 100.'
        using errcode = '22023';
    end if;

    begin
      v_allocation := (v_item ->> 'allocation_percent')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Each allocation_percent must be a whole number from 1 through 100.'
          using errcode = '22023';
    end;

    if v_allocation <> trunc(v_allocation) or v_allocation not between 1 and 100 then
      raise exception 'Each allocation_percent must be a whole number from 1 through 100.'
        using errcode = '22023';
    end if;
  end loop;

  if (
    select count(distinct (value ->> 'person_id')::uuid)
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
        and membership.person_id = (input ->> 'person_id')::uuid
        and membership.status = 'active'
        and person.status = 'active'
    )
  ) then
    raise exception 'Every assigned person must be active in the project directory.'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_expected_assignments) loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'id')
       or not (v_item ? 'person_id')
       or not (v_item ? 'cost_version')
       or (v_item - 'id' - 'person_id' - 'cost_version') <> '{}'::jsonb
       or jsonb_typeof(v_item -> 'id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'person_id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'cost_version') is distinct from 'number'
       or (v_item ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or (v_item ->> 'person_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or (v_item ->> 'cost_version')::numeric <> trunc((v_item ->> 'cost_version')::numeric)
       or (v_item ->> 'cost_version')::integer <= 0 then
      raise exception 'Each expected assignment requires only id, person_id, and a positive integer cost_version.'
        using errcode = '22023';
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', assignment.id,
        'person_id', resource.person_id,
        'cost_version', assignment.cost_version
      )
      order by assignment.id
    ),
    '[]'::jsonb
  )
  into v_current_assignments
  from public.schedule_task_assignments assignment
  join public.schedule_resources resource
    on resource.id = assignment.resource_id
   and resource.project_id = assignment.project_id
  where assignment.project_id = p_project_id
    and assignment.task_id = p_task_id
    and resource.resource_kind = 'person';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', expected.id,
        'person_id', expected.person_id,
        'cost_version', expected.cost_version
      )
      order by expected.id
    ),
    '[]'::jsonb
  )
  into v_submitted_assignments
  from jsonb_to_recordset(p_expected_assignments) as expected(
    id uuid,
    person_id uuid,
    cost_version integer
  );

  if v_current_assignments is distinct from v_submitted_assignments then
    raise exception 'Schedule person assignments changed since they were loaded.'
      using errcode = '40001';
  end if;

  insert into public.schedule_resources(
    project_id,
    person_id,
    resource_kind,
    display_name,
    created_by_user_id
  )
  select
    p_project_id,
    person.id,
    'person',
    coalesce(
      nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''),
      person.email,
      'Unnamed person'
    ),
    v_actor
  from jsonb_array_elements(p_assignments) input
  join public.people person on person.id = (input ->> 'person_id')::uuid
  on conflict(project_id, person_id) where resource_kind = 'person' do update
  set display_name = excluded.display_name,
      updated_at = now();

  -- This legacy replacement boundary owns people only. Cost-resource
  -- assignments are independently versioned and must never be removed here.
  delete from public.schedule_task_assignments assignment
  using public.schedule_resources resource
  where assignment.project_id = p_project_id
    and assignment.task_id = p_task_id
    and resource.id = assignment.resource_id
    and resource.project_id = assignment.project_id
    and resource.resource_kind = 'person'
    and not exists (
      select 1
      from jsonb_array_elements(p_assignments) input
      where resource.person_id = (input ->> 'person_id')::uuid
    );

  insert into public.schedule_task_assignments(
    project_id,
    task_id,
    resource_id,
    allocation_percent,
    created_by_user_id,
    updated_by_user_id
  )
  select
    p_project_id,
    p_task_id,
    resource.id,
    (input ->> 'allocation_percent')::smallint,
    v_actor,
    v_actor
  from jsonb_array_elements(p_assignments) input
  join public.schedule_resources resource
    on resource.project_id = p_project_id
   and resource.person_id = (input ->> 'person_id')::uuid
   and resource.resource_kind = 'person'
  on conflict(task_id, resource_id) do update
  set allocation_percent = excluded.allocation_percent,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now();

  return query
  select assignment.*
  from public.schedule_task_assignments assignment
  join public.schedule_resources resource on resource.id = assignment.resource_id
  where assignment.project_id = p_project_id
    and assignment.task_id = p_task_id
    and resource.resource_kind = 'person'
  order by assignment.resource_id;
end;
$$;

revoke all on function public.replace_schedule_task_assignments(integer, uuid, jsonb, jsonb)
  from public, anon, service_role;
grant execute on function public.replace_schedule_task_assignments(integer, uuid, jsonb, jsonb)
  to authenticated;

comment on function public.replace_schedule_task_assignments(integer, uuid, jsonb, jsonb) is
  'Atomically replaces person-kind task assignments while preserving independently managed equipment and material cost assignments.';

commit;
