-- Ownership and review evidence stay separate from editorial descriptions so
-- assigning a steward never freezes an inferred description as user content.

create table public.schema_explorer_table_stewardship (
  database_key text not null check (database_key in ('PM_APP', 'RAG')),
  table_name text not null check (table_name ~ '^[a-z][a-z0-9_]*$'),
  owner_name text check (
    owner_name is null or char_length(btrim(owner_name)) between 1 and 160
  ),
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (database_key, table_name)
);

alter table public.schema_explorer_table_stewardship enable row level security;

revoke all on table public.schema_explorer_table_stewardship from public;
revoke all on table public.schema_explorer_table_stewardship from anon;
revoke all on table public.schema_explorer_table_stewardship from authenticated;
grant select, insert, update, delete on table public.schema_explorer_table_stewardship to service_role;
