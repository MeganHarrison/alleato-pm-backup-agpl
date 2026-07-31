alter table public.tasks
  add column if not exists assignee_person_id uuid;

comment on column public.tasks.assignee_person_id is
  'Resolved people.id for task assignee. Free-text assignee_name/email are retained for source fidelity.';

create index if not exists idx_tasks_assignee_person_id
  on public.tasks (assignee_person_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_assignee_person_id_fkey'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_assignee_person_id_fkey
      foreign key (assignee_person_id)
      references public.people(id)
      on delete set null;
  end if;
end $$;
