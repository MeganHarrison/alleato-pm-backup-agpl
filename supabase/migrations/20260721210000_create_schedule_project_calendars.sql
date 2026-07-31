-- Project working calendars for calendar-aware schedule previews.

create table if not exists public.schedule_project_calendars (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references public.projects(id) on delete cascade,
  name text not null default 'Standard',
  working_weekdays smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_project_calendars_project_id_key unique (project_id),
  constraint schedule_project_calendars_name_check check (length(btrim(name)) between 1 and 100),
  constraint schedule_project_calendars_weekdays_check check (
    cardinality(working_weekdays) between 1 and 7
    and working_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  )
);

create table if not exists public.schedule_calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.schedule_project_calendars(id) on delete cascade,
  exception_date date not null,
  is_working_day boolean not null default false,
  name text,
  created_at timestamptz not null default now(),
  constraint schedule_calendar_exceptions_calendar_date_key unique (calendar_id, exception_date),
  constraint schedule_calendar_exceptions_name_check check (name is null or length(btrim(name)) between 1 and 160)
);

create index if not exists idx_schedule_calendar_exceptions_calendar
  on public.schedule_calendar_exceptions (calendar_id);

drop trigger if exists set_schedule_project_calendars_updated_at on public.schedule_project_calendars;
create trigger set_schedule_project_calendars_updated_at
  before update on public.schedule_project_calendars
  for each row execute function public.set_updated_at();

alter table public.schedule_project_calendars enable row level security;
alter table public.schedule_calendar_exceptions enable row level security;

drop policy if exists "Project members can view schedule calendars" on public.schedule_project_calendars;
create policy "Project members can view schedule calendars"
  on public.schedule_project_calendars for select to authenticated
  using (public.current_is_app_admin() or public.current_has_project_access(project_id));

drop policy if exists "Project members can create schedule calendars" on public.schedule_project_calendars;
create policy "Project members can create schedule calendars"
  on public.schedule_project_calendars for insert to authenticated
  with check (public.current_is_app_admin() or public.current_has_project_access(project_id));

drop policy if exists "Project members can update schedule calendars" on public.schedule_project_calendars;
create policy "Project members can update schedule calendars"
  on public.schedule_project_calendars for update to authenticated
  using (public.current_is_app_admin() or public.current_has_project_access(project_id))
  with check (public.current_is_app_admin() or public.current_has_project_access(project_id));

drop policy if exists "Project members can delete schedule calendars" on public.schedule_project_calendars;
create policy "Project members can delete schedule calendars"
  on public.schedule_project_calendars for delete to authenticated
  using (public.current_is_app_admin() or public.current_has_project_access(project_id));

drop policy if exists "Project members can view schedule calendar exceptions" on public.schedule_calendar_exceptions;
create policy "Project members can view schedule calendar exceptions"
  on public.schedule_calendar_exceptions for select to authenticated
  using (
    exists (
      select 1
      from public.schedule_project_calendars calendar
      where calendar.id = calendar_id
        and (public.current_is_app_admin() or public.current_has_project_access(calendar.project_id))
    )
  );

drop policy if exists "Project members can create schedule calendar exceptions" on public.schedule_calendar_exceptions;
create policy "Project members can create schedule calendar exceptions"
  on public.schedule_calendar_exceptions for insert to authenticated
  with check (
    exists (
      select 1
      from public.schedule_project_calendars calendar
      where calendar.id = calendar_id
        and (public.current_is_app_admin() or public.current_has_project_access(calendar.project_id))
    )
  );

drop policy if exists "Project members can update schedule calendar exceptions" on public.schedule_calendar_exceptions;
create policy "Project members can update schedule calendar exceptions"
  on public.schedule_calendar_exceptions for update to authenticated
  using (
    exists (
      select 1
      from public.schedule_project_calendars calendar
      where calendar.id = calendar_id
        and (public.current_is_app_admin() or public.current_has_project_access(calendar.project_id))
    )
  )
  with check (
    exists (
      select 1
      from public.schedule_project_calendars calendar
      where calendar.id = calendar_id
        and (public.current_is_app_admin() or public.current_has_project_access(calendar.project_id))
    )
  );

drop policy if exists "Project members can delete schedule calendar exceptions" on public.schedule_calendar_exceptions;
create policy "Project members can delete schedule calendar exceptions"
  on public.schedule_calendar_exceptions for delete to authenticated
  using (
    exists (
      select 1
      from public.schedule_project_calendars calendar
      where calendar.id = calendar_id
        and (public.current_is_app_admin() or public.current_has_project_access(calendar.project_id))
    )
  );

create or replace function public.save_schedule_project_calendar(
  p_project_id bigint,
  p_name text,
  p_working_weekdays smallint[],
  p_exceptions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_calendar_id uuid;
  v_exception jsonb;
begin
  if not (public.current_is_app_admin() or public.current_has_project_access(p_project_id)) then
    raise exception using errcode = '42501', message = 'You do not have access to this project calendar.';
  end if;

  if p_name is null or length(btrim(p_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Calendar name must be between 1 and 100 characters.';
  end if;

  if cardinality(p_working_weekdays) not between 1 and 7
    or not (p_working_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
    or cardinality(p_working_weekdays) <> (
      select count(distinct weekday)::integer
      from unnest(p_working_weekdays) as weekday
    )
  then
    raise exception using errcode = '22023', message = 'Select at least one valid working weekday.';
  end if;

  if jsonb_typeof(coalesce(p_exceptions, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Calendar exceptions must be an array.';
  end if;

  if jsonb_array_length(coalesce(p_exceptions, '[]'::jsonb)) > 366 then
    raise exception using errcode = '22023', message = 'A project calendar can contain up to 366 date exceptions.';
  end if;

  insert into public.schedule_project_calendars (project_id, name, working_weekdays)
  values (p_project_id, btrim(p_name), p_working_weekdays)
  on conflict (project_id) do update
    set name = excluded.name,
        working_weekdays = excluded.working_weekdays
  returning id into v_calendar_id;

  delete from public.schedule_calendar_exceptions where calendar_id = v_calendar_id;

  for v_exception in select value from jsonb_array_elements(coalesce(p_exceptions, '[]'::jsonb))
  loop
    insert into public.schedule_calendar_exceptions (
      calendar_id,
      exception_date,
      is_working_day,
      name
    ) values (
      v_calendar_id,
      (v_exception ->> 'exception_date')::date,
      coalesce((v_exception ->> 'is_working_day')::boolean, false),
      nullif(btrim(v_exception ->> 'name'), '')
    );
  end loop;

  return v_calendar_id;
end;
$$;

revoke all on function public.save_schedule_project_calendar(bigint, text, smallint[], jsonb) from public, anon;
grant execute on function public.save_schedule_project_calendar(bigint, text, smallint[], jsonb) to authenticated, service_role;

grant select on public.schedule_project_calendars to authenticated;
grant select on public.schedule_calendar_exceptions to authenticated;
revoke insert, update, delete, truncate on public.schedule_project_calendars from anon, authenticated;
revoke insert, update, delete, truncate on public.schedule_calendar_exceptions from anon, authenticated;
grant all on public.schedule_project_calendars to service_role;
grant all on public.schedule_calendar_exceptions to service_role;

comment on table public.schedule_project_calendars is
  'One project-level working calendar used by calendar-aware schedule calculations.';
comment on table public.schedule_calendar_exceptions is
  'Named dates that override the project calendar working week.';
comment on function public.save_schedule_project_calendar(bigint, text, smallint[], jsonb) is
  'Atomically replaces a project working calendar and its date exceptions.';
