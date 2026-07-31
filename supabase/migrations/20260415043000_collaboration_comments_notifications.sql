-- Supabase-native collaboration replacement for Liveblocks comments + notifications.
-- Includes explicit indexes, RLS, and realtime publication to avoid silent failures.

create table if not exists public.collaboration_comments (
  id uuid primary key default gen_random_uuid(),
  project_id integer null references public.projects(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  parent_comment_id uuid null references public.collaboration_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  author_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint collaboration_comments_entity_key_chk check (char_length(trim(entity_type)) > 0 and char_length(trim(entity_id)) > 0)
);
comment on table public.collaboration_comments is 'Supabase-backed comments replacing Liveblocks threads for entity-scoped collaboration.';
create index if not exists collaboration_comments_entity_created_idx
  on public.collaboration_comments (entity_type, entity_id, created_at desc)
  where deleted_at is null;
create index if not exists collaboration_comments_project_created_idx
  on public.collaboration_comments (project_id, created_at desc)
  where deleted_at is null;
create index if not exists collaboration_comments_parent_idx
  on public.collaboration_comments (parent_comment_id, created_at asc)
  where deleted_at is null;
create index if not exists collaboration_comments_author_idx
  on public.collaboration_comments (author_id, created_at desc);
create table if not exists public.collaboration_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id integer null references public.projects(id) on delete cascade,
  entity_type text null,
  entity_id text null,
  comment_id uuid null references public.collaboration_comments(id) on delete set null,
  actor_id uuid null,
  kind text not null default 'comment',
  title text not null,
  body text null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint collaboration_notifications_kind_chk check (char_length(trim(kind)) > 0),
  constraint collaboration_notifications_title_chk check (char_length(trim(title)) > 0)
);
comment on table public.collaboration_notifications is 'In-app notifications replacing Liveblocks inbox notifications.';
create index if not exists collaboration_notifications_user_created_idx
  on public.collaboration_notifications (user_id, created_at desc)
  where deleted_at is null;
create index if not exists collaboration_notifications_user_unread_idx
  on public.collaboration_notifications (user_id, created_at desc)
  where deleted_at is null and read_at is null;
create index if not exists collaboration_notifications_project_created_idx
  on public.collaboration_notifications (project_id, created_at desc)
  where deleted_at is null;
alter table public.collaboration_comments enable row level security;
alter table public.collaboration_notifications enable row level security;
-- Comments policies: authenticated users can read and create; only authors can update/delete.
drop policy if exists "collaboration_comments_select_authenticated" on public.collaboration_comments;
create policy "collaboration_comments_select_authenticated"
  on public.collaboration_comments
  for select
  to authenticated
  using (deleted_at is null);
drop policy if exists "collaboration_comments_insert_authenticated" on public.collaboration_comments;
create policy "collaboration_comments_insert_authenticated"
  on public.collaboration_comments
  for insert
  to authenticated
  with check (auth.uid() = author_id);
drop policy if exists "collaboration_comments_update_author" on public.collaboration_comments;
create policy "collaboration_comments_update_author"
  on public.collaboration_comments
  for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
-- Notifications policies: only owner can see and mutate their notifications.
drop policy if exists "collaboration_notifications_select_owner" on public.collaboration_notifications;
create policy "collaboration_notifications_select_owner"
  on public.collaboration_notifications
  for select
  to authenticated
  using (auth.uid() = user_id and deleted_at is null);
drop policy if exists "collaboration_notifications_update_owner" on public.collaboration_notifications;
create policy "collaboration_notifications_update_owner"
  on public.collaboration_notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- Ensure updates maintain accurate timestamps.
create or replace function public.set_collaboration_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_collaboration_comments_updated_at on public.collaboration_comments;
create trigger trg_collaboration_comments_updated_at
before update on public.collaboration_comments
for each row
execute function public.set_collaboration_updated_at();
-- Realtime publication for client subscriptions (idempotent).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'collaboration_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.collaboration_comments';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'collaboration_notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.collaboration_notifications';
  end if;
end;
$$;
