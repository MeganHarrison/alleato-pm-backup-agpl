-- Initiative Cards — Command Center kanban board
create table if not exists public.initiative_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'idea' check (status in ('idea', 'planned', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  labels text[] default '{}',
  sort_order integer not null default 0,
  linked_record_type text,
  linked_record_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast board queries
create index idx_initiative_cards_status on public.initiative_cards(status, sort_order);

-- Auto-update updated_at
create or replace function public.handle_initiative_cards_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_initiative_cards_updated_at
  before update on public.initiative_cards
  for each row
  execute function public.handle_initiative_cards_updated_at();

-- RLS
alter table public.initiative_cards enable row level security;

create policy "Authenticated users can read initiative cards"
  on public.initiative_cards for select
  to authenticated
  using (true);

create policy "Authenticated users can insert initiative cards"
  on public.initiative_cards for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update initiative cards"
  on public.initiative_cards for update
  to authenticated
  using (true);

create policy "Authenticated users can delete initiative cards"
  on public.initiative_cards for delete
  to authenticated
  using (true);
