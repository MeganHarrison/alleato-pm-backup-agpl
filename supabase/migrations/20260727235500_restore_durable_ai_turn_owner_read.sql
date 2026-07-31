alter table public.durable_ai_turns enable row level security;

drop policy if exists "Users can view their own durable AI turns"
  on public.durable_ai_turns;
create policy "Users can view their own durable AI turns"
  on public.durable_ai_turns
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all privileges
  on table public.durable_ai_turns
  from public, anon, authenticated;
grant select
  on table public.durable_ai_turns
  to authenticated;

notify pgrst, 'reload schema';
