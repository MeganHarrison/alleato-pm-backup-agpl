-- Team chat messages table for persistent channel-based chat
create table public.team_chat_messages (
  id          uuid        primary key default gen_random_uuid(),
  channel_id  text        not null,
  user_id     uuid        references auth.users(id) on delete set null,
  user_name   text        not null,
  content     text        not null,
  created_at  timestamptz not null default now()
);
-- Index for efficient channel history queries
create index team_chat_messages_channel_created_idx
  on public.team_chat_messages(channel_id, created_at asc);
-- RLS
alter table public.team_chat_messages enable row level security;
-- Authenticated users can read all messages
create policy "authenticated users can read team chat messages"
  on public.team_chat_messages
  for select
  to authenticated
  using (true);
-- Authenticated users can insert their own messages
create policy "authenticated users can insert team chat messages"
  on public.team_chat_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);
