-- Keep dependency authorization and scheduling invariants at the database
-- boundary so direct Supabase writes cannot bypass the API checks.

begin;

alter table public.schedule_dependencies
  alter column lag_days set default 0,
  alter column lag_days set not null;

alter table public.schedule_dependencies
  drop constraint if exists schedule_dependencies_lag_days_check;

alter table public.schedule_dependencies
  add constraint schedule_dependencies_lag_days_check
  check (lag_days between -365 and 365);

create or replace function public.schedule_dependency_is_in_authorized_project(
  p_task_id uuid,
  p_predecessor_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.schedule_tasks task
    join public.schedule_tasks predecessor
      on predecessor.id = p_predecessor_task_id
     and predecessor.project_id = task.project_id
    where task.id = p_task_id
      and (
        public.current_is_app_admin()
        or public.current_is_project_member(task.project_id::bigint)
      )
  );
$$;

revoke all on function public.schedule_dependency_is_in_authorized_project(uuid, uuid)
  from public, anon;
grant execute on function public.schedule_dependency_is_in_authorized_project(uuid, uuid)
  to authenticated, service_role;

create or replace function public.enforce_schedule_dependency_acyclic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creates_cycle boolean;
begin
  with recursive downstream(task_id) as (
    select new.task_id
    union
    select dependency.task_id
    from public.schedule_dependencies dependency
    join downstream
      on dependency.predecessor_task_id = downstream.task_id
    where dependency.id is distinct from new.id
  )
  select exists (
    select 1
    from downstream
    where task_id = new.predecessor_task_id
  )
  into creates_cycle;

  if creates_cycle then
    raise exception 'Schedule dependencies cannot create a circular dependency chain.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_schedule_dependency_acyclic()
  from public, anon, authenticated;

drop trigger if exists schedule_dependencies_enforce_acyclic
  on public.schedule_dependencies;
create trigger schedule_dependencies_enforce_acyclic
  before insert or update of task_id, predecessor_task_id
  on public.schedule_dependencies
  for each row execute function public.enforce_schedule_dependency_acyclic();

alter table public.schedule_dependencies enable row level security;

revoke all on table public.schedule_dependencies from anon, authenticated;
grant select, insert, update, delete on table public.schedule_dependencies to authenticated;
grant all on table public.schedule_dependencies to service_role;

drop policy if exists schedule_dependencies_authenticated_select
  on public.schedule_dependencies;
drop policy if exists schedule_dependencies_authenticated_insert
  on public.schedule_dependencies;
drop policy if exists schedule_dependencies_authenticated_update
  on public.schedule_dependencies;
drop policy if exists schedule_dependencies_authenticated_delete
  on public.schedule_dependencies;

create policy schedule_dependencies_authenticated_select
  on public.schedule_dependencies for select to authenticated
  using (
    public.schedule_dependency_is_in_authorized_project(task_id, predecessor_task_id)
  );

create policy schedule_dependencies_authenticated_insert
  on public.schedule_dependencies for insert to authenticated
  with check (
    public.schedule_dependency_is_in_authorized_project(task_id, predecessor_task_id)
  );

create policy schedule_dependencies_authenticated_update
  on public.schedule_dependencies for update to authenticated
  using (
    public.schedule_dependency_is_in_authorized_project(task_id, predecessor_task_id)
  )
  with check (
    public.schedule_dependency_is_in_authorized_project(task_id, predecessor_task_id)
  );

create policy schedule_dependencies_authenticated_delete
  on public.schedule_dependencies for delete to authenticated
  using (
    public.schedule_dependency_is_in_authorized_project(task_id, predecessor_task_id)
  );

alter table public.project_schedule_calendar_exceptions
  drop constraint if exists project_schedule_calendar_exceptions_reason_check;

alter table public.project_schedule_calendar_exceptions
  add constraint project_schedule_calendar_exceptions_reason_check
  check (reason is null or char_length(reason) <= 240);

create or replace function public.replace_project_schedule_calendar(
  p_project_id integer,
  p_working_weekdays smallint[],
  p_exceptions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  exception_count integer;
begin
  if auth.role() <> 'service_role' and (
    auth.role() <> 'authenticated'
    or auth.uid() is null
    or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint))
  ) then
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
        or (
          exception ? 'reason'
          and (
            jsonb_typeof(exception->'reason') <> 'string'
            or char_length(exception->>'reason') > 240
          )
        )
    ) then
    raise exception 'Calendar exceptions must have a date, working status, and an optional reason of 240 characters or fewer.' using errcode = '22023';
  end if;

  select count(*) into exception_count from jsonb_array_elements(p_exceptions);
  if exception_count > 1000 then
    raise exception 'A schedule calendar can contain at most 1000 dated exceptions.' using errcode = '22023';
  end if;

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
    nullif(btrim(exception->>'reason'), '')
  from jsonb_array_elements(p_exceptions) exception;
end;
$$;

revoke all on function public.replace_project_schedule_calendar(integer, smallint[], jsonb)
  from public, anon;
grant execute on function public.replace_project_schedule_calendar(integer, smallint[], jsonb)
  to authenticated, service_role;

commit;
