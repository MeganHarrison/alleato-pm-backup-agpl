-- Trigger records expose only the columns of their own relation. Keep the
-- people and users_auth branches procedural so PostgreSQL never resolves the
-- other relation's column while reconciling delayed account links.

create or replace function public.sync_person_role_memberships_after_auth_link()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_member record;
  v_person_id uuid;
begin
  if tg_table_name = 'people' then
    v_person_id := new.id;
  elsif tg_table_name = 'users_auth' then
    v_person_id := new.person_id;
  else
    raise exception using
      errcode = '55000',
      message = 'PROJECT_ROLE_AUTH_LINK_SYNC_UNSUPPORTED_TABLE',
      detail = format('Project-role access reconciliation received trigger table %s.', tg_table_name);
  end if;

  for v_role_member in
    select project_role_id
    from public.project_role_members
    where person_id = v_person_id
  loop
    perform public.ensure_project_role_directory_membership(
      v_role_member.project_role_id,
      v_person_id
    );
  end loop;

  return new;
end;
$$;
