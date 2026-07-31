-- Add durable ownership and priority fields for schedule tasks created from AI/action flows.
-- Existing AI createTask tooling already writes assignee and priority; without these
-- columns the write path fails and personal task lookups cannot distinguish verified
-- tasks from inferred communication follow-ups.

alter table public.schedule_tasks
  add column if not exists assignee text,
  add column if not exists assignee_person_id uuid,
  add column if not exists priority text not null default 'normal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_tasks_assignee_person_id_fkey'
      and conrelid = 'public.schedule_tasks'::regclass
  ) then
    alter table public.schedule_tasks
      add constraint schedule_tasks_assignee_person_id_fkey
      foreign key (assignee_person_id)
      references public.people(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_tasks_priority_check'
      and conrelid = 'public.schedule_tasks'::regclass
  ) then
    alter table public.schedule_tasks
      add constraint schedule_tasks_priority_check
      check (priority in ('low', 'normal', 'high', 'critical'));
  end if;
end $$;

create index if not exists idx_schedule_tasks_assignee_person
  on public.schedule_tasks (assignee_person_id)
  where assignee_person_id is not null;

create index if not exists idx_schedule_tasks_project_priority
  on public.schedule_tasks (project_id, priority);

comment on column public.schedule_tasks.assignee is
  'Display assignee captured by schedule imports, manual task creation, and AI createTask previews.';

comment on column public.schedule_tasks.assignee_person_id is
  'Optional resolved person owner for personal task register and permission-aware task views.';

comment on column public.schedule_tasks.priority is
  'Task priority used by AI/action flows and personal task register.';
