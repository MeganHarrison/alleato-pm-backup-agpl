-- Database-backed UAT lifecycle smoke test.
-- Runs inside a transaction and always rolls back.

begin;

do $$
declare
  v_actor uuid;
  v_requisition uuid;
  v_key uuid := gen_random_uuid();
  v_file_id uuid := gen_random_uuid();
  v_result jsonb;
  v_candidate uuid;
  v_application uuid;
  v_submission uuid;
  v_stage text;
begin
  select rur.person_id
  into v_actor
  from public.recruiting_user_roles rur
  where rur.role in ('recruiting_admin', 'recruiter')
    and rur.is_active = true
  order by case when rur.role = 'recruiting_admin' then 0 else 1 end
  limit 1;

  select rr.id
  into v_requisition
  from public.recruiting_requisitions rr
  where rr.status = 'open'
    and rr.is_confidential = false
  order by rr.created_at
  limit 1;

  if v_actor is null or v_requisition is null then
    raise exception 'UAT smoke prerequisites are unavailable.';
  end if;

  v_result := public.recruiting_create_uat_submission(
    p_idempotency_key => v_key,
    p_request_hash => repeat('a', 64),
    p_actor_person_id => v_actor,
    p_requisition_id => v_requisition,
    p_first_name => 'Test',
    p_last_name => 'CandidateSmoke',
    p_email => 'codex+uat-' || replace(v_key::text, '-', '') || '@alleatogroup.com',
    p_email_hash => encode(
      digest(
        'codex+uat-' || replace(v_key::text, '-', '') || '@alleatogroup.com',
        'sha256'
      ),
      'hex'
    ),
    p_phone => '',
    p_phone_hash => '',
    p_storage_path => 'uat/' || v_key::text || '/' || v_file_id::text || '.pdf',
    p_original_file_name => 'synthetic-test-resume.pdf',
    p_content_type => 'application/pdf',
    p_byte_size => 1,
    p_sha256 => '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062',
    p_consent_version => 'recruiting-uat-v1',
    p_consented_at => now()
  );

  v_candidate := (v_result ->> 'candidateId')::uuid;
  v_application := (v_result ->> 'applicationId')::uuid;

  select id into v_submission
  from public.recruiting_uat_submissions
  where application_id = v_application;

  foreach v_stage in array array['review', 'qualified', 'interview']
  loop
    insert into public.recruiting_stage_events (
      application_id,
      from_stage,
      to_stage,
      reason,
      actor_person_id
    )
    select
      v_application,
      current_stage,
      v_stage,
      'Database lifecycle smoke.',
      v_actor
    from public.recruiting_applications
    where id = v_application;

    update public.recruiting_applications
    set current_stage = v_stage,
        last_activity_at = now(),
        row_version = row_version + 1
    where id = v_application;

    insert into public.recruiting_activity_events (
      candidate_id,
      application_id,
      requisition_id,
      event_type,
      summary,
      actor_person_id
    )
    values (
      v_candidate,
      v_application,
      v_requisition,
      'application.stage_changed',
      'Database lifecycle smoke stage transition.',
      v_actor
    );
  end loop;

  begin
    update public.recruiting_applications
    set current_stage = 'offer'
    where id = v_application;
    raise exception 'UAT offer-stage guard did not run.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.recruiting_dispositions (
      application_id,
      disposition_code,
      actor_person_id
    )
    values (v_application, 'hold', v_actor);
    raise exception 'UAT disposition guard did not run.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.recruiting_ai_runs (
      candidate_id,
      application_id,
      requisition_id,
      action,
      prompt_version,
      input_hash,
      requested_by_person_id
    )
    values (
      v_candidate,
      v_application,
      v_requisition,
      'summarize_evidence',
      'uat-smoke-v1',
      repeat('b', 64),
      v_actor
    );
    raise exception 'UAT AI guard did not run.';
  exception
    when insufficient_privilege then null;
  end;

  if not public.recruiting_delete_uat_submission(
    v_candidate,
    v_actor,
    'database-smoke'
  ) then
    raise exception 'UAT cleanup returned false.';
  end if;

  if exists (
    select 1
    from public.recruiting_candidates
    where id = v_candidate
  ) or exists (
    select 1
    from public.recruiting_applications
    where id = v_application
  ) or exists (
    select 1
    from public.recruiting_uat_submissions
    where id = v_submission
  ) or exists (
    select 1
    from public.recruiting_stage_events
    where application_id = v_application
  ) or exists (
    select 1
    from public.recruiting_activity_events
    where application_id = v_application
       or candidate_id = v_candidate
  ) then
    raise exception 'UAT cleanup left lifecycle records behind.';
  end if;

  if not exists (
    select 1
    from public.recruiting_uat_deletion_audit
    where submission_id = v_submission
      and delete_reason = 'database-smoke'
  ) then
    raise exception 'UAT deletion audit was not retained.';
  end if;

  v_key := gen_random_uuid();
  v_file_id := gen_random_uuid();
  v_result := public.recruiting_create_uat_submission(
    p_idempotency_key => v_key,
    p_request_hash => repeat('c', 64),
    p_actor_person_id => v_actor,
    p_requisition_id => v_requisition,
    p_first_name => 'Test',
    p_last_name => 'CandidateExpiry',
    p_email => 'codex+uat-' || replace(v_key::text, '-', '') || '@alleatogroup.com',
    p_email_hash => encode(
      digest(
        'codex+uat-' || replace(v_key::text, '-', '') || '@alleatogroup.com',
        'sha256'
      ),
      'hex'
    ),
    p_phone => '',
    p_phone_hash => '',
    p_storage_path => 'uat/' || v_key::text || '/' || v_file_id::text || '.pdf',
    p_original_file_name => 'synthetic-test-resume.pdf',
    p_content_type => 'application/pdf',
    p_byte_size => 1,
    p_sha256 => '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062',
    p_consent_version => 'recruiting-uat-v1',
    p_consented_at => now()
  );

  v_candidate := (v_result ->> 'candidateId')::uuid;
  v_application := (v_result ->> 'applicationId')::uuid;

  select id into v_submission
  from public.recruiting_uat_submissions
  where application_id = v_application;

  insert into public.recruiting_stage_events (
    application_id,
    from_stage,
    to_stage,
    reason,
    actor_person_id
  )
  values (
    v_application,
    'new',
    'review',
    'Expiry lifecycle smoke.',
    v_actor
  );

  update public.recruiting_applications
  set current_stage = 'review',
      row_version = row_version + 1
  where id = v_application;

  insert into public.recruiting_activity_events (
    candidate_id,
    application_id,
    requisition_id,
    event_type,
    summary,
    actor_person_id
  )
  values (
    v_candidate,
    v_application,
    v_requisition,
    'application.stage_changed',
    'Expiry lifecycle smoke stage transition.',
    v_actor
  );

  update public.recruiting_uat_submissions
  set consented_at = now() - interval '25 hours',
      expires_at = now() - interval '1 hour'
  where id = v_submission;

  if not public.recruiting_delete_uat_submission(
    v_candidate,
    v_actor,
    'expired'
  ) then
    raise exception 'Expired UAT cleanup returned false.';
  end if;

  if exists (
    select 1
    from public.recruiting_candidates
    where id = v_candidate
  ) or exists (
    select 1
    from public.recruiting_applications
    where id = v_application
  ) or exists (
    select 1
    from public.recruiting_uat_submissions
    where id = v_submission
  ) then
    raise exception 'Expired UAT cleanup left records behind.';
  end if;

  if not exists (
    select 1
    from public.recruiting_uat_deletion_audit
    where submission_id = v_submission
      and delete_reason = 'expired'
      and deleted_by_system = true
  ) then
    raise exception 'Expired UAT deletion audit was not retained.';
  end if;
end;
$$;

rollback;
