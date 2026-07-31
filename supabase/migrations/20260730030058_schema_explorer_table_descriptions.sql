-- Durable, admin-managed annotations for live Database Inventory tables.
-- This table is only accessed by the server-side Admin Dashboard route.

create table public.schema_explorer_table_descriptions (
  database_key text not null check (database_key in ('PM_APP', 'RAG')),
  table_name text not null check (table_name ~ '^[a-z][a-z0-9_]*$'),
  description text not null check (
    char_length(btrim(description)) between 1 and 2000
  ),
  updated_at timestamptz not null default now(),
  primary key (database_key, table_name)
);

alter table public.schema_explorer_table_descriptions enable row level security;

-- The browser has no direct route to this metadata. The server-side service
-- client is authorized only after the Admin Dashboard access check succeeds.
revoke all on table public.schema_explorer_table_descriptions from public;
revoke all on table public.schema_explorer_table_descriptions from anon;
revoke all on table public.schema_explorer_table_descriptions from authenticated;
grant select, insert, update, delete on table public.schema_explorer_table_descriptions to service_role;
