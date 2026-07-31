create table if not exists estimate_sublist_scope_items (
  id            serial primary key,
  estimate_id   integer not null references estimates(estimate_id) on delete cascade,
  division_code text not null,
  sort_order    integer not null default 0,
  description   text not null,
  notes         text,
  is_checked    boolean not null default true,
  source        text check (source in ('estimate_line_item', 'manual')) default 'manual',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_estimate_sublist_scope_items_estimate_div
  on estimate_sublist_scope_items (estimate_id, division_code);

alter table estimate_sublist_scope_items enable row level security;

create policy "Authenticated users can manage scope items"
  on estimate_sublist_scope_items for all
  to authenticated
  using (true)
  with check (true);
