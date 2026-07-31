begin;

-- Preserve the original coherent single-statement implementation behind a
-- non-executable private helper. The public wrapper owns request-boundary
-- validation so direct authenticated RPC callers cannot bypass the same
-- 92-calendar-day limit enforced by the application service.
alter function public.get_schedule_resource_read_model(
  integer,
  date,
  date,
  uuid,
  integer,
  boolean
) set schema private;

alter function private.get_schedule_resource_read_model(
  integer,
  date,
  date,
  uuid,
  integer,
  boolean
) rename to get_schedule_resource_read_model_unbounded_20260722;

revoke all on function private.get_schedule_resource_read_model_unbounded_20260722(
  integer,
  date,
  date,
  uuid,
  integer,
  boolean
) from public, anon, authenticated, service_role;

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
begin
  if not coalesce(p_include_leveling, false)
     and p_resource_id is null
     and p_start is not null
     and p_finish is not null
     and (p_finish - p_start) > 91 then
    raise exception 'Project-capacity ranges are limited to 92 calendar days.'
      using errcode = '22023';
  end if;

  return private.get_schedule_resource_read_model_unbounded_20260722(
    p_project_id,
    p_start,
    p_finish,
    p_resource_id,
    p_horizon_days,
    p_include_leveling
  );
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

comment on function public.get_schedule_resource_read_model(
  integer,
  date,
  date,
  uuid,
  integer,
  boolean
) is 'Returns one coherent project-scoped scheduling resource read model; direct project-wide capacity ranges are limited to 92 calendar days.';

commit;
