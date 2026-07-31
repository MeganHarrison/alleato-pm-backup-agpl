create table if not exists estimate_sublist_call_logs (
  id          serial primary key,
  sub_id      integer not null references estimate_sublist_subs(id) on delete cascade,
  called_at   timestamptz not null default now(),
  outcome     text not null check (outcome in ('Reached', 'Voicemail', 'No Answer', 'Declined')),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_estimate_sublist_call_logs_sub_id
  on estimate_sublist_call_logs (sub_id);

alter table estimate_sublist_call_logs enable row level security;

create policy "Authenticated users can read call logs"
  on estimate_sublist_call_logs for select
  to authenticated
  using (true);

create policy "Authenticated users can insert call logs"
  on estimate_sublist_call_logs for insert
  to authenticated
  with check (true);

create policy "Authenticated users can delete call logs"
  on estimate_sublist_call_logs for delete
  to authenticated
  using (true);
