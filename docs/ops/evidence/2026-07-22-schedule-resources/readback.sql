-- ALL-5 read-only schema and snapshot readback. Fill :project_id and :revision_id.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'schedule_resources', 'schedule_task_assignments',
    'schedule_revision_resource_snapshots', 'schedule_revision_assignment_snapshots'
  )
order by tablename;

select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'schedule_resources', 'schedule_task_assignments',
    'schedule_revision_resource_snapshots', 'schedule_revision_assignment_snapshots'
  )
order by table_name, grantee, privilege_type;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'schedule_resources', 'schedule_task_assignments',
    'schedule_revision_resource_snapshots', 'schedule_revision_assignment_snapshots'
  )
order by tablename, policyname;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.schedule_resources'::regclass,
  'public.schedule_task_assignments'::regclass,
  'public.schedule_revision_resource_snapshots'::regclass,
  'public.schedule_revision_assignment_snapshots'::regclass
)
order by conrelid::regclass::text, conname;

select indexrelid::regclass as index_name, pg_get_indexdef(indexrelid) as definition
from pg_index
where indrelid in ('public.schedule_resources'::regclass, 'public.schedule_task_assignments'::regclass)
order by indexrelid::regclass::text;

select p.proname, p.prosecdef, p.proconfig,
  pg_get_userbyid(p.proowner) as owner,
  p.proacl,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('replace_schedule_task_assignments', 'create_schedule_revision_snapshot')
order by p.proname;

select relation.relname as table_name, trigger.tgname as trigger_name,
  pg_get_triggerdef(trigger.oid) as definition
from pg_trigger trigger
join pg_class relation on relation.oid = trigger.tgrelid
join pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and not trigger.tgisinternal
  and relation.relname in ('schedule_revision_resource_snapshots', 'schedule_revision_assignment_snapshots')
order by relation.relname, trigger.tgname;

select jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object('table', tablename, 'rls', rowsecurity) order by tablename)
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'schedule_resources', 'schedule_task_assignments',
        'schedule_revision_resource_snapshots', 'schedule_revision_assignment_snapshots'
      )
  ),
  'policies', (
    select jsonb_agg(jsonb_build_object(
      'table', tablename, 'policy', policyname, 'roles', roles,
      'command', cmd, 'using', qual, 'check', with_check
    ) order by tablename, policyname)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'schedule_resources', 'schedule_task_assignments',
        'schedule_revision_resource_snapshots', 'schedule_revision_assignment_snapshots'
      )
  ),
  'privileges', (
    select jsonb_build_object(
      'authenticated_live_select',
        has_table_privilege('authenticated', 'public.schedule_resources', 'SELECT')
        and has_table_privilege('authenticated', 'public.schedule_task_assignments', 'SELECT'),
      'authenticated_live_write',
        has_table_privilege('authenticated', 'public.schedule_resources', 'INSERT,UPDATE,DELETE')
        or has_table_privilege('authenticated', 'public.schedule_task_assignments', 'INSERT,UPDATE,DELETE'),
      'authenticated_snapshot_select',
        has_table_privilege('authenticated', 'public.schedule_revision_resource_snapshots', 'SELECT')
        and has_table_privilege('authenticated', 'public.schedule_revision_assignment_snapshots', 'SELECT'),
      'service_live_write',
        has_table_privilege('service_role', 'public.schedule_resources', 'INSERT,UPDATE,DELETE')
        and has_table_privilege('service_role', 'public.schedule_task_assignments', 'INSERT,UPDATE,DELETE'),
      'service_snapshot_write',
        has_table_privilege('service_role', 'public.schedule_revision_resource_snapshots', 'INSERT,UPDATE,DELETE,TRUNCATE')
        or has_table_privilege('service_role', 'public.schedule_revision_assignment_snapshots', 'INSERT,UPDATE,DELETE,TRUNCATE')
    )
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname, 'security_definer', p.prosecdef, 'config', p.proconfig,
      'owner', pg_get_userbyid(p.proowner),
      'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role_execute', has_function_privilege('service_role', p.oid, 'EXECUTE')
    ) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('replace_schedule_task_assignments', 'create_schedule_revision_snapshot')
  ),
  'constraint_count', (
    select count(*)
    from pg_constraint
    where conrelid in (
      'public.schedule_resources'::regclass,
      'public.schedule_task_assignments'::regclass,
      'public.schedule_revision_resource_snapshots'::regclass,
      'public.schedule_revision_assignment_snapshots'::regclass
    )
  ),
  'indexes', (
    select jsonb_agg(indexrelid::regclass::text order by indexrelid::regclass::text)
    from pg_index
    where indrelid in ('public.schedule_resources'::regclass, 'public.schedule_task_assignments'::regclass)
  ),
  'immutable_triggers', (
    select jsonb_agg(jsonb_build_object(
      'table', relation.relname, 'trigger', trigger.tgname,
      'definition', pg_get_triggerdef(trigger.oid)
    ) order by relation.relname, trigger.tgname)
    from pg_trigger trigger
    join pg_class relation on relation.oid = trigger.tgrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and not trigger.tgisinternal
      and relation.relname in ('schedule_revision_resource_snapshots', 'schedule_revision_assignment_snapshots')
  ),
  'recent_revisions', (
    select jsonb_agg(to_jsonb(revision_readback) order by revision_readback.created_at desc)
    from (
      select revision.id, revision.project_id, revision.created_at,
        revision.resource_context_provenance,
        (select count(*) from public.schedule_resources resource where resource.project_id = revision.project_id) as live_resources,
        (select count(*) from public.schedule_revision_resource_snapshots snapshot where snapshot.revision_id = revision.id) as snapshot_resources,
        (select count(*) from public.schedule_task_assignments assignment where assignment.project_id = revision.project_id) as live_assignments,
        (select count(*) from public.schedule_revision_assignment_snapshots snapshot where snapshot.revision_id = revision.id) as snapshot_assignments
      from public.schedule_revisions revision
      order by revision.created_at desc
      limit 5
    ) revision_readback
  )
) as all5_readback;
