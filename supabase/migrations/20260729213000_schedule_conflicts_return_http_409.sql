-- Expected optimistic-concurrency failures must be returned to HTTP clients
-- immediately as conflicts. SQLSTATE 40001 belongs to PostgreSQL's transaction
-- rollback class and is treated by PostgREST as a server error. PT409 is
-- PostgREST's documented custom status code for an HTTP 409 response.

begin;

do $migration$
declare
  v_signature text;
  v_function regprocedure;
  v_definition text;
  v_rewritten text;
begin
  foreach v_signature in array array[
    'public.apply_authoritative_schedule_cascade_mutation(uuid,integer,jsonb,jsonb,jsonb,jsonb,text,jsonb,jsonb)',
    'public.replace_schedule_task_assignments(integer,uuid,jsonb,jsonb)',
    'public.upsert_schedule_cost_resource(integer,uuid,text,text,numeric,numeric,text,integer)',
    'public.delete_schedule_cost_resource(integer,uuid,integer)',
    'public.upsert_schedule_cost_assignment(integer,uuid,uuid,integer,numeric,numeric,numeric,numeric,integer)',
    'public.delete_schedule_cost_assignment(integer,uuid,integer)'
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
