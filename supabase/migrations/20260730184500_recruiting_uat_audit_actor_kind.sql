begin;

alter table public.recruiting_uat_deletion_audit
add column if not exists deleted_by_system boolean not null default false;

create or replace function public.recruiting_delete_uat_submission(
  p_candidate_id uuid,
  p_actor_person_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.recruiting_uat_submissions%rowtype;
begin
  if (
    p_reason = 'expired'
    and not exists (
      select 1 from public.people where id = p_actor_person_id
    )
  ) or (
    p_reason <> 'expired'
    and not exists (
      select 1
      from public.recruiting_user_roles
      where person_id = p_actor_person_id
        and role in ('recruiting_admin', 'recruiter')
        and is_active = true
    )
  ) then
    raise exception 'The recruiting operator is not active.';
  end if;

  if length(btrim(p_reason)) not between 1 and 100 then
    raise exception 'A bounded deletion reason is required.';
  end if;

  select *
  into v_submission
  from public.recruiting_uat_submissions
  where candidate_id = p_candidate_id
  for update;

  if not found then
    return false;
  end if;

  if p_reason = 'expired' and v_submission.expires_at > now() then
    raise exception 'Only expired UAT records can use automated purge.';
  end if;

  if p_reason <> 'expired'
    and v_submission.submitted_by_person_id <> p_actor_person_id
    and not exists (
      select 1
      from public.recruiting_user_roles
      where person_id = p_actor_person_id
        and role = 'recruiting_admin'
        and is_active = true
    ) then
    raise exception 'Only the submitting recruiter or an administrator can delete this UAT record.';
  end if;

  insert into public.recruiting_uat_deletion_audit (
    submission_id,
    submitted_at,
    delete_reason,
    deleted_by_person_id,
    deleted_by_system
  )
  values (
    v_submission.id,
    v_submission.created_at,
    btrim(p_reason),
    p_actor_person_id,
    p_reason = 'expired'
  );

  delete from public.recruiting_activity_events
  where candidate_id = p_candidate_id
    and event_type = 'candidate_intake_uat_submitted';

  delete from public.recruiting_applications
  where candidate_id = p_candidate_id;

  delete from public.recruiting_candidates
  where id = p_candidate_id;

  return true;
end;
$$;

revoke all on function public.recruiting_delete_uat_submission(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.recruiting_delete_uat_submission(uuid, uuid, text)
to service_role;

commit;
