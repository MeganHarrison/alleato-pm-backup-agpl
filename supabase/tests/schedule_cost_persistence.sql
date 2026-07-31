begin;

set local search_path = public, extensions;

select plan(21);

select has_function(
  'public',
  'upsert_schedule_cost_resource',
  array['integer','uuid','text','text','numeric','numeric','text','integer'],
  'cost resources have one guarded upsert RPC'
);

select has_function(
  'public',
  'delete_schedule_cost_resource',
  array['integer','uuid','integer'],
  'cost resources have one guarded delete RPC'
);

select has_function(
  'public',
  'upsert_schedule_cost_assignment',
  array['integer','uuid','uuid','integer','numeric','numeric','numeric','numeric','integer'],
  'cost assignments have one guarded upsert RPC'
);

select has_function(
  'public',
  'delete_schedule_cost_assignment',
  array['integer','uuid','integer'],
  'cost assignments have one guarded delete RPC'
);

select function_privs_are(
  'public',
  'upsert_schedule_cost_resource',
  array['integer','uuid','text','text','numeric','numeric','text','integer'],
  'authenticated',
  array['EXECUTE'],
  'authenticated project managers can call cost-resource upsert'
);

select function_privs_are(
  'public',
  'delete_schedule_cost_resource',
  array['integer','uuid','integer'],
  'authenticated',
  array['EXECUTE'],
  'authenticated project managers can call cost-resource delete'
);

select function_privs_are(
  'public',
  'upsert_schedule_cost_assignment',
  array['integer','uuid','uuid','integer','numeric','numeric','numeric','numeric','integer'],
  'authenticated',
  array['EXECUTE'],
  'authenticated project managers can call cost-assignment upsert'
);

select function_privs_are(
  'public',
  'delete_schedule_cost_assignment',
  array['integer','uuid','integer'],
  'authenticated',
  array['EXECUTE'],
  'authenticated project managers can call cost-assignment delete'
);

select function_privs_are(
  'public',
  'upsert_schedule_cost_resource',
  array['integer','uuid','text','text','numeric','numeric','text','integer'],
  'anon',
  array[]::text[],
  'anonymous clients cannot upsert cost resources'
);

select function_privs_are(
  'public',
  'delete_schedule_cost_resource',
  array['integer','uuid','integer'],
  'anon',
  array[]::text[],
  'anonymous clients cannot delete cost resources'
);

select function_privs_are(
  'public',
  'upsert_schedule_cost_assignment',
  array['integer','uuid','uuid','integer','numeric','numeric','numeric','numeric','integer'],
  'anon',
  array[]::text[],
  'anonymous clients cannot upsert cost assignments'
);

select function_privs_are(
  'public',
  'delete_schedule_cost_assignment',
  array['integer','uuid','integer'],
  'anon',
  array[]::text[],
  'anonymous clients cannot delete cost assignments'
);

select results_eq(
  $$
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedule_resources'
      and column_name in (
        'resource_kind',
        'display_name',
        'standard_rate',
        'cost_per_use',
        'rate_unit',
        'cost_version'
      )
    order by column_name
  $$,
  $$
    values
      ('cost_per_use'),
      ('cost_version'),
      ('display_name'),
      ('rate_unit'),
      ('resource_kind'),
      ('standard_rate')
  $$,
  'resource kind, rates, display name, and CAS version are persisted'
);

select results_eq(
  $$
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedule_task_assignments'
      and column_name in (
        'planned_units',
        'actual_units',
        'actual_rate',
        'actual_cost',
        'cost_version'
      )
    order by column_name
  $$,
  $$
    values
      ('actual_cost'),
      ('actual_rate'),
      ('actual_units'),
      ('cost_version'),
      ('planned_units')
  $$,
  'planned units, explicit actuals, and assignment CAS version are persisted'
);

select results_eq(
  $$
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (
          table_name = 'schedule_revision_resource_snapshots'
          and column_name in (
            'resource_kind',
            'standard_rate',
            'cost_per_use',
            'rate_unit',
            'source_cost_version'
          )
        )
        or (
          table_name = 'schedule_revision_assignment_snapshots'
          and column_name in (
            'planned_units',
            'actual_units',
            'actual_rate',
            'actual_cost',
            'source_cost_version'
          )
        )
      )
    order by table_name, column_name
  $$,
  $$
    values
      ('schedule_revision_assignment_snapshots', 'actual_cost'),
      ('schedule_revision_assignment_snapshots', 'actual_rate'),
      ('schedule_revision_assignment_snapshots', 'actual_units'),
      ('schedule_revision_assignment_snapshots', 'planned_units'),
      ('schedule_revision_assignment_snapshots', 'source_cost_version'),
      ('schedule_revision_resource_snapshots', 'cost_per_use'),
      ('schedule_revision_resource_snapshots', 'rate_unit'),
      ('schedule_revision_resource_snapshots', 'resource_kind'),
      ('schedule_revision_resource_snapshots', 'source_cost_version'),
      ('schedule_revision_resource_snapshots', 'standard_rate')
  $$,
  'revision snapshots retain immutable resource and assignment cost facts'
);

select results_eq(
  $$
    select tgname
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'schedule_resources_bump_cost_version',
        'schedule_task_assignments_bump_cost_version'
      )
    order by tgname
  $$,
  $$
    values
      ('schedule_resources_bump_cost_version'),
      ('schedule_task_assignments_bump_cost_version')
  $$,
  'resource and assignment cost writes advance their CAS versions'
);

select has_function(
  'public',
  'replace_schedule_task_assignments',
  array['integer','uuid','jsonb','jsonb'],
  'people assignment replacement accepts an exact CAS snapshot'
);

select function_privs_are(
  'public',
  'replace_schedule_task_assignments',
  array['integer','uuid','jsonb','jsonb'],
  'authenticated',
  array['EXECUTE'],
  'authenticated project managers can replace person assignments'
);

select function_privs_are(
  'public',
  'replace_schedule_task_assignments',
  array['integer','uuid','jsonb','jsonb'],
  'anon',
  array[]::text[],
  'anonymous clients cannot replace person assignments'
);

select results_eq(
  $$
    select tgname
    from pg_trigger
    where not tgisinternal
      and tgname = 'schedule_dependencies_bump_task_versions'
  $$,
  $$ values ('schedule_dependencies_bump_task_versions') $$,
  'dependency edits invalidate task-version snapshots'
);

select ok(
  position(
    'resource.resource_kind = ''person''' in
    pg_get_functiondef(
      'public.replace_schedule_task_assignments(integer,uuid,jsonb,jsonb)'::regprocedure
    )
  ) > 0,
  'people replacement deletes only person-kind assignments'
);

select * from finish();

rollback;
