create table if not exists estimate_sublist_bid_items (
  id            serial primary key,
  sub_id        integer not null references estimate_sublist_subs(id) on delete cascade,
  scope_item_id integer references estimate_sublist_scope_items(id) on delete set null,
  description   text not null,
  amount        numeric(15,2) not null default 0,
  is_excluded   boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_estimate_sublist_bid_items_sub_id
  on estimate_sublist_bid_items (sub_id);

alter table estimate_sublist_bid_items enable row level security;

create policy "Authenticated users can manage bid items"
  on estimate_sublist_bid_items for all
  to authenticated
  using (true)
  with check (true);
