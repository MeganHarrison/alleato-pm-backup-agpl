select jsonb_build_object(
  'migration', exists (
    select 1 from supabase_migrations.schema_migrations migration
    where migration.version = '20260723001040'
  ),
  'context_rpc', to_regprocedure(
    'public.get_schedule_hourly_leveling_context(integer,timestamp with time zone,timestamp with time zone)'
  ) is not null,
  'task_fk_removed', not exists (
    select 1 from pg_constraint constraint_record
    where constraint_record.conrelid = 'public.schedule_leveling_run_changes'::regclass
      and constraint_record.conname = 'schedule_leveling_run_changes_task_project_fkey'
  ),
  'undo_version_column', exists (
    select 1 from information_schema.columns column_record
    where column_record.table_schema = 'public'
      and column_record.table_name = 'schedule_leveling_run_changes'
      and column_record.column_name = 'expected_undo_task_version'
  ),
  'exact_vector_trigger', exists (
    select 1 from pg_trigger trigger_record
    where trigger_record.tgrelid = 'public.schedule_leveling_runs'::regclass
      and trigger_record.tgname = 'schedule_leveling_runs_validate_person_vector'
      and not trigger_record.tgisinternal
  ),
  'calendar_admin_triggers', (
    select count(*) from pg_trigger trigger_record
    where trigger_record.tgname in (
      'schedule_person_work_calendars_require_admin',
      'schedule_person_work_weekly_require_admin',
      'schedule_person_work_date_require_admin'
    ) and not trigger_record.tgisinternal
  ),
  'authenticated_context_execute', has_function_privilege(
    'authenticated',
    'public.get_schedule_hourly_leveling_context(integer,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  )
) as hardening_readback;
