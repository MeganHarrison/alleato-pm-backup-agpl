create table if not exists public.ai_task_feedback (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  project_id      integer references public.projects(id) on delete set null,
  task_id         uuid references public.schedule_tasks(id) on delete set null,
  signal          text not null check (signal in ('good', 'bad')),
  reason          text,
  task_snapshot   jsonb not null,
  session_id      text,
  learning_id     uuid,
  promoted        boolean not null default false
);

alter table public.ai_task_feedback enable row level security;

create policy "users can manage own task feedback"
  on public.ai_task_feedback
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admins can read all task feedback"
  on public.ai_task_feedback
  for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create index ai_task_feedback_project_signal_idx
  on public.ai_task_feedback (project_id, signal, created_at desc);

create index ai_task_feedback_promoted_idx
  on public.ai_task_feedback (project_id, promoted, signal)
  where promoted = true and signal = 'good';
