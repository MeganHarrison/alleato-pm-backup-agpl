begin;

do $$
declare
  v_auth_user_id uuid;
  v_admin_person_id uuid;
  v_active_id uuid;
  v_linked_id uuid;
  v_unused_id uuid;
  v_candidate_id uuid;
  v_application_id uuid;
  v_result jsonb;
begin
  select ua.auth_user_id, rur.person_id
  into v_auth_user_id, v_admin_person_id
  from public.recruiting_user_roles rur
  join public.users_auth ua on ua.person_id = rur.person_id
  where rur.role = 'recruiting_admin'
    and rur.is_active
  order by rur.granted_at
  limit 1;

  if v_auth_user_id is null then
    raise exception 'Fixture requires an active recruiting administrator.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_auth_user_id::text,
      'role', 'authenticated'
    )::text,
    true
  );

  v_result := public.recruiting_create_requisition(
    'TEST-LIFECYCLE-ACTIVE',
    'Lifecycle behavior test',
    'Recruiting',
    'Indianapolis, IN',
    null,
    1,
    false,
    '10000000-0000-4000-8000-000000000001',
    repeat('a', 64)
  );
  v_active_id := (v_result ->> 'requisitionId')::uuid;

  insert into public.recruiting_candidates (
    display_name,
    created_by_person_id
  )
  values (
    'Lifecycle Test Candidate',
    v_admin_person_id
  )
  returning id into v_candidate_id;

  insert into public.recruiting_applications (
    requisition_id,
    candidate_id,
    created_by_person_id
  )
  values (
    v_active_id,
    v_candidate_id,
    v_admin_person_id
  )
  returning id into v_application_id;

  v_result := public.recruiting_create_requisition(
    'TEST-LIFECYCLE-ACTIVE',
    'Lifecycle behavior test',
    'Recruiting',
    'Indianapolis, IN',
    null,
    1,
    false,
    '10000000-0000-4000-8000-000000000001',
    repeat('a', 64)
  );
  if coalesce((v_result ->> 'replayed')::boolean, false) is not true then
    raise exception 'Create requisition did not replay its idempotent receipt.';
  end if;

  begin
    perform public.recruiting_set_requisition_lifecycle(
      v_active_id,
      'closed',
      2,
      'The requisition is no longer needed.',
      '10000000-0000-4000-8000-000000000002',
      repeat('b', 64)
    );
    raise exception 'Expected stale row-version protection.';
  exception
    when serialization_failure then null;
  end;

  perform public.recruiting_set_requisition_lifecycle(
    v_active_id,
    'closed',
    1,
    'The requisition is no longer needed.',
    '10000000-0000-4000-8000-000000000003',
    repeat('c', 64)
  );

  if public.current_can_manage_recruiting_requisition(v_active_id) then
    raise exception 'Closed requisition remained writable.';
  end if;
  if not public.current_can_access_recruiting_requisition(v_active_id) then
    raise exception 'Closed requisition history is no longer readable.';
  end if;
  if not exists (
    select 1
    from public.recruiting_activity_events
    where requisition_id = v_active_id
      and event_type = 'requisition.lifecycle_changed'
  ) then
    raise exception 'Lifecycle audit event was not recorded.';
  end if;

  begin
    insert into public.recruiting_tasks (
      requisition_id,
      title,
      created_by_person_id
    )
    values (
      v_active_id,
      'Must not be created after close',
      v_admin_person_id
    );
    raise exception 'Expected terminal requisition task guard.';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.recruiting_tasks (
      application_id,
      title,
      assigned_to_person_id,
      created_by_person_id
    )
    values (
      v_application_id,
      'Must not bypass close through application',
      v_admin_person_id,
      v_admin_person_id
    );
    raise exception 'Expected indirect terminal requisition task guard.';
  exception
    when check_violation then null;
  end;

  begin
    perform public.recruiting_delete_unused_draft_requisition(
      v_active_id,
      2,
      '10000000-0000-4000-8000-000000000004',
      repeat('d', 64)
    );
    raise exception 'Expected closed-position deletion protection.';
  exception
    when check_violation then null;
  end;

  v_result := public.recruiting_create_requisition(
    'TEST-LIFECYCLE-LINKED',
    'Linked draft behavior test',
    'Recruiting',
    null,
    null,
    1,
    false,
    '10000000-0000-4000-8000-000000000005',
    repeat('e', 64)
  );
  v_linked_id := (v_result ->> 'requisitionId')::uuid;

  begin
    perform public.recruiting_set_requisition_lifecycle(
      v_linked_id,
      'closed',
      1,
      repeat('x', 2001),
      '10000000-0000-4000-8000-000000000009',
      repeat('3', 64)
    );
    raise exception 'Expected lifecycle reason length protection.';
  exception
    when invalid_parameter_value then null;
  end;

  insert into public.recruiting_tasks (
    requisition_id,
    title,
    created_by_person_id
  )
  values (
    v_linked_id,
    'Linked draft task',
    v_admin_person_id
  );

  begin
    perform public.recruiting_delete_unused_draft_requisition(
      v_linked_id,
      1,
      '10000000-0000-4000-8000-000000000006',
      repeat('f', 64)
    );
    raise exception 'Expected linked-record deletion protection.';
  exception
    when foreign_key_violation then null;
  end;

  v_result := public.recruiting_create_requisition(
    'TEST-LIFECYCLE-UNUSED',
    'Unused draft behavior test',
    'Recruiting',
    null,
    null,
    1,
    false,
    '10000000-0000-4000-8000-000000000007',
    repeat('1', 64)
  );
  v_unused_id := (v_result ->> 'requisitionId')::uuid;

  perform public.recruiting_delete_unused_draft_requisition(
    v_unused_id,
    1,
    '10000000-0000-4000-8000-000000000008',
    repeat('2', 64)
  );
  if exists (
    select 1 from public.recruiting_requisitions where id = v_unused_id
  ) then
    raise exception 'Unused draft was not deleted.';
  end if;
end;
$$;

rollback;
