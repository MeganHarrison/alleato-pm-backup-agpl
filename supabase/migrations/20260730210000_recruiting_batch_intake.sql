-- Recruiter batch resume intake, unassigned resume routing, secure resume
-- references, and a constrained Not Qualified outcome for synthetic UAT.

begin;

alter table public.recruiting_uat_submissions
  alter column application_id drop not null;

alter table public.recruiting_uat_submissions
  add column if not exists batch_id uuid,
  add column if not exists batch_sequence integer,
  add column if not exists assigned_requisition_id uuid
    references public.recruiting_requisitions(id) on delete restrict,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by_person_id uuid
    references public.people(id) on delete restrict,
  add column if not exists assignment_idempotency_key uuid unique,
  add column if not exists assignment_request_hash text
    check (
      assignment_request_hash is null
      or length(assignment_request_hash) = 64
    ),
  add column if not exists row_version integer not null default 1
    check (row_version > 0);

create index if not exists recruiting_uat_submissions_unassigned_idx
on public.recruiting_uat_submissions(created_at desc)
where application_id is null;

create or replace function public.recruiting_consume_uat_rate_limit(
  p_actor_person_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.recruiting_user_roles rur
    where rur.person_id = p_actor_person_id
      and rur.role in ('recruiting_admin', 'recruiter')
      and rur.is_active = true
    union all
    select 1
    from public.people p
    join public.user_profiles up on up.id = p.auth_user_id
    where p.id = p_actor_person_id
      and up.is_admin = true
      and up.is_active = true
  ) then
    raise exception 'The recruiting operator is not active.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_actor_person_id::text, 20260730183000)
  );

  delete from public.recruiting_uat_rate_limit_attempts
  where attempted_at < now() - interval '1 day';

  if (
    select count(*)
    from public.recruiting_uat_rate_limit_attempts
    where actor_person_id = p_actor_person_id
      and attempted_at >= now() - interval '1 hour'
  ) >= 10 then
    return false;
  end if;

  insert into public.recruiting_uat_rate_limit_attempts(actor_person_id)
  values (p_actor_person_id);
  return true;
end;
$$;

create or replace function public.current_can_access_recruiting_candidate(
  p_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_recruiting_is_admin()
    or exists (
      select 1
      from public.recruiting_applications ra
      where ra.candidate_id = p_candidate_id
        and public.current_can_access_recruiting_requisition(ra.requisition_id)
    )
    or (
      public.current_recruiting_role() in ('recruiting_admin', 'recruiter')
      and exists (
        select 1 from public.recruiting_uat_submissions rus
        where rus.candidate_id = p_candidate_id
          and rus.application_id is null
      )
    );
$$;

create or replace function public.current_can_manage_recruiting_candidate(
  p_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_recruiting_is_admin()
    or exists (
      select 1
      from public.recruiting_applications ra
      where ra.candidate_id = p_candidate_id
        and public.current_can_manage_recruiting_requisition(ra.requisition_id)
    )
    or (
      public.current_recruiting_role() in ('recruiting_admin', 'recruiter')
      and exists (
        select 1 from public.recruiting_uat_submissions rus
        where rus.candidate_id = p_candidate_id
          and rus.application_id is null
      )
    );
$$;

create or replace function public.recruiting_create_unassigned_uat_submission(
  p_idempotency_key uuid,
  p_request_hash text,
  p_actor_person_id uuid,
  p_batch_id uuid,
  p_batch_sequence integer,
  p_email text,
  p_email_hash text,
  p_storage_path text,
  p_original_file_name text,
  p_content_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_consent_version text,
  p_consented_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.recruiting_uat_submissions%rowtype;
  v_existing_storage_path text;
  v_candidate_id uuid := gen_random_uuid();
  v_document_id uuid := gen_random_uuid();
  v_expires_at timestamptz := p_consented_at + interval '24 hours';
  v_display_name text := '[UAT] Resume ' || lpad(p_batch_sequence::text, 2, '0');
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_idempotency_key::text, 20260730210000)
  );

  if not exists (
    select 1 from public.recruiting_settings
    where key = 'public_intake_uat_enabled' and value = 'true'::jsonb
  ) then
    raise exception 'Candidate intake UAT is disabled.';
  end if;

  select * into v_existing
  from public.recruiting_uat_submissions
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.submitted_by_person_id <> p_actor_person_id
      or v_existing.request_hash <> p_request_hash then
      raise exception 'The idempotency key is already bound to another UAT request.';
    end if;
    select storage_path into v_existing_storage_path
    from public.recruiting_documents where id = v_existing.document_id;
    return jsonb_build_object(
      'candidateId', v_existing.candidate_id,
      'applicationId', v_existing.application_id,
      'documentId', v_existing.document_id,
      'expiresAt', v_existing.expires_at,
      'storagePath', v_existing_storage_path,
      'replayed', true
    );
  end if;

  if not exists (
    select 1
    from public.recruiting_user_roles rur
    where rur.person_id = p_actor_person_id
      and rur.role in ('recruiting_admin', 'recruiter')
      and rur.is_active = true
    union all
    select 1
    from public.people p
    join public.user_profiles up on up.id = p.auth_user_id
    where p.id = p_actor_person_id
      and up.is_admin = true
      and up.is_active = true
  ) then
    raise exception 'The recruiting operator is not active.';
  end if;

  if length(p_request_hash) <> 64
    or p_batch_sequence not between 1 and 10
    or lower(btrim(p_email)) !~ '^[^@+[:space:]]+\+uat[-_][a-z0-9_-]+@alleatogroup\.com$'
    or p_storage_path !~ ('^uat/' || p_idempotency_key::text || '/[0-9a-f-]+\.pdf$')
    or lower(p_original_file_name) !~ '\.pdf$'
    or p_content_type <> 'application/pdf'
    or p_byte_size < 1 or p_byte_size > 4194304
    or p_sha256 <> '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062'
    or length(p_email_hash) <> 64
    or p_consent_version <> 'recruiting-uat-v1' then
    raise exception 'The UAT submission does not match the approved synthetic fixture and identity rules.';
  end if;

  insert into public.recruiting_candidates (
    id, display_name, first_name, last_name, candidate_status,
    created_by_person_id, updated_by_person_id
  ) values (
    v_candidate_id, v_display_name, 'Test',
    'Resume ' || lpad(p_batch_sequence::text, 2, '0'),
    'active', p_actor_person_id, p_actor_person_id
  );

  insert into public.recruiting_candidate_contacts (
    candidate_id, contact_type, value_display, value_normalized, value_hash,
    is_primary, is_verified, consent_status
  ) values (
    v_candidate_id, 'email', lower(btrim(p_email)), lower(btrim(p_email)),
    p_email_hash, true, false, 'unknown'
  );

  insert into public.recruiting_documents (
    id, candidate_id, application_id, document_type, storage_bucket,
    storage_path, original_file_name, content_type, byte_size, sha256,
    scan_status, extraction_status, human_review_status, retention_status,
    uploaded_by_person_id
  ) values (
    v_document_id, v_candidate_id, null, 'resume',
    'recruiting-uat-quarantine', p_storage_path, p_original_file_name,
    p_content_type, p_byte_size, p_sha256, 'not_configured',
    'not_configured', 'pending', 'active', p_actor_person_id
  );

  insert into public.recruiting_activity_events (
    candidate_id, event_type, summary, detail, visibility, actor_person_id
  ) values (
    v_candidate_id, 'candidate_intake_uat_submitted',
    'Synthetic resume added to unassigned inbox',
    jsonb_build_object(
      'batchId', p_batch_id, 'batchSequence', p_batch_sequence,
      'consentVersion', p_consent_version, 'expiresAt', v_expires_at,
      'mode', 'uat', 'resumeStatus', 'quarantined'
    ),
    'system', p_actor_person_id
  );

  insert into public.recruiting_uat_submissions (
    idempotency_key, request_hash, candidate_id, application_id, document_id,
    submitted_by_person_id, consent_version, consented_at, expires_at,
    batch_id, batch_sequence
  ) values (
    p_idempotency_key, p_request_hash, v_candidate_id, null, v_document_id,
    p_actor_person_id, p_consent_version, p_consented_at, v_expires_at,
    p_batch_id, p_batch_sequence
  );

  return jsonb_build_object(
    'candidateId', v_candidate_id, 'applicationId', null,
    'documentId', v_document_id, 'expiresAt', v_expires_at,
    'storagePath', p_storage_path, 'replayed', false
  );
end;
$$;

create or replace function public.recruiting_assign_uat_submission(
  p_candidate_id uuid,
  p_requisition_id uuid,
  p_actor_person_id uuid,
  p_expected_row_version integer,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.recruiting_uat_submissions%rowtype;
  v_application_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_idempotency_key::text, 20260730210000)
  );

  if length(p_request_hash) <> 64 then
    raise exception 'A valid request hash is required.';
  end if;
  if not exists (
    select 1
    from public.recruiting_user_roles rur
    where rur.person_id = p_actor_person_id
      and rur.role in ('recruiting_admin', 'recruiter')
      and rur.is_active = true
    union all
    select 1
    from public.people p
    join public.user_profiles up on up.id = p.auth_user_id
    where p.id = p_actor_person_id
      and up.is_admin = true
      and up.is_active = true
  ) then
    raise exception 'Recruiting write access is required.';
  end if;

  select * into v_submission
  from public.recruiting_uat_submissions
  where candidate_id = p_candidate_id
  for update;

  if not found then raise exception 'The unassigned resume no longer exists.'; end if;
  if v_submission.application_id is not null then
    if v_submission.assigned_requisition_id <> p_requisition_id
      or v_submission.assignment_idempotency_key <> p_idempotency_key
      or v_submission.assignment_request_hash <> p_request_hash then
      raise exception 'The resume has already been assigned. Reload the inbox.';
    end if;
    return jsonb_build_object(
      'candidateId', v_submission.candidate_id,
      'applicationId', v_submission.application_id,
      'replayed', true
    );
  end if;
  if v_submission.row_version <> p_expected_row_version then
    raise exception 'The resume changed after it was loaded. Reload and try again.';
  end if;
  if not exists (
    select 1 from public.recruiting_requisitions
    where id = p_requisition_id and status = 'open' and is_confidential = false
  ) then
    raise exception 'Select an open, non-confidential position.';
  end if;

  insert into public.recruiting_applications (
    id, requisition_id, candidate_id, current_stage, status,
    created_by_person_id, updated_by_person_id
  ) values (
    v_application_id, p_requisition_id, p_candidate_id, 'new', 'active',
    p_actor_person_id, p_actor_person_id
  );

  insert into public.recruiting_application_sources (
    application_id, source_type, source_detail, is_primary
  ) values (
    v_application_id, 'manual', 'Assigned from resume inbox', true
  );

  update public.recruiting_documents
  set application_id = v_application_id
  where id = v_submission.document_id;

  update public.recruiting_uat_submissions
  set application_id = v_application_id,
      assigned_requisition_id = p_requisition_id,
      assigned_at = now(),
      assigned_by_person_id = p_actor_person_id,
      assignment_idempotency_key = p_idempotency_key,
      assignment_request_hash = p_request_hash,
      row_version = row_version + 1
  where id = v_submission.id;

  insert into public.recruiting_activity_events (
    candidate_id, application_id, requisition_id, event_type, summary,
    detail, visibility, actor_person_id
  ) values (
    p_candidate_id, v_application_id, p_requisition_id,
    'resume_assigned_to_position', 'Resume assigned to position',
    jsonb_build_object('mode', 'uat', 'idempotencyKey', p_idempotency_key),
    'standard', p_actor_person_id
  );

  return jsonb_build_object(
    'candidateId', p_candidate_id, 'applicationId', v_application_id,
    'replayed', false
  );
end;
$$;

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
      from public.recruiting_user_roles rur
      where rur.person_id = p_actor_person_id
        and rur.role in ('recruiting_admin', 'recruiter')
        and rur.is_active = true
      union all
      select 1
      from public.people p
      join public.user_profiles up on up.id = p.auth_user_id
      where p.id = p_actor_person_id
        and up.is_admin = true
        and up.is_active = true
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
      from public.recruiting_user_roles rur
      where rur.person_id = p_actor_person_id
        and rur.role = 'recruiting_admin'
        and rur.is_active = true
      union all
      select 1
      from public.people p
      join public.user_profiles up on up.id = p.auth_user_id
      where p.id = p_actor_person_id
        and up.is_admin = true
        and up.is_active = true
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

create or replace function public.recruiting_set_uat_application_disposition(
  p_application_id uuid,
  p_disposition_code text,
  p_reason text,
  p_expected_row_version integer,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_disposition_code <> 'not_qualified'
    or length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Test applications only allow a human-reviewed Not Qualified outcome with a reason.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.recruiting_uat_submissions
    where application_id = p_application_id
  ) then
    raise exception 'The test application was not found.'
      using errcode = 'P0002';
  end if;

  perform set_config('app.recruiting_uat_disposition_rpc', 'true', true);
  return public.recruiting_set_application_disposition(
    p_application_id,
    p_disposition_code,
    p_reason,
    p_expected_row_version,
    p_idempotency_key,
    p_request_hash
  );
end;
$$;

-- A synthetic record may be marked Not Qualified by a human with a reason.
-- Every provider, offer, automation, and AI guard remains unchanged.
create or replace function public.recruiting_guard_uat_application_stage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_is_uat boolean;
  v_disposition_rpc boolean :=
    coalesce(current_setting('app.recruiting_uat_disposition_rpc', true), '') = 'true';
begin
  select exists (
    select 1 from public.recruiting_uat_submissions
    where application_id = new.id
  ) into v_is_uat;

  if not v_is_uat then
    return new;
  end if;

  if (
    new.disposition_code is distinct from old.disposition_code
    or new.disposition_reason is distinct from old.disposition_reason
    or new.status is distinct from old.status
  ) and not v_disposition_rpc then
    raise exception 'Test application outcomes must use the audited disposition command.'
      using errcode = '42501';
  end if;

  if new.current_stage is distinct from old.current_stage
    and not (
      new.current_stage in ('new', 'review', 'qualified', 'interview')
      or (
        v_disposition_rpc
        and new.current_stage = 'closed'
        and new.status = 'rejected'
        and new.disposition_code = 'not_qualified'
        and length(btrim(coalesce(new.disposition_reason, ''))) >= 5
      )
    ) then
    raise exception 'Test applications can only move through review/interview or be marked Not Qualified by a human.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.recruiting_guard_uat_disposition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.recruiting_uat_submissions
    where application_id = new.application_id
  ) and not (
    new.disposition_code = 'not_qualified'
    and length(btrim(coalesce(new.reason, ''))) >= 5
  ) then
    raise exception 'Test applications only allow the human-reviewed Not Qualified outcome.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists recruiting_guard_uat_disposition_trigger
on public.recruiting_dispositions;
create trigger recruiting_guard_uat_disposition_trigger
before insert or update on public.recruiting_dispositions
for each row execute function public.recruiting_guard_uat_disposition();

revoke all on function public.recruiting_create_unassigned_uat_submission(
  uuid, text, uuid, uuid, integer, text, text, text, text, text, bigint,
  text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.recruiting_create_unassigned_uat_submission(
  uuid, text, uuid, uuid, integer, text, text, text, text, text, bigint,
  text, text, timestamptz
) to service_role;

revoke all on function public.recruiting_assign_uat_submission(
  uuid, uuid, uuid, integer, uuid, text
) from public, anon, authenticated;
grant execute on function public.recruiting_assign_uat_submission(
  uuid, uuid, uuid, integer, uuid, text
) to service_role;

revoke all on function public.recruiting_set_uat_application_disposition(
  uuid, text, text, integer, uuid, text
) from public, anon;
grant execute on function public.recruiting_set_uat_application_disposition(
  uuid, text, text, integer, uuid, text
) to authenticated, service_role;

commit;
