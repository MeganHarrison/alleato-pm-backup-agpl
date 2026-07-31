begin;

create or replace function public.recruiting_disconnect_microsoft_connection()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_recruiting_person_id();
  v_email text;
begin
  if v_actor is null
    or public.current_recruiting_role() not in ('recruiter', 'recruiting_admin') then
    raise exception 'Recruiting write access is required.' using errcode = '42501';
  end if;

  delete from public.recruiting_microsoft_connections
  where person_id = v_actor
  returning email into v_email;

  if v_email is null then
    return false;
  end if;

  insert into public.recruiting_microsoft_connection_events (
    person_id, event_type, email
  )
  values (v_actor, 'disconnected', v_email);
  return true;
end;
$$;

revoke all on function public.recruiting_disconnect_microsoft_connection()
from public, anon;
grant execute on function public.recruiting_disconnect_microsoft_connection()
to authenticated;

commit;
