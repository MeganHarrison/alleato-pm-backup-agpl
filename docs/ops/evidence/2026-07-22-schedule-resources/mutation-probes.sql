-- ALL-5 read/write boundary probes. Every block rolls back.

begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.schedule_resources', 'INSERT')
     or has_table_privilege('authenticated', 'public.schedule_task_assignments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.schedule_task_assignments', 'DELETE') then
    raise exception 'Authenticated direct schedule-resource DML is unexpectedly allowed.';
  end if;

  if has_table_privilege('service_role', 'public.schedule_revision_resource_snapshots', 'UPDATE')
     or has_table_privilege('service_role', 'public.schedule_revision_assignment_snapshots', 'DELETE')
     or has_table_privilege('service_role', 'public.schedule_revision_assignment_snapshots', 'TRUNCATE') then
    raise exception 'Revision resource/assignment snapshots are unexpectedly mutable.';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
begin
  begin
    insert into public.schedule_resources default values;
    raise exception 'Authenticated direct resource INSERT unexpectedly succeeded.';
  exception
    when insufficient_privilege then
      raise notice 'PASS: authenticated direct resource INSERT denied';
  end;

  begin
    perform public.replace_schedule_task_assignments(
      67,
      '00000000-0000-4000-8000-000000000002'::uuid,
      '[]'::jsonb
    );
    raise exception 'Non-manager assignment replacement unexpectedly succeeded.';
  exception
    when insufficient_privilege then
      raise notice 'PASS: non-manager assignment replacement denied';
  end;
end;
$$;

rollback;

begin;

insert into public.people(id, first_name, last_name, person_type, status)
values
  ('ffffffff-ffff-4fff-8fff-ffffffffa001', 'Probe', 'Inactive person', 'contact', 'inactive'),
  ('ffffffff-ffff-4fff-8fff-ffffffffa002', 'Probe', 'Inactive membership', 'contact', 'active');

insert into public.project_directory_memberships(project_id, person_id, status, user_type)
values
  (67, 'ffffffff-ffff-4fff-8fff-ffffffffa001', 'active', 'subcontractor'),
  (67, 'ffffffff-ffff-4fff-8fff-ffffffffa002', 'inactive', 'subcontractor');

select set_config(
  'app.all5_cross_project_task_id',
  (
    select id::text
    from public.schedule_tasks
    where project_id <> 67
    order by created_at
    limit 1
  ),
  true
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (
      select id::text
      from auth.users
      where email = 'test1@mail.com'
      order by created_at
      limit 1
    ),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  v_task_id uuid;
  v_cross_project_task_id uuid := nullif(current_setting('app.all5_cross_project_task_id', true), '')::uuid;
begin
  select id into v_task_id
  from public.schedule_tasks
  where project_id = 67
  order by created_at
  limit 1;

  if v_task_id is null or v_cross_project_task_id is null then
    raise exception 'Assignment probes require persisted tasks in project 67 and another project.';
  end if;

  begin
    perform public.replace_schedule_task_assignments(
      67,
      v_cross_project_task_id,
      '[]'::jsonb
    );
    raise exception 'Cross-project task replacement unexpectedly succeeded.';
  exception
    when no_data_found then
      raise notice 'PASS: actual task from another project rejected';
  end;

  begin
    perform public.replace_schedule_task_assignments(
      67,
      v_task_id,
      jsonb_build_array(jsonb_build_object(
        'person_id', 'ffffffff-ffff-4fff-8fff-ffffffffa001',
        'allocation_percent', 100
      ))
    );
    raise exception 'Inactive person assignment unexpectedly succeeded.';
  exception
    when invalid_parameter_value then
      raise notice 'PASS: actual inactive person rejected';
  end;

  begin
    perform public.replace_schedule_task_assignments(
      67,
      v_task_id,
      jsonb_build_array(jsonb_build_object(
        'person_id', 'ffffffff-ffff-4fff-8fff-ffffffffa002',
        'allocation_percent', 100
      ))
    );
    raise exception 'Inactive membership assignment unexpectedly succeeded.';
  exception
    when invalid_parameter_value then
      raise notice 'PASS: actual inactive project membership rejected';
  end;
end;
$$;

rollback;

begin;

do $$
declare
  v_revision_id uuid;
  v_task_source_id uuid;
  v_resource_source_id uuid := gen_random_uuid();
  v_resource_rejected boolean := false;
  v_assignment_rejected boolean := false;
  v_truncate_rejected boolean := false;
begin
  select task_snapshot.revision_id, task_snapshot.source_task_id
  into v_revision_id, v_task_source_id
  from public.schedule_revision_task_snapshots task_snapshot
  order by task_snapshot.revision_id, task_snapshot.source_task_id
  limit 1;

  if v_revision_id is null then
    raise exception 'Snapshot mutation probes require one existing task snapshot.';
  end if;

  insert into public.schedule_revision_resource_snapshots(
    revision_id, source_resource_id, source_person_id, display_name,
    person_status, membership_status
  ) values (
    v_revision_id, v_resource_source_id, gen_random_uuid(), 'ALL-5 probe resource',
    'active', 'active'
  );

  insert into public.schedule_revision_assignment_snapshots(
    revision_id, source_assignment_id, task_source_id, resource_source_id, allocation_percent
  ) values (
    v_revision_id, gen_random_uuid(), v_task_source_id, v_resource_source_id, 100
  );

  begin
    update public.schedule_revision_resource_snapshots
    set display_name = 'Mutation must fail'
    where revision_id = v_revision_id and source_resource_id = v_resource_source_id;
  exception when others then
    v_resource_rejected := true;
    raise notice 'PASS: owner-level resource snapshot update rejected: %', sqlerrm;
  end;

  begin
    update public.schedule_revision_assignment_snapshots
    set allocation_percent = 99
    where revision_id = v_revision_id and resource_source_id = v_resource_source_id;
  exception when others then
    v_assignment_rejected := true;
    raise notice 'PASS: owner-level assignment snapshot update rejected: %', sqlerrm;
  end;

  begin
    truncate public.schedule_revision_assignment_snapshots;
  exception when others then
    v_truncate_rejected := true;
    raise notice 'PASS: owner-level assignment snapshot truncate rejected: %', sqlerrm;
  end;

  if not v_resource_rejected or not v_assignment_rejected or not v_truncate_rejected then
    raise exception 'One or more owner-level immutable snapshot mutations unexpectedly succeeded.';
  end if;
end;
$$;

rollback;

select jsonb_build_object(
  'authenticated_direct_dml', 'rejected',
  'non_manager_rpc', 'rejected',
  'cross_project_task', 'rejected',
  'inactive_person', 'rejected',
  'inactive_membership', 'rejected',
  'resource_snapshot_update', 'rejected',
  'assignment_snapshot_update', 'rejected',
  'assignment_snapshot_truncate', 'rejected',
  'transactional_cleanup', 'rolled_back'
) as all5_mutation_probe_summary;
