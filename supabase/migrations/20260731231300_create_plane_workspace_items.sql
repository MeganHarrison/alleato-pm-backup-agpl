-- Portions adapted from Plane v1.3.1 UserFavorite.
-- Copyright (c) 2023-present Plane Software, Inc. and contributors
-- SPDX-License-Identifier: AGPL-3.0-only
--
-- This migration is intentionally unapplied until the Plane release batch
-- receives explicit production approval.

create table if not exists public.user_workspace_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_key text not null,
  project_id bigint references public.projects(id) on delete cascade,
  item_kind text not null,
  entity_type text not null,
  entity_identifier text not null,
  name text not null,
  href text not null,
  sort_order double precision not null default 65535,
  metadata jsonb not null default '{}'::jsonb,
  last_accessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_workspace_items_workspace_key_check
    check (
      workspace_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'
    ),
  constraint user_workspace_items_item_kind_check
    check (item_kind in ('favorite', 'recent')),
  constraint user_workspace_items_entity_type_check
    check (
      entity_type ~ '^[a-z][a-z0-9_-]{0,63}$'
    ),
  constraint user_workspace_items_entity_identifier_check
    check (
      length(btrim(entity_identifier)) between 1 and 255
    ),
  constraint user_workspace_items_name_check
    check (
      length(btrim(name)) between 1 and 255
    ),
  constraint user_workspace_items_href_check
    check (
      length(href) between 1 and 2048
      and href like '/%'
      and href not like '//%'
      and position(E'\\' in href) = 0
      and href !~ '[[:cntrl:]]'
    ),
  constraint user_workspace_items_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint user_workspace_items_project_scope_check
    check (
      entity_type not in (
        'project',
        'work_item',
        'cycle',
        'module',
        'view',
        'page',
        'intake',
        'submittal',
        'rfi',
        'change_event',
        'commitment',
        'prime_contract'
      )
      or project_id is not null
    ),
  constraint user_workspace_items_unique_entity
    unique (
      user_id,
      workspace_key,
      item_kind,
      entity_type,
      entity_identifier
    )
);

comment on table public.user_workspace_items is
  'Per-user Plane-derived favorites and recent navigation items, scoped to an Alleato workspace and optional project.';

create index if not exists user_workspace_items_favorites_order_idx
  on public.user_workspace_items (
    user_id,
    workspace_key,
    sort_order asc,
    created_at desc,
    id asc
  )
  where item_kind = 'favorite';

create index if not exists user_workspace_items_recents_order_idx
  on public.user_workspace_items (
    user_id,
    workspace_key,
    last_accessed_at desc,
    id asc
  )
  where item_kind = 'recent';

create index if not exists user_workspace_items_project_idx
  on public.user_workspace_items (project_id)
  where project_id is not null;

create or replace function public.guard_user_workspace_item_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.workspace_key is distinct from old.workspace_key
    or new.project_id is distinct from old.project_id
    or new.item_kind is distinct from old.item_kind
    or new.entity_type is distinct from old.entity_type
    or new.entity_identifier is distinct from old.entity_identifier
  ) then
    raise exception 'user_workspace_items ownership and entity scope are immutable'
      using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_user_workspace_item_scope() from public;
revoke all on function public.guard_user_workspace_item_scope() from anon;
revoke all on function public.guard_user_workspace_item_scope() from authenticated;

drop trigger if exists user_workspace_items_scope_guard
  on public.user_workspace_items;

create trigger user_workspace_items_scope_guard
before update on public.user_workspace_items
for each row
execute function public.guard_user_workspace_item_scope();

alter table public.user_workspace_items enable row level security;
alter table public.user_workspace_items force row level security;

create or replace function public.current_has_plane_workspace_entity_access(
  p_project_id bigint,
  p_entity_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_module text;
begin
  if p_project_id is null or p_entity_type is null then
    return false;
  end if;

  v_module := case p_entity_type
    when 'work_item' then 'schedule'
    when 'cycle' then 'schedule'
    when 'module' then 'schedule'
    when 'intake' then 'schedule'
    when 'submittal' then 'submittals'
    when 'rfi' then 'rfis'
    when 'change_event' then 'change_events'
    when 'commitment' then 'commitments'
    when 'prime_contract' then 'contracts'
    else null
  end;

  if v_module is not null then
    return public.current_has_project_module_permission(
      p_project_id,
      v_module,
      'read'
    );
  end if;

  return public.current_has_project_access(p_project_id);
end;
$$;

revoke all
  on function public.current_has_plane_workspace_entity_access(bigint, text)
  from public;
revoke all
  on function public.current_has_plane_workspace_entity_access(bigint, text)
  from anon;
grant execute
  on function public.current_has_plane_workspace_entity_access(bigint, text)
  to authenticated, service_role;

drop policy if exists user_workspace_items_select_own
  on public.user_workspace_items;
create policy user_workspace_items_select_own
on public.user_workspace_items
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (
    project_id is null
    or public.current_has_plane_workspace_entity_access(
      project_id,
      entity_type
    )
  )
);

drop policy if exists user_workspace_items_insert_own
  on public.user_workspace_items;
create policy user_workspace_items_insert_own
on public.user_workspace_items
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    project_id is null
    or public.current_has_plane_workspace_entity_access(
      project_id,
      entity_type
    )
  )
);

drop policy if exists user_workspace_items_update_own
  on public.user_workspace_items;
create policy user_workspace_items_update_own
on public.user_workspace_items
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (
    project_id is null
    or public.current_has_plane_workspace_entity_access(
      project_id,
      entity_type
    )
  )
)
with check (
  user_id = (select auth.uid())
  and (
    project_id is null
    or public.current_has_plane_workspace_entity_access(
      project_id,
      entity_type
    )
  )
);

drop policy if exists user_workspace_items_delete_own
  on public.user_workspace_items;
create policy user_workspace_items_delete_own
on public.user_workspace_items
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (
    project_id is null
    or public.current_has_plane_workspace_entity_access(
      project_id,
      entity_type
    )
  )
);

revoke all on table public.user_workspace_items from public;
revoke all on table public.user_workspace_items from anon;
grant select, insert, update, delete
  on table public.user_workspace_items
  to authenticated;
grant all
  on table public.user_workspace_items
  to service_role;
