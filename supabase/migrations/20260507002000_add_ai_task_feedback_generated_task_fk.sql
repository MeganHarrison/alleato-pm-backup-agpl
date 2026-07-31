alter table public.ai_task_feedback
  add column if not exists generated_task_id uuid;

comment on column public.ai_task_feedback.generated_task_id is
  'Generated tasks.id row reviewed by the user. task_id remains for legacy schedule_tasks feedback.';

create index if not exists ai_task_feedback_generated_task_idx
  on public.ai_task_feedback (generated_task_id, created_at desc)
  where generated_task_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_task_feedback_generated_task_id_fkey'
      and conrelid = 'public.ai_task_feedback'::regclass
  ) then
    alter table public.ai_task_feedback
      add constraint ai_task_feedback_generated_task_id_fkey
      foreign key (generated_task_id)
      references public.tasks(id)
      on delete set null;
  end if;
end $$;
