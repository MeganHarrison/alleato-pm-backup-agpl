-- Team chat channels table and channel/message integrity constraints
create table if not exists public.team_chat_channels (
  id          text primary key,
  name        text not null unique,
  topic       text not null default 'Team discussion',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
-- Ensure there is always at least one default channel available.
insert into public.team_chat_channels (id, name, topic)
values ('general', 'General', 'Company-wide conversation')
on conflict (id) do nothing;
-- Backfill channels from existing message history.
insert into public.team_chat_channels (id, name, topic)
select distinct
  m.channel_id,
  initcap(replace(m.channel_id, '-', ' ')) as name,
  'Team discussion' as topic
from public.team_chat_messages m
where m.channel_id is not null
  and m.channel_id <> ''
on conflict (id) do nothing;
-- Enforce message-to-channel referential integrity.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_chat_messages_channel_id_fkey'
  ) then
    alter table public.team_chat_messages
      add constraint team_chat_messages_channel_id_fkey
      foreign key (channel_id)
      references public.team_chat_channels(id)
      on delete cascade;
  end if;
end $$;
-- Helpful index for channel list ordering.
create index if not exists team_chat_channels_created_idx
  on public.team_chat_channels (created_at desc);
alter table public.team_chat_channels enable row level security;
-- Authenticated users can read channels.
create policy "authenticated users can read team chat channels"
  on public.team_chat_channels
  for select
  to authenticated
  using (true);
-- Admin users can create channels.
create policy "admins can create team chat channels"
  on public.team_chat_channels
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );
-- Admin users can delete channels.
create policy "admins can delete team chat channels"
  on public.team_chat_channels
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );
