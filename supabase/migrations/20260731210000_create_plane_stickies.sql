-- Portions adapted from Plane v1.3.1 TSticky and Stickies services.
-- Copyright (c) 2023-present Plane Software, Inc. and contributors
-- SPDX-License-Identifier: AGPL-3.0-only
--
-- This migration is intentionally unapplied pending explicit production
-- approval. See LICENSES/NOTICE-PLANE-STICKIES.md.

begin;

create table if not exists public.plane_stickies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_key text not null,
  scope text not null default 'workspace',
  project_id bigint references public.projects(id) on delete cascade,
  content text not null default '',
  background_color text not null default 'gray',
  sort_order double precision not null default 65535,
  is_pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plane_stickies_workspace_key_check
    check (workspace_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint plane_stickies_scope_check
    check (scope in ('personal', 'workspace', 'project')),
  constraint plane_stickies_project_scope_check
    check (
      (scope = 'project' and project_id is not null)
      or (scope <> 'project' and project_id is null)
    ),
  constraint plane_stickies_content_length_check
    check (char_length(content) <= 10000),
  constraint plane_stickies_background_color_check
    check (
      background_color in (
        'gray',
        'peach',
        'pink',
        'orange',
        'green',
        'light-blue',
        'dark-blue',
        'purple'
      )
    )
);

create index if not exists plane_stickies_owner_scope_active_order_idx
  on public.plane_stickies (
    owner_id,
    workspace_key,
    scope,
    project_id,
    is_pinned desc,
    sort_order,
    updated_at desc,
    id
  )
  where archived_at is null;

create index if not exists plane_stickies_owner_scope_archived_idx
  on public.plane_stickies (
    owner_id,
    workspace_key,
    scope,
    project_id,
    archived_at desc,
    id
  )
  where archived_at is not null;

create or replace function public.plane_stickies_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists plane_stickies_set_updated_at
  on public.plane_stickies;
create trigger plane_stickies_set_updated_at
before update on public.plane_stickies
for each row execute function public.plane_stickies_set_updated_at();

revoke all on function public.plane_stickies_set_updated_at()
  from public, anon, authenticated;

alter table public.plane_stickies enable row level security;
alter table public.plane_stickies force row level security;

drop policy if exists plane_stickies_select_own
  on public.plane_stickies;
create policy plane_stickies_select_own
on public.plane_stickies
for select
to authenticated
using (
  owner_id = (select auth.uid())
  and (
    scope <> 'project'
    or public.current_is_app_admin()
    or public.current_has_project_access(project_id)
  )
);

drop policy if exists plane_stickies_insert_own
  on public.plane_stickies;
create policy plane_stickies_insert_own
on public.plane_stickies
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    scope <> 'project'
    or public.current_is_app_admin()
    or public.current_has_project_module_permission(
      project_id,
      'documents',
      'write'
    )
  )
);

drop policy if exists plane_stickies_update_own
  on public.plane_stickies;
create policy plane_stickies_update_own
on public.plane_stickies
for update
to authenticated
using (
  owner_id = (select auth.uid())
  and (
    scope <> 'project'
    or public.current_is_app_admin()
    or public.current_has_project_module_permission(
      project_id,
      'documents',
      'write'
    )
  )
)
with check (
  owner_id = (select auth.uid())
  and (
    scope <> 'project'
    or public.current_is_app_admin()
    or public.current_has_project_module_permission(
      project_id,
      'documents',
      'write'
    )
  )
);

drop policy if exists plane_stickies_delete_own
  on public.plane_stickies;
create policy plane_stickies_delete_own
on public.plane_stickies
for delete
to authenticated
using (
  owner_id = (select auth.uid())
  and (
    scope <> 'project'
    or public.current_is_app_admin()
    or public.current_has_project_module_permission(
      project_id,
      'documents',
      'write'
    )
  )
);

revoke all on table public.plane_stickies from public;
revoke all on table public.plane_stickies from anon;
grant select, insert, update, delete
  on table public.plane_stickies
  to authenticated;
grant all on table public.plane_stickies to service_role;

comment on table public.plane_stickies is
  'Plane-compatible private stickies, owned by one authenticated user and organized into personal, workspace, or project scopes.';

commit;

-- Controlled rollback (run only after confirming there are no consumers):
-- begin;
-- drop policy if exists plane_stickies_delete_own on public.plane_stickies;
-- drop policy if exists plane_stickies_update_own on public.plane_stickies;
-- drop policy if exists plane_stickies_insert_own on public.plane_stickies;
-- drop policy if exists plane_stickies_select_own on public.plane_stickies;
-- drop trigger if exists plane_stickies_set_updated_at on public.plane_stickies;
-- drop function if exists public.plane_stickies_set_updated_at();
-- drop table if exists public.plane_stickies;
-- commit;
