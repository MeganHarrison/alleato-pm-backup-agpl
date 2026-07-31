-- Per-user saved table views (named presets of column visibility, order, sort, filters).
--
-- Backs the "Saved views" feature in UnifiedTablePage so testers / PMs can pick
-- between presets like "Quick view" and "Full detail" instead of re-toggling
-- columns every session. Storage is per-user (RLS on user_id = auth.uid()) so
-- selections sync across browsers and devices.
--
-- scope_key is the abstract table identifier (e.g. "meetings", "commitments")
-- and is intentionally project-agnostic — a view created on project A's meetings
-- page applies on project B's meetings page too. URL state (page, search) is
-- still owned by useUnifiedTableState; saved views only restore presentation.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.user_table_views (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  -- Stable identifier for the table this view belongs to. Project-agnostic.
  -- e.g. "meetings", "commitments", "rfis", "submittals".
  scope_key text not null,

  name text not null,

  -- When true, this view is auto-applied when the user lands on a page with
  -- this scope_key (and no explicit ?view= override in the URL).
  -- Only one default per (user_id, scope_key) — enforced by partial unique index.
  is_default boolean not null default false,

  -- Presentation state captured by the view. All optional — a view that only
  -- captures visible_columns leaves the rest of the table state untouched.
  visible_columns jsonb,        -- ["title", "date", "project", ...]
  column_order jsonb,           -- ["title", "date", ...] (subset/superset of visible)
  sort_by text,
  sort_direction text check (sort_direction in ('asc', 'desc')),
  filters jsonb,                -- { datePreset: "this_month", type: "weekly", ... }

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_table_views_name_not_blank check (length(trim(name)) > 0),
  constraint user_table_views_unique_name_per_scope
    unique (user_id, scope_key, name)
);

create index if not exists idx_user_table_views_user_scope
  on public.user_table_views(user_id, scope_key);

-- Enforce one default per (user_id, scope_key).
create unique index if not exists idx_user_table_views_one_default_per_scope
  on public.user_table_views(user_id, scope_key)
  where is_default;

drop trigger if exists user_table_views_set_updated_at on public.user_table_views;
create trigger user_table_views_set_updated_at
  before update on public.user_table_views
  for each row execute function public.set_updated_at();

alter table public.user_table_views enable row level security;

-- Users can read their own views.
drop policy if exists user_table_views_select_own on public.user_table_views;
create policy user_table_views_select_own
  on public.user_table_views
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Users can insert views that belong to themselves.
drop policy if exists user_table_views_insert_own on public.user_table_views;
create policy user_table_views_insert_own
  on public.user_table_views
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Users can update their own views.
drop policy if exists user_table_views_update_own on public.user_table_views;
create policy user_table_views_update_own
  on public.user_table_views
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Users can delete their own views.
drop policy if exists user_table_views_delete_own on public.user_table_views;
create policy user_table_views_delete_own
  on public.user_table_views
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Service role can do anything (admin / migrations / tests).
drop policy if exists user_table_views_service_role on public.user_table_views;
create policy user_table_views_service_role
  on public.user_table_views
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.user_table_views to authenticated;
grant all on public.user_table_views to service_role;

comment on table public.user_table_views is
  'Per-user named presets of column visibility, order, sort, and filters for '
  'UnifiedTablePage. scope_key is project-agnostic (e.g. "meetings"). RLS-scoped '
  'so users only see their own views.';

comment on column public.user_table_views.scope_key is
  'Stable abstract identifier for the table — project-agnostic. e.g. "meetings", '
  '"commitments". Set by the page calling UnifiedTablePage via savedViewsScope.';

comment on column public.user_table_views.is_default is
  'When true, this view is auto-applied on page load. At most one default per '
  '(user_id, scope_key) enforced via partial unique index.';

commit;
