-- Keep recruiter UAT records purgeable after allowed pipeline stage testing.
-- UAT commands are additionally restricted in the application layer to
-- review/interview transitions only.

begin;

create or replace function public.recruiting_guard_uat_application_stage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.current_stage is distinct from old.current_stage
    and exists (
      select 1
      from public.recruiting_uat_submissions
      where application_id = new.id
    )
    and new.current_stage not in ('new', 'review', 'qualified', 'interview') then
    raise exception 'Test applications can move through review and interview only.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists recruiting_guard_uat_application_stage_trigger
on public.recruiting_applications;
create trigger recruiting_guard_uat_application_stage_trigger
before update of current_stage on public.recruiting_applications
for each row execute function public.recruiting_guard_uat_application_stage();

create or replace function public.recruiting_guard_uat_external_record()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_application_id uuid := nullif(v_row ->> 'application_id', '')::uuid;
  v_candidate_id uuid := nullif(v_row ->> 'candidate_id', '')::uuid;
begin
  if exists (
    select 1
    from public.recruiting_uat_submissions
    where application_id = v_application_id
       or candidate_id = v_candidate_id
  ) then
    raise exception 'Test applications cannot create dispositions, offers, external delivery, automation, or AI records.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists recruiting_guard_uat_disposition_trigger
on public.recruiting_dispositions;
create trigger recruiting_guard_uat_disposition_trigger
before insert or update on public.recruiting_dispositions
for each row execute function public.recruiting_guard_uat_external_record();

drop trigger if exists recruiting_guard_uat_message_trigger
on public.recruiting_messages;
create trigger recruiting_guard_uat_message_trigger
before insert or update on public.recruiting_messages
for each row execute function public.recruiting_guard_uat_external_record();

drop trigger if exists recruiting_guard_uat_provider_attempt_trigger
on public.recruiting_provider_attempts;
create trigger recruiting_guard_uat_provider_attempt_trigger
before insert or update on public.recruiting_provider_attempts
for each row execute function public.recruiting_guard_uat_external_record();

drop trigger if exists recruiting_guard_uat_offer_trigger
on public.recruiting_offers;
create trigger recruiting_guard_uat_offer_trigger
before insert or update on public.recruiting_offers
for each row execute function public.recruiting_guard_uat_external_record();

drop trigger if exists recruiting_guard_uat_automation_trigger
on public.recruiting_automation_runs;
create trigger recruiting_guard_uat_automation_trigger
before insert or update on public.recruiting_automation_runs
for each row execute function public.recruiting_guard_uat_external_record();

drop trigger if exists recruiting_guard_uat_ai_trigger
on public.recruiting_ai_runs;
create trigger recruiting_guard_uat_ai_trigger
before insert or update on public.recruiting_ai_runs
for each row execute function public.recruiting_guard_uat_external_record();

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

  -- These immutable audit rows use restrictive foreign keys by design.
  -- Delete only rows owned by the exact UAT application before removing it.
  delete from public.recruiting_stage_events
  where application_id = v_submission.application_id;

  delete from public.recruiting_dispositions
  where application_id = v_submission.application_id;

  delete from public.recruiting_activity_events
  where application_id = v_submission.application_id
     or candidate_id = v_submission.candidate_id;

  delete from public.recruiting_applications
  where id = v_submission.application_id;

  delete from public.recruiting_candidates
  where id = v_submission.candidate_id;

  return true;
end;
$$;

revoke all on function public.recruiting_delete_uat_submission(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.recruiting_delete_uat_submission(uuid, uuid, text)
to service_role;

commit;
