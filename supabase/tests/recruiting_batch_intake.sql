begin;

do $$
declare
  v_actor uuid;
  v_auth_user uuid;
  v_requisition uuid;
  v_candidate uuid;
  v_application uuid;
  v_document uuid;
  v_key uuid := gen_random_uuid();
  v_batch uuid := gen_random_uuid();
  v_assignment_key uuid := gen_random_uuid();
  v_storage_path text := 'uat/' || v_key || '/' || gen_random_uuid() || '.pdf';
  v_result jsonb;
begin
  select person_id into v_actor
  from public.recruiting_user_roles
  where role in ('recruiting_admin', 'recruiter') and is_active = true
  limit 1;
  select id into v_requisition
  from public.recruiting_requisitions
  where status = 'open' and is_confidential = false
  limit 1;
  if v_actor is null or v_requisition is null then
    raise exception 'Recruiting batch intake smoke test needs an active recruiter and open requisition.';
  end if;
  select auth_user_id into v_auth_user
  from public.people
  where id = v_actor;
  perform set_config('request.jwt.claim.sub', v_auth_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.recruiting_settings(key, value)
  values ('public_intake_uat_enabled', 'true'::jsonb)
  on conflict (key) do update set value = excluded.value;

  v_result := public.recruiting_create_unassigned_uat_submission(
    v_key,
    repeat('a', 64),
    v_actor,
    v_batch,
    1,
    'recruiting+uat-batch-smoke@alleatogroup.com',
    repeat('b', 64),
    v_storage_path,
    'renamed-synthetic-resume.pdf',
    'application/pdf',
    100,
    '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062',
    'recruiting-uat-v1',
    now()
  );
  v_candidate := (v_result ->> 'candidateId')::uuid;
  v_document := (v_result ->> 'documentId')::uuid;
  if (v_result ->> 'applicationId') is not null then
    raise exception 'The batch resume must remain unassigned.';
  end if;
  v_result := public.recruiting_create_unassigned_uat_submission(
    v_key,
    repeat('a', 64),
    v_actor,
    v_batch,
    1,
    'recruiting+uat-batch-smoke@alleatogroup.com',
    repeat('b', 64),
    v_storage_path,
    'renamed-synthetic-resume.pdf',
    'application/pdf',
    100,
    '03bd80dc9f726f230d82b2c1f1052d16661711d191b32125f63d96ffa2db0062',
    'recruiting-uat-v1',
    now()
  );
  if coalesce((v_result ->> 'replayed')::boolean, false) is not true
    or (v_result ->> 'candidateId')::uuid <> v_candidate then
    raise exception 'Lost-response batch retry did not replay the original intake.';
  end if;

  v_result := public.recruiting_assign_uat_submission(
    v_candidate, v_requisition, v_actor, 1, v_assignment_key, repeat('c', 64)
  );
  v_application := (v_result ->> 'applicationId')::uuid;
  if v_application is null then
    raise exception 'Assignment did not create an application.';
  end if;
  if not exists (
    select 1 from public.recruiting_documents
    where id = v_document and application_id = v_application
  ) then
    raise exception 'The original resume was not linked to the application.';
  end if;
  v_result := public.recruiting_assign_uat_submission(
    v_candidate, v_requisition, v_actor, 1, v_assignment_key, repeat('c', 64)
  );
  if coalesce((v_result ->> 'replayed')::boolean, false) is not true then
    raise exception 'Assignment idempotency did not replay the original result.';
  end if;
  begin
    perform public.recruiting_assign_uat_submission(
      v_candidate, v_requisition, v_actor, 1, gen_random_uuid(), repeat('d', 64)
    );
    raise exception 'A second assignment command was accepted.';
  exception when raise_exception then
    if sqlerrm = 'A second assignment command was accepted.' then
      raise;
    end if;
  end;

  begin
    update public.recruiting_applications
    set current_stage = 'closed',
        status = 'rejected',
        disposition_code = 'not_qualified',
        disposition_reason = 'Direct audit bypass must fail.'
    where id = v_application;
    raise exception 'A direct Not Qualified update bypassed the audited RPC.';
  exception when insufficient_privilege then
    null;
  end;

  v_result := public.recruiting_set_uat_application_disposition(
    v_application,
    'not_qualified',
    'Job-related requirements were not met.',
    1,
    gen_random_uuid(),
    repeat('e', 64)
  );
  if v_result ->> 'dispositionCode' <> 'not_qualified'
    or not exists (
      select 1 from public.recruiting_dispositions
      where application_id = v_application
        and disposition_code = 'not_qualified'
        and actor_person_id = v_actor
    ) then
    raise exception 'The audited Not Qualified command did not record its disposition.';
  end if;

  begin
    insert into public.recruiting_dispositions(
      application_id, disposition_code, reason, actor_person_id
    ) values (v_application, 'hired', 'Not allowed in UAT.', v_actor);
    raise exception 'The UAT disposition guard did not reject a forbidden outcome.';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
