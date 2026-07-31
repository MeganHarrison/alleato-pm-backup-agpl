-- Remove the empty duplicate calendar objects introduced by 20260721210000.
-- The canonical owner is project_schedule_calendars,
-- project_schedule_calendar_exceptions, and replace_project_schedule_calendar.

begin;

do $$
begin
  if to_regclass('public.schedule_project_calendars') is not null
    and exists (select 1 from public.schedule_project_calendars)
  then
    raise exception using
      errcode = '55000',
      message = 'Refusing schedule calendar reconciliation: schedule_project_calendars contains data.';
  end if;

  if to_regclass('public.schedule_calendar_exceptions') is not null
    and exists (select 1 from public.schedule_calendar_exceptions)
  then
    raise exception using
      errcode = '55000',
      message = 'Refusing schedule calendar reconciliation: schedule_calendar_exceptions contains data.';
  end if;
end;
$$;

drop function if exists public.save_schedule_project_calendar(bigint, text, smallint[], jsonb);
drop table if exists public.schedule_calendar_exceptions;
drop table if exists public.schedule_project_calendars;

commit;
