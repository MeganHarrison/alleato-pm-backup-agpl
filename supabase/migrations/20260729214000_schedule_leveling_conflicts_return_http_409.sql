-- Complete the scheduling HTTP-conflict contract for the earlier Phase 4C
-- resource-capacity, work-calendar, segment, and leveling functions.

begin;

do $migration$
declare
  v_signature text;
  v_function regprocedure;
  v_definition text;
  v_rewritten text;
begin
  foreach v_signature in array array[
    'private.assert_schedule_person_revision_vector(jsonb)',
    'private.write_schedule_hourly_state(integer,uuid,jsonb,uuid)',
    'public.apply_schedule_leveling_run(integer,uuid,text)',
    'public.create_schedule_leveling_run(integer,text,text,jsonb,jsonb,jsonb,jsonb,timestamp with time zone)',
    'public.replace_schedule_person_work_calendar(integer,uuid,text,jsonb,jsonb,bigint)',
    'public.replace_schedule_resource_capacity_profile(integer,uuid,jsonb,jsonb,integer)',
    'public.replace_schedule_task_segments(integer,uuid,jsonb,bigint)',
    'public.undo_schedule_leveling_event(integer,uuid,text)'
  ]
  loop
    v_function := to_regprocedure(v_signature);
    if v_function is null then
      raise exception 'Required scheduling function is missing: %', v_signature;
    end if;

    v_definition := pg_get_functiondef(v_function);
    v_rewritten := replace(
      v_definition,
      'errcode = ''40001''',
      'errcode = ''PT409'''
    );

    if v_rewritten = v_definition then
      raise exception 'Scheduling function has no 40001 conflict signal: %', v_signature;
    end if;

    execute v_rewritten;
  end loop;
end;
$migration$;

commit;
