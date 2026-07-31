begin;

create index schedule_resource_capacity_exceptions_project_date_resource_idx
  on public.schedule_resource_capacity_exceptions(project_id, exception_date, resource_id);

drop function public.replace_schedule_resource_capacity_profile(integer, uuid, jsonb, jsonb);

create function public.replace_schedule_resource_capacity_profile(
  p_project_id integer,
  p_resource_id uuid,
  p_weekday_overrides jsonb,
  p_exceptions jsonb,
  p_expected_version integer
)
returns jsonb
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
  v_profile_exists boolean;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'You do not have permission to manage resource capacity for this project.'
      using errcode = '42501';
  end if;

  if p_project_id is null or p_project_id <= 0 then
    raise exception 'Project ID must be a positive integer.' using errcode = '22023';
  end if;

  if p_expected_version is not null and p_expected_version <= 0 then
    raise exception 'Expected resource capacity profile version must be a positive integer or null.'
      using errcode = '22023';
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

  select profile.*
  into v_profile
  from public.schedule_resource_capacity_profiles profile
  where profile.project_id = p_project_id
    and profile.resource_id = p_resource_id
  for update;
  v_profile_exists := found;

  if v_profile_exists and p_expected_version is null then
    raise exception 'Resource capacity profile version conflict: expected an unconfigured profile, but current version is %.',
      v_profile.version
      using
        errcode = '40001',
        hint = 'Reload the resource capacity profile and retry with its current version.';
  end if;

  if not v_profile_exists and p_expected_version is not null then
    raise exception 'Resource capacity profile version conflict: expected version %, but no profile is configured.',
      p_expected_version
      using
        errcode = '40001',
        hint = 'Reload the resource capacity profile and retry as a first write.';
  end if;

  if v_profile_exists and p_expected_version <> v_profile.version then
    raise exception 'Resource capacity profile version conflict: expected version %, but current version is %.',
      p_expected_version,
      v_profile.version
      using
        errcode = '40001',
        hint = 'Reload the resource capacity profile and retry with its current version.';
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

  if v_profile_exists then
    update public.schedule_resource_capacity_profiles profile
    set version = profile.version + 1,
        updated_by_user_id = v_actor,
        updated_at = now()
    where profile.id = v_profile.id
    returning profile.* into v_profile;
  else
    insert into public.schedule_resource_capacity_profiles(
      project_id,
      resource_id,
      version,
      created_by_user_id,
      updated_by_user_id
    )
    values (p_project_id, p_resource_id, 1, v_actor, v_actor)
    returning * into v_profile;
  end if;

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

  select jsonb_build_object(
    'profile_id', v_profile.id,
    'project_id', v_profile.project_id,
    'resource_id', v_profile.resource_id,
    'configured', true,
    'version', v_profile.version,
    'coverage_start_date', null,
    'coverage_finish_date', null,
    'weekday_overrides', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'weekday', override_row.weekday,
          'capacity_percent', override_row.capacity_percent
        ) order by override_row.weekday
      )
      from public.schedule_resource_weekday_capacity_overrides override_row
      where override_row.profile_id = v_profile.id
    ), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', exception_row.exception_date,
          'capacity_percent', exception_row.capacity_percent,
          'reason', exception_row.reason
        ) order by exception_row.exception_date
      )
      from public.schedule_resource_capacity_exceptions exception_row
      where exception_row.profile_id = v_profile.id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.replace_schedule_resource_capacity_profile(
  integer,
  uuid,
  jsonb,
  jsonb,
  integer
) from public, anon, authenticated, service_role;

grant execute on function public.replace_schedule_resource_capacity_profile(
  integer,
  uuid,
  jsonb,
  jsonb,
  integer
) to authenticated;

create function public.get_schedule_resource_read_model(
  p_project_id integer,
  p_start date,
  p_finish date,
  p_resource_id uuid,
  p_horizon_days integer,
  p_include_leveling boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start date := p_start;
  v_finish date := p_finish;
  v_latest_finish date;
  v_result jsonb;
begin
  if auth.uid() is null
     or not (
       public.current_is_app_admin()
       or public.current_is_project_member(p_project_id::bigint)
     ) then
    raise exception 'You do not have permission to read resource capacity for this project.'
      using errcode = '42501';
  end if;

  perform 1
  from public.projects project
  where project.id = p_project_id;
  if not found then
    raise exception 'Project not found.' using errcode = 'P0002';
  end if;

  if p_resource_id is not null and not exists (
    select 1
    from public.schedule_resources resource
    where resource.id = p_resource_id
      and resource.project_id = p_project_id
  ) then
    raise exception 'Schedule resource not found in this project.' using errcode = 'P0002';
  end if;

  if p_include_leveling then
    if p_horizon_days is null or p_horizon_days not between 1 and 730 then
      raise exception 'Resource-leveling horizon must be a whole number from 1 through 730 calendar days.'
        using errcode = '22023';
    end if;

    select min(boundary_date)
    into v_start
    from (
      select coalesce(task.forecast_start_date, task.start_date) as boundary_date
      from public.schedule_tasks task
      where task.project_id = p_project_id
      union all
      select coalesce(task.forecast_finish_date, task.finish_date) as boundary_date
      from public.schedule_tasks task
      where task.project_id = p_project_id
    ) boundaries
    where boundary_date is not null;

    v_start := coalesce(v_start, current_date);

    select max(coalesce(task.forecast_finish_date, task.finish_date))
    into v_latest_finish
    from public.schedule_tasks task
    where task.project_id = p_project_id;

    if v_latest_finish is null then
      select max(coalesce(task.forecast_start_date, task.start_date))
      into v_latest_finish
      from public.schedule_tasks task
      where task.project_id = p_project_id;
    end if;

    v_finish := coalesce(v_latest_finish, v_start) + p_horizon_days;
  else
    if (p_start is null) <> (p_finish is null) then
      raise exception 'Capacity range start and finish must both be provided or both be null.'
        using errcode = '22023';
    end if;

    if p_resource_id is null and p_start is null then
      raise exception 'A project capacity range requires start and finish dates.'
        using errcode = '22023';
    end if;

    if p_start is not null and p_finish < p_start then
      raise exception 'Project-capacity finish must not be before its start.'
        using errcode = '22023';
    end if;
  end if;

  select jsonb_build_object(
    'project_id', p_project_id,
    'range', jsonb_build_object(
      'start', v_start,
      'finish', v_finish
    ),
    'resources', coalesce((
      select jsonb_agg(resource_fact.fact order by resource_fact.display_name, resource_fact.resource_id)
      from (
        select
          resource.id as resource_id,
          coalesce(
            nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''),
            person.email,
            'Unnamed resource'
          ) as display_name,
          jsonb_build_object(
            'id', resource.id,
            'project_id', resource.project_id,
            'person_id', resource.person_id,
            'display_name', coalesce(
              nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''),
              person.email,
              'Unnamed resource'
            ),
            'email', person.email,
            'job_title', person.job_title,
            'person_status', case when person.status = 'active' then 'active' else 'inactive' end,
            'membership_status', case when membership.status = 'active' then 'active' else 'inactive' end,
            'eligible', person.status = 'active' and membership.status = 'active'
          ) as fact
        from public.schedule_resources resource
        join public.people person on person.id = resource.person_id
        join public.project_directory_memberships membership
          on membership.project_id = resource.project_id
         and membership.person_id = resource.person_id
        where resource.project_id = p_project_id
          and (p_resource_id is null or resource.id = p_resource_id)
      ) resource_fact
    ), '[]'::jsonb),
    'capacity_profiles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'profile_id', profile.id,
          'project_id', profile.project_id,
          'resource_id', profile.resource_id,
          'configured', true,
          'version', profile.version,
          'coverage_start_date', v_start,
          'coverage_finish_date', v_finish,
          'weekday_overrides', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'weekday', override_row.weekday,
                'capacity_percent', override_row.capacity_percent
              ) order by override_row.weekday
            )
            from public.schedule_resource_weekday_capacity_overrides override_row
            where override_row.profile_id = profile.id
              and override_row.project_id = profile.project_id
              and override_row.resource_id = profile.resource_id
          ), '[]'::jsonb),
          'exceptions', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'date', exception_row.exception_date,
                'capacity_percent', exception_row.capacity_percent,
                'reason', exception_row.reason
              ) order by exception_row.exception_date
            )
            from public.schedule_resource_capacity_exceptions exception_row
            where exception_row.profile_id = profile.id
              and exception_row.project_id = profile.project_id
              and exception_row.resource_id = profile.resource_id
              and (v_start is null or exception_row.exception_date >= v_start)
              and (v_finish is null or exception_row.exception_date <= v_finish)
          ), '[]'::jsonb)
        ) order by profile.resource_id
      )
      from public.schedule_resource_capacity_profiles profile
      where profile.project_id = p_project_id
        and (p_resource_id is null or profile.resource_id = p_resource_id)
    ), '[]'::jsonb),
    'tasks', case when p_include_leveling then coalesce((
      select jsonb_agg(to_jsonb(task) order by task.sort_order, task.id)
      from public.schedule_tasks task
      where task.project_id = p_project_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'dependencies', case when p_include_leveling then coalesce((
      select jsonb_agg(to_jsonb(dependency) order by dependency.id)
      from public.schedule_dependencies dependency
      join public.schedule_tasks task on task.id = dependency.task_id
      where task.project_id = p_project_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'assignments', case when p_include_leveling then coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', assignment.id,
          'project_id', assignment.project_id,
          'task_id', assignment.task_id,
          'resource_id', assignment.resource_id,
          'person_id', resource.person_id,
          'allocation_percent', assignment.allocation_percent
        ) order by assignment.task_id, assignment.resource_id
      )
      from public.schedule_task_assignments assignment
      join public.schedule_resources resource
        on resource.id = assignment.resource_id
       and resource.project_id = assignment.project_id
      where assignment.project_id = p_project_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'calendar', jsonb_build_object(
      'working_weekdays', coalesce((
        select calendar.working_weekdays
        from public.project_schedule_calendars calendar
        where calendar.project_id = p_project_id
      ), array[1, 2, 3, 4, 5]::smallint[]),
      'non_working_dates', case when p_include_leveling then coalesce((
        select jsonb_agg(calendar_exception.exception_date order by calendar_exception.exception_date)
        from public.project_schedule_calendar_exceptions calendar_exception
        where calendar_exception.project_id = p_project_id
          and not calendar_exception.is_working
          and calendar_exception.exception_date >= v_start
          and calendar_exception.exception_date <= v_finish
      ), '[]'::jsonb) else '[]'::jsonb end,
      'working_date_overrides', case when p_include_leveling then coalesce((
        select jsonb_agg(calendar_exception.exception_date order by calendar_exception.exception_date)
        from public.project_schedule_calendar_exceptions calendar_exception
        where calendar_exception.project_id = p_project_id
          and calendar_exception.is_working
          and calendar_exception.exception_date >= v_start
          and calendar_exception.exception_date <= v_finish
      ), '[]'::jsonb) else '[]'::jsonb end
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_schedule_resource_read_model(
  integer,
  date,
  date,
  uuid,
  integer,
  boolean
) from public, anon, authenticated, service_role;

grant execute on function public.get_schedule_resource_read_model(
  integer,
  date,
  date,
  uuid,
  integer,
  boolean
) to authenticated;

commit;
