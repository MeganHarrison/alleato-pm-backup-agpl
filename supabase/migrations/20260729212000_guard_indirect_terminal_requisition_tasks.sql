begin;

create or replace function public.recruiting_guard_terminal_requisition_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requisition_id uuid := nullif(to_jsonb(new) ->> 'requisition_id', '')::uuid;
  v_application_id uuid := nullif(to_jsonb(new) ->> 'application_id', '')::uuid;
  v_status text;
begin
  if v_requisition_id is null and v_application_id is not null then
    select requisition_id
    into v_requisition_id
    from public.recruiting_applications
    where id = v_application_id;
  end if;

  if v_requisition_id is null then
    return new;
  end if;

  select status
  into v_status
  from public.recruiting_requisitions
  where id = v_requisition_id
  for key share;

  if not found then
    raise exception 'The requisition no longer exists. Reload and try again.'
      using errcode = '23503';
  end if;
  if v_status in ('filled', 'closed', 'canceled') then
    raise exception 'This position is no longer active. Its recruiting history is read-only.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.recruiting_guard_terminal_requisition_activity()
from public, anon, authenticated;
grant execute on function public.recruiting_guard_terminal_requisition_activity()
to service_role;

create or replace function public.recruiting_guard_lifecycle_reason_length()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.event_type = 'requisition.lifecycle_changed'
    and length(coalesce(new.detail ->> 'reason', '')) > 2000
  then
    raise exception 'A lifecycle reason cannot exceed 2000 characters.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists recruiting_activity_lifecycle_reason_length
on public.recruiting_activity_events;
create trigger recruiting_activity_lifecycle_reason_length
before insert or update on public.recruiting_activity_events
for each row execute function public.recruiting_guard_lifecycle_reason_length();

revoke all on function public.recruiting_guard_lifecycle_reason_length()
from public, anon, authenticated;
grant execute on function public.recruiting_guard_lifecycle_reason_length()
to service_role;

commit;
