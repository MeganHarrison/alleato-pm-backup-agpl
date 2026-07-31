select
  to_regclass('public.schedule_resource_capacity_exceptions_project_date_resource_idx') is not null
    as project_date_capacity_index_exists,
  to_regprocedure('public.replace_schedule_resource_capacity_profile(integer,uuid,jsonb,jsonb)') is null
    as legacy_replace_signature_removed,
  to_regprocedure('public.replace_schedule_resource_capacity_profile(integer,uuid,jsonb,jsonb,integer)') is not null
    as cas_replace_signature_exists,
  to_regprocedure('public.get_schedule_resource_read_model(integer,date,date,uuid,integer,boolean)') is not null
    as coherent_read_model_exists;

select
  procedure.proname,
  procedure.prosecdef as security_definer,
  procedure.provolatile,
  procedure.proconfig,
  has_function_privilege(
    'authenticated',
    procedure.oid,
    'EXECUTE'
  ) as authenticated_can_execute,
  has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_can_execute
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'get_schedule_resource_read_model',
    'replace_schedule_resource_capacity_profile'
  )
order by procedure.proname;

select version
from supabase_migrations.schema_migrations
where version in ('20260722161757', '20260722172738', '20260722183059')
order by version;

select
  to_regprocedure('private.get_schedule_resource_read_model_unbounded_20260722(integer,date,date,uuid,integer,boolean)') is not null
    as private_read_helper_exists,
  has_function_privilege(
    'authenticated',
    'private.get_schedule_resource_read_model_unbounded_20260722(integer,date,date,uuid,integer,boolean)',
    'EXECUTE'
  ) as authenticated_can_execute_private_helper;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6', true);
select jsonb_build_object(
  'project_id', read_model->'project_id',
  'range', read_model->'range',
  'resource_count', jsonb_array_length(read_model->'resources'),
  'capacity_profile_count', jsonb_array_length(read_model->'capacity_profiles')
) as authenticated_read_model_summary
from (
  select public.get_schedule_resource_read_model(
    67,
    date '2026-07-27',
    date '2026-07-29',
    null,
    null,
    false
  ) as read_model
) coherent_read;
rollback;

select jsonb_build_object(
  'project_date_capacity_index_exists',
    to_regclass('public.schedule_resource_capacity_exceptions_project_date_resource_idx') is not null,
  'legacy_replace_signature_removed',
    to_regprocedure('public.replace_schedule_resource_capacity_profile(integer,uuid,jsonb,jsonb)') is null,
  'cas_replace_signature_exists',
    to_regprocedure('public.replace_schedule_resource_capacity_profile(integer,uuid,jsonb,jsonb,integer)') is not null,
  'coherent_read_model_exists',
    to_regprocedure('public.get_schedule_resource_read_model(integer,date,date,uuid,integer,boolean)') is not null,
  'private_read_helper_exists',
    to_regprocedure('private.get_schedule_resource_read_model_unbounded_20260722(integer,date,date,uuid,integer,boolean)') is not null,
  'authenticated_can_execute_private_helper',
    has_function_privilege(
      'authenticated',
      'private.get_schedule_resource_read_model_unbounded_20260722(integer,date,date,uuid,integer,boolean)',
      'EXECUTE'
    ),
  'migration_versions', (
    select jsonb_agg(migration.version order by migration.version)
    from supabase_migrations.schema_migrations migration
    where migration.version in ('20260722161757', '20260722172738', '20260722183059')
  ),
  'function_contracts', (
    select jsonb_agg(
      jsonb_build_object(
        'name', procedure.proname,
        'security_definer', procedure.prosecdef,
        'volatility', procedure.provolatile,
        'config', procedure.proconfig,
        'authenticated_execute', has_function_privilege('authenticated', procedure.oid, 'EXECUTE'),
        'anon_execute', has_function_privilege('anon', procedure.oid, 'EXECUTE')
      ) order by procedure.proname
    )
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'get_schedule_resource_read_model',
        'replace_schedule_resource_capacity_profile'
      )
  )
) as schema_contract_summary;
