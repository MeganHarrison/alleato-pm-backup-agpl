begin;

create or replace function public.current_can_manage_recruiting_requisition(
  p_requisition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.recruiting_requisitions rr
    where rr.id = p_requisition_id
      and rr.status not in ('filled', 'closed', 'canceled')
      and (
        public.current_recruiting_is_admin()
        or rr.recruiter_person_id = public.current_person_id()
        or (
          public.current_recruiting_role() = 'recruiter'
          and not rr.is_confidential
        )
        or exists (
          select 1
          from public.recruiting_requisition_memberships rrm
          where rrm.requisition_id = rr.id
            and rrm.person_id = public.current_person_id()
            and rrm.membership_role = 'recruiter'
        )
      )
  );
$$;

create or replace function public.recruiting_guard_terminal_requisition_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requisition_id uuid := nullif(to_jsonb(new) ->> 'requisition_id', '')::uuid;
  v_status text;
begin
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

drop trigger if exists recruiting_applications_active_requisition
on public.recruiting_applications;
create trigger recruiting_applications_active_requisition
before insert or update on public.recruiting_applications
for each row execute function public.recruiting_guard_terminal_requisition_activity();

drop trigger if exists recruiting_tasks_active_requisition
on public.recruiting_tasks;
create trigger recruiting_tasks_active_requisition
before insert or update on public.recruiting_tasks
for each row execute function public.recruiting_guard_terminal_requisition_activity();

revoke all on function public.recruiting_guard_terminal_requisition_activity()
from public, anon, authenticated;
grant execute on function public.recruiting_guard_terminal_requisition_activity()
to service_role;

commit;
