begin;

set local search_path = public, extensions;

select plan(19);

select has_function(
  'public',
  'apply_authoritative_schedule_cascade_mutation',
  array['uuid','integer','jsonb','jsonb','jsonb','jsonb','text','jsonb','jsonb'],
  'the authoritative schedule mutation RPC exists'
);

select function_privs_are(
  'public',
  'apply_authoritative_schedule_cascade_mutation',
  array['uuid','integer','jsonb','jsonb','jsonb','jsonb','text','jsonb','jsonb'],
  'service_role',
  array['EXECUTE'],
  'service_role can execute the authoritative schedule mutation RPC'
);

select function_privs_are(
  'public',
  'apply_authoritative_schedule_cascade_mutation',
  array['uuid','integer','jsonb','jsonb','jsonb','jsonb','text','jsonb','jsonb'],
  'authenticated',
  array[]::text[],
  'authenticated clients cannot execute the authoritative schedule mutation RPC'
);

select function_privs_are(
  'public',
  'apply_authoritative_schedule_cascade_mutation',
  array['uuid','integer','jsonb','jsonb','jsonb','jsonb','text','jsonb','jsonb'],
  'anon',
  array[]::text[],
  'anonymous clients cannot execute the authoritative schedule mutation RPC'
);

select results_eq(
  $$
    select prosecdef
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'apply_authoritative_schedule_cascade_mutation'
  $$,
  $$ values (true) $$,
  'the authoritative schedule mutation RPC is security definer'
);

-- Transactional test fixture. DDL and data are rolled back by this file.
insert into public.projects (id, name, created_via)
values
  (2147483001, 'Scheduling RPC test project', 'test'),
  (2147483002, 'Scheduling RPC foreign project', 'test');

create or replace function public.current_can_manage_schedule(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  select
    p_project_id = 2147483001
    and auth.uid() = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
$$;

select throws_ok(
  $$
    select public.apply_authoritative_schedule_cascade_mutation(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      2147483001,
      '{"kind":"task_create","task_id":"11111111-1111-4111-8111-111111111111","values":{"name":"Rejected"}}',
      '{}', '[]', '[]', 'no_change', '[]', '[]'
    )
  $$,
  '42501',
  'apply_authoritative_schedule_cascade_mutation is service-role only',
  'non-service callers fail before actor rehydration'
);

select lives_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2147483001,
        '{"kind":"task_create","task_id":"11111111-1111-4111-8111-111111111111","values":{"name":"Foundation","sort_order":1}}',
        '{}',
        '[]',
        '[]',
        'no_change',
        '[]',
        '[{"id":"11111111-1111-4111-8111-111111111111","parent_task_id":null,"sort_order":1}]'
      );
    end
    $test$
  $$,
  'an authorized actor can atomically create the first root task'
);

select is(
  (select name from public.schedule_tasks where id = '11111111-1111-4111-8111-111111111111'),
  'Foundation',
  'the authorized task create is persisted'
);

select throws_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        2147483001,
        '{"kind":"task_create","task_id":"22222222-2222-4222-8222-222222222222","values":{"name":"Forbidden"}}',
        '{"11111111-1111-4111-8111-111111111111":1}',
        '[]', '[]', 'no_change', '[]', '[]'
      );
    end
    $test$
  $$,
  '42501',
  'schedule management permission required',
  'actor authorization is fail closed'
);

select throws_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2147483001,
        '{"kind":"task_update","task_id":"11111111-1111-4111-8111-111111111111","changes":{"name":"Stale"}}',
        '{"11111111-1111-4111-8111-111111111111":999}',
        '[]', '[]', 'no_change', '[]', '[]'
      );
    end
    $test$
  $$,
  'PT409',
  'schedule task version conflict',
  'a stale task version is rejected'
);

select throws_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2147483001,
        '{"kind":"task_update","task_id":"11111111-1111-4111-8111-111111111111","changes":{"name":"Must roll back"}}',
        jsonb_build_object(
          '11111111-1111-4111-8111-111111111111',
          (select schedule_version from public.schedule_tasks where id = '11111111-1111-4111-8111-111111111111')
        ),
        '[]',
        '[{"task_id":"33333333-3333-4333-8333-333333333333","start_date":"2026-08-01","finish_date":"2026-08-02"}]',
        'applied',
        '[]',
        '[]'
      );
    end
    $test$
  $$,
  '22023',
  'cascade target is missing its expected task version',
  'an invalid cascade target aborts the whole mutation'
);

select is(
  (select name from public.schedule_tasks where id = '11111111-1111-4111-8111-111111111111'),
  'Foundation',
  'a failed cascade leaves the base task unchanged'
);

select lives_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2147483001,
        '{"kind":"task_create","task_id":"22222222-2222-4222-8222-222222222222","values":{"name":"Framing","sort_order":2}}',
        jsonb_build_object(
          '11111111-1111-4111-8111-111111111111',
          (select schedule_version from public.schedule_tasks where id = '11111111-1111-4111-8111-111111111111')
        ),
        '[]',
        '[]',
        'no_change',
        jsonb_build_array(jsonb_build_object(
          'id', '11111111-1111-4111-8111-111111111111',
          'parent_task_id', null,
          'sort_order', 1,
          'schedule_version', (select schedule_version from public.schedule_tasks where id = '11111111-1111-4111-8111-111111111111')
        )),
        '[{"id":"22222222-2222-4222-8222-222222222222","parent_task_id":null,"sort_order":2}]'
      );
    end
    $test$
  $$,
  'a full sibling snapshot permits contiguous Enter insertion'
);

select results_eq(
  $$
    select sort_order
    from public.schedule_tasks
    where project_id = 2147483001
    order by sort_order
  $$,
  $$ values (1), (2) $$,
  'root sibling order is contiguous and one based'
);

select throws_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2147483001,
        '{"kind":"task_update","task_id":"22222222-2222-4222-8222-222222222222","changes":{"sort_order":1}}',
        jsonb_build_object(
          '11111111-1111-4111-8111-111111111111',
          (select schedule_version from public.schedule_tasks where id = '11111111-1111-4111-8111-111111111111'),
          '22222222-2222-4222-8222-222222222222',
          (select schedule_version from public.schedule_tasks where id = '22222222-2222-4222-8222-222222222222')
        ),
        '[]',
        '[]',
        'no_change',
        '[{"id":"11111111-1111-4111-8111-111111111111","parent_task_id":null,"sort_order":9,"schedule_version":1}]',
        '[{"id":"11111111-1111-4111-8111-111111111111","parent_task_id":null,"sort_order":2},{"id":"22222222-2222-4222-8222-222222222222","parent_task_id":null,"sort_order":1}]'
      );
    end
    $test$
  $$,
  'PT409',
  'schedule sibling ordering conflict',
  'a stale sibling snapshot is rejected'
);

create temporary table dependency_version_before as
select id, schedule_version
from public.schedule_tasks
where id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);

select lives_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2147483001,
        '{"kind":"dependency_create","task_id":"22222222-2222-4222-8222-222222222222","predecessor_task_id":"11111111-1111-4111-8111-111111111111","dependency_type":"finish_to_start","lag_days":0}',
        jsonb_build_object(
          '11111111-1111-4111-8111-111111111111',
          (select schedule_version from public.schedule_tasks where id = '11111111-1111-4111-8111-111111111111'),
          '22222222-2222-4222-8222-222222222222',
          (select schedule_version from public.schedule_tasks where id = '22222222-2222-4222-8222-222222222222')
        ),
        '[]', '[]', 'no_change', '[]', '[]'
      );
    end
    $test$
  $$,
  'a dependency create commits with the exact graph snapshot'
);

select throws_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2147483001,
        '{"kind":"task_update","task_id":"11111111-1111-4111-8111-111111111111","changes":{"name":"Stale graph writer"}}',
        (
          select jsonb_object_agg(id, schedule_version)
          from dependency_version_before
        ),
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', dependency.id,
              'task_id', dependency.task_id,
              'predecessor_task_id', dependency.predecessor_task_id,
              'dependency_type', dependency.dependency_type,
              'lag_days', dependency.lag_days
            )
            order by dependency.id
          )
          from public.schedule_dependencies dependency
          where dependency.task_id = '22222222-2222-4222-8222-222222222222'
        ),
        '[]',
        'no_change',
        '[]',
        '[]'
      );
    end
    $test$
  $$,
  'PT409',
  'schedule task version conflict',
  'a dependency edit invalidates a task mutation that read the prior graph'
);

select is(
  (select count(*)::integer from public.schedule_dependencies where task_id = '22222222-2222-4222-8222-222222222222'),
  1,
  'the dependency was created once'
);

select throws_ok(
  $$
    do $test$
    begin
      perform set_config('request.jwt.claim.role', 'service_role', true);
      perform public.apply_authoritative_schedule_cascade_mutation(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2147483001,
        jsonb_build_object(
          'kind', 'dependency_delete',
          'task_id', '22222222-2222-4222-8222-222222222222',
          'dependency_id', (select id from public.schedule_dependencies where task_id = '22222222-2222-4222-8222-222222222222')
        ),
        jsonb_build_object(
          '11111111-1111-4111-8111-111111111111',
          (select schedule_version from public.schedule_tasks where id = '11111111-1111-4111-8111-111111111111'),
          '22222222-2222-4222-8222-222222222222',
          (select schedule_version from public.schedule_tasks where id = '22222222-2222-4222-8222-222222222222')
        ),
        '[]', '[]', 'skipped_unavailable', '[]', '[]'
      );
    end
    $test$
  $$,
  'PT409',
  'schedule dependency graph conflict',
  'a stale full dependency graph is rejected'
);

select * from finish();
rollback;
