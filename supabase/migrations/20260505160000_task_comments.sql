-- Task comments: thread of comments attached to a task
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_created_at_idx
  on public.task_comments (task_id, created_at);

create index if not exists task_comments_author_id_idx
  on public.task_comments (author_id);

alter table public.task_comments enable row level security;

drop policy if exists "task_comments_select_authenticated" on public.task_comments;
create policy "task_comments_select_authenticated"
  on public.task_comments for select
  to authenticated
  using (true);

drop policy if exists "task_comments_insert_own" on public.task_comments;
create policy "task_comments_insert_own"
  on public.task_comments for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "task_comments_update_own" on public.task_comments;
create policy "task_comments_update_own"
  on public.task_comments for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "task_comments_delete_own" on public.task_comments;
create policy "task_comments_delete_own"
  on public.task_comments for delete
  to authenticated
  using (author_id = auth.uid());

-- updated_at trigger
create or replace function public.set_task_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_task_comments_updated_at on public.task_comments;
create trigger trg_task_comments_updated_at
  before update on public.task_comments
  for each row execute function public.set_task_comments_updated_at();
