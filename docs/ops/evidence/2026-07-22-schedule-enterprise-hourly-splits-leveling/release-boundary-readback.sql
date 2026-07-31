select jsonb_build_object(
  'migration_applied', exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20260723013000'
  ),
  'authenticated_direct_create_revoked', not has_function_privilege(
    'authenticated',
    'public.create_schedule_leveling_run(integer,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)',
    'execute'
  ),
  'service_authoritative_create_granted', has_function_privilege(
    'service_role',
    'public.create_authoritative_schedule_leveling_run(uuid,integer,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)',
    'execute'
  ),
  'event_project_foreign_keys', (
    select count(*)
    from pg_catalog.pg_constraint
    where conrelid = 'public.schedule_leveling_events'::regclass
      and conname in (
        'schedule_leveling_events_related_event_project_fkey',
        'schedule_leveling_events_source_revision_project_fkey',
        'schedule_leveling_events_target_revision_project_fkey'
      )
  )
) as release_boundary_readback;
