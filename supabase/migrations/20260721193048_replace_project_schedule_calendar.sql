create or replace function public.replace_project_schedule_calendar(
  p_project_id integer,
  p_working_weekdays smallint[],
  p_exceptions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  exception_count integer;
begin
  if current_user <> 'service_role'
    and not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to configure this project schedule calendar.' using errcode = '42501';
  end if;

  if cardinality(p_working_weekdays) is null or cardinality(p_working_weekdays) = 0
    or exists (select 1 from unnest(p_working_weekdays) weekday where weekday < 0 or weekday > 6)
    or (select count(distinct weekday) from unnest(p_working_weekdays) weekday) <> cardinality(p_working_weekdays) then
    raise exception 'Working weekdays must be unique values from Sunday (0) through Saturday (6).' using errcode = '22023';
  end if;

  if jsonb_typeof(p_exceptions) <> 'array'
    or exists (
      select 1 from jsonb_array_elements(p_exceptions) exception
      where jsonb_typeof(exception) <> 'object'
        or not (exception ? 'exception_date')
        or not (exception ? 'is_working')
        or jsonb_typeof(exception->'exception_date') <> 'string'
        or jsonb_typeof(exception->'is_working') <> 'boolean'
    ) then
    raise exception 'Calendar exceptions must be date and working-status objects.' using errcode = '22023';
  end if;

  select count(*) into exception_count from jsonb_array_elements(p_exceptions);
  if exception_count <> (
    select count(distinct (exception->>'exception_date')) from jsonb_array_elements(p_exceptions) exception
  ) then
    raise exception 'Calendar exception dates must be unique.' using errcode = '22023';
  end if;

  insert into public.project_schedule_calendars (project_id, working_weekdays)
  values (p_project_id, p_working_weekdays)
  on conflict (project_id) do update
    set working_weekdays = excluded.working_weekdays,
        updated_at = now();

  delete from public.project_schedule_calendar_exceptions
  where project_id = p_project_id;

  insert into public.project_schedule_calendar_exceptions (
    project_id, exception_date, is_working, reason
  )
  select
    p_project_id,
    (exception->>'exception_date')::date,
    (exception->>'is_working')::boolean,
    nullif(exception->>'reason', '')
  from jsonb_array_elements(p_exceptions) exception;
end;
$$;

revoke all on function public.replace_project_schedule_calendar(integer, smallint[], jsonb) from public, anon;
grant execute on function public.replace_project_schedule_calendar(integer, smallint[], jsonb) to authenticated, service_role;
