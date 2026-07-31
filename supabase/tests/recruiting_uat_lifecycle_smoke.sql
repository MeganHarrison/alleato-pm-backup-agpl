-- Transactional smoke test for the recruiter-only candidate-intake UAT boundary.
-- Safe to run against a linked environment: all changes are rolled back.
begin;

do $$
declare
  v_actor uuid;
  v_requisition uuid;
  v_idempotency uuid := gen_random_uuid();
  v_file_id uuid := gen_random_uuid();
  v_email text;
  v_email_hash text;
  v_created jsonb;
  v_replayed jsonb;
  v_candidate uuid;
  v_mismatch_rejected boolean := false;
begin
  select person_id
  into v_actor
  from public.recruiting_user_roles
  where role in ('recruiting_admin', 'recruiter')
    and is_active = true
  order by case when role = 'recruiting_admin' then 0 else 1 end
  limit 1;

  select id
  into v_requisition
  from public.recruiting_requisitions
  where status = 'open'
    and is_confidential = false
  order by created_at
  limit 1;

  if v_actor is null then
    raise exception 'UAT smoke test requires one active recruiter.';
  end if;

  if v_requisition is null then
    insert into public.recruiting_requisitions (
      requisition_number,
      title,
      status,
      is_confidential,
      created_by_person_id,
      updated_by_person_id
    )
    values (
      'UAT-' || left(replace(v_idempotency::text, '-', ''), 20),
      'Synthetic UAT Position',
      'open',
      false,
      v_actor,
      v_actor
    )
    returning id into v_requisition;
  end if;

  v_email := 'codex+uat-' || replace(v_idempotency::text, '-', '') || '@alleatogroup.com';
  v_email_hash := md5(v_email) || md5(v_email);

  update public.recruiting_settings
  set value = 'true'::jsonb
  where key = 'public_intake_uat_enabled';

  delete from public.recruiting_uat_rate_limit_attempts
  where actor_person_id = v_actor;

  if not public.recruiting_consume_uat_rate_limit(v_actor) then
    raise exception 'Rate-limit smoke check unexpectedly rejected the first attempt.';
  end if;

  v_created := public.recruiting_create_uat_submission(
    v_idempotency,
    repeat('a', 64),
    v_actor,
    v_requisition,
    'Test',
    'Candidate Codex',
    v_email,
    v_email_hash,
    '',
    '',
    'uat/' || v_idempotency::text || '/' || v_file_id::text || '.pdf',
    'synthetic-test-resume.pdf',
    'application/pdf',
    617,
    '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062',
    'recruiting-uat-v1',
    now()
  );
  v_candidate := (v_created->>'candidateId')::uuid;

  v_replayed := public.recruiting_create_uat_submission(
    v_idempotency,
    repeat('a', 64),
    v_actor,
    v_requisition,
    'Test',
    'Candidate Codex',
    v_email,
    v_email_hash,
    '',
    '',
    'uat/' || v_idempotency::text || '/' || v_file_id::text || '.pdf',
    'synthetic-test-resume.pdf',
    'application/pdf',
    617,
    '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062',
    'recruiting-uat-v1',
    now()
  );

  if coalesce((v_replayed->>'replayed')::boolean, false) is not true
    or (v_replayed->>'candidateId')::uuid <> v_candidate then
    raise exception 'Idempotent replay did not return the original UAT record.';
  end if;

  begin
    perform public.recruiting_create_uat_submission(
      v_idempotency,
      repeat('b', 64),
      v_actor,
      v_requisition,
      'Test',
      'Candidate Codex',
      v_email,
      v_email_hash,
      '',
      '',
      'uat/' || v_idempotency::text || '/' || v_file_id::text || '.pdf',
      'synthetic-test-resume.pdf',
      'application/pdf',
      617,
      '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062',
      'recruiting-uat-v1',
      now()
    );
  exception when others then
    v_mismatch_rejected := true;
  end;

  if not v_mismatch_rejected then
    raise exception 'A mismatched idempotent replay was accepted.';
  end if;

  update public.recruiting_uat_submissions
  set
    consented_at = now() - interval '25 hours',
    expires_at = now() - interval '1 hour'
  where candidate_id = v_candidate;

  if not public.recruiting_delete_uat_submission(v_candidate, v_actor, 'expired') then
    raise exception 'Expired UAT record was not deleted.';
  end if;

  if not exists (
    select 1
    from public.recruiting_uat_deletion_audit
    where deleted_by_system = true
      and delete_reason = 'expired'
  ) then
    raise exception 'Automated deletion was not recorded as a system action.';
  end if;

  if exists (
    select 1
    from public.recruiting_uat_submissions
    where candidate_id = v_candidate
  ) then
    raise exception 'Deleted UAT metadata remains.';
  end if;
end;
$$;

rollback;
