-- schedule_dependencies is scoped through its task foreign keys, not a
-- project_id column. Repair the deployed field-update function before any
-- production field fact can be saved.
do $$
declare
  definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'apply_schedule_field_update';

  if definition is null or position('d.project_id' in definition) = 0 then
    raise exception 'Expected schedule field update function with the known impact CTE was not found.';
  end if;

  definition := replace(
    definition,
    'from public.schedule_dependencies d where d.project_id = p_project_id and d.predecessor_task_id = p_task_id union select d.task_id from public.schedule_dependencies d join downstream x on d.predecessor_task_id = x.task_id where d.project_id = p_project_id',
    'from public.schedule_dependencies d join public.schedule_tasks predecessor on predecessor.id = d.predecessor_task_id where predecessor.project_id = p_project_id and d.predecessor_task_id = p_task_id union select d.task_id from public.schedule_dependencies d join downstream x on d.predecessor_task_id = x.task_id join public.schedule_tasks predecessor on predecessor.id = d.predecessor_task_id where predecessor.project_id = p_project_id'
  );
  execute definition;
end $$;
