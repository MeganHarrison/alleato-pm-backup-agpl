with target_functions as (
  select
    p.proname,
    position('PT409' in pg_get_functiondef(p.oid)) > 0 as uses_http_409
  from pg_proc p
  where p.oid in (
    'public.apply_authoritative_schedule_cascade_mutation(uuid,integer,jsonb,jsonb,jsonb,jsonb,text,jsonb,jsonb)'::regprocedure,
    'public.replace_schedule_task_assignments(integer,uuid,jsonb,jsonb)'::regprocedure,
    'public.upsert_schedule_cost_resource(integer,uuid,text,text,numeric,numeric,text,integer)'::regprocedure,
    'public.delete_schedule_cost_resource(integer,uuid,integer)'::regprocedure,
    'public.upsert_schedule_cost_assignment(integer,uuid,uuid,integer,numeric,numeric,numeric,numeric,integer)'::regprocedure,
    'public.delete_schedule_cost_assignment(integer,uuid,integer)'::regprocedure,
    'private.assert_schedule_person_revision_vector(jsonb)'::regprocedure,
    'private.write_schedule_hourly_state(integer,uuid,jsonb,uuid)'::regprocedure,
    'public.apply_schedule_leveling_run(integer,uuid,text)'::regprocedure,
    'public.create_schedule_leveling_run(integer,text,text,jsonb,jsonb,jsonb,jsonb,timestamp with time zone)'::regprocedure,
    'public.replace_schedule_person_work_calendar(integer,uuid,text,jsonb,jsonb,bigint)'::regprocedure,
    'public.replace_schedule_resource_capacity_profile(integer,uuid,jsonb,jsonb,integer)'::regprocedure,
    'public.replace_schedule_task_segments(integer,uuid,jsonb,bigint)'::regprocedure,
    'public.undo_schedule_leveling_event(integer,uuid,text)'::regprocedure
  )
)
select
  (
    select jsonb_agg(
      jsonb_build_object(
        'function', proname,
        'uses_http_409', uses_http_409
      )
      order by proname
    )
    from target_functions
  ) as functions,
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729213000'
  ) and exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260729214000'
  ) as migrations_recorded,
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'schema', n.nspname,
          'function', p.oid::regprocedure::text
        )
        order by n.nspname, p.oid::regprocedure::text
      ),
      '[]'::jsonb
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and (
        p.proname like '%schedule%'
        or p.proname like '%leveling%'
      )
      and position('40001' in pg_get_functiondef(p.oid)) > 0
  ) as remaining_legacy_conflicts;
