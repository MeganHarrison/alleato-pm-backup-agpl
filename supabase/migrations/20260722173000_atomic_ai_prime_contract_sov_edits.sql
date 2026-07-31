-- Atomic, concurrency-safe boundary for Alleato AI edits to an existing
-- draft Prime Contract Schedule of Values.
--
-- The application still enforces project and Contracts-module permissions.
-- This service-role-only RPC adds defense in depth for contract privacy and
-- keeps the contract lock, stale-preview check, row upserts, and total update
-- in one database transaction.

-- Preview tokens and idempotency receipts are authorization state. Browser
-- roles must not be able to read, forge, alter, or delete this ledger.
alter table public.ai_tool_write_audits enable row level security;

drop policy if exists compatibility_all_access
on public.ai_tool_write_audits;
drop policy if exists ai_tool_write_audits_service_role
on public.ai_tool_write_audits;

create policy ai_tool_write_audits_service_role
on public.ai_tool_write_audits
for all
to service_role
using (true)
with check (true);

revoke all on table public.ai_tool_write_audits from anon, authenticated;
grant select, insert, update on table public.ai_tool_write_audits to service_role;

-- Match the application permission hierarchy at the database boundary:
-- app admin > explicit project override > project template > company template.
-- A present override of "none" deliberately denies the template fallback.
create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.users_auth ua
  join public.people p on p.id = ua.person_id
  where ua.auth_user_id = (select auth.uid())
    and p.status = 'active'
  limit 1;
$$;

revoke all on function public.current_person_id() from public, anon;
grant execute on function public.current_person_id()
to authenticated, service_role;

create or replace function public.current_is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.users_auth ua on ua.auth_user_id = up.id
    join public.people p on p.id = ua.person_id
    where up.id = (select auth.uid())
      and up.is_admin = true
      and p.status = 'active'
  );
$$;

revoke all on function public.current_is_app_admin() from public, anon;
grant execute on function public.current_is_app_admin()
to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_is_app_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.current_has_project_module_permission(
  p_project_id bigint,
  p_module text,
  p_required_level text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_person_id uuid;
  v_level text;
  v_rules jsonb;
begin
  if p_project_id is null
    or p_module is null
    or p_required_level not in ('read', 'write', 'admin')
  then
    return false;
  end if;

  if public.current_is_app_admin() then
    return true;
  end if;

  v_person_id := public.current_person_id();
  if v_person_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.people p
    where p.id = v_person_id
      and p.status = 'active'
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.project_directory_memberships pdm
    where pdm.project_id = p_project_id
      and pdm.person_id = v_person_id
      and pdm.status = 'active'
  )
  and not exists (
    select 1
    from public.person_company_templates pct
    where pct.person_id = v_person_id
  )
  then
    return false;
  end if;

  select ump.level
  into v_level
  from public.user_module_permissions ump
  where ump.project_id = p_project_id
    and ump.person_id = v_person_id
    and ump.module = p_module
  limit 1;

  if found then
    return case p_required_level
      when 'read' then v_level in ('read', 'write', 'admin')
      when 'write' then v_level in ('write', 'admin')
      when 'admin' then v_level = 'admin'
      else false
    end;
  end if;

  select pt.rules_json -> p_module
  into v_rules
  from public.project_directory_memberships pdm
  join public.permission_templates pt
    on pt.id = pdm.permission_template_id
  where pdm.project_id = p_project_id
    and pdm.person_id = v_person_id
    and pdm.status = 'active'
  limit 1;

  if not found then
    select pt.rules_json -> p_module
    into v_rules
    from public.person_company_templates pct
    join public.permission_templates pt
      on pt.id = pct.template_id
    where pct.person_id = v_person_id
    limit 1;
  end if;

  return case p_required_level
    when 'read' then coalesce(v_rules ?| array['read', 'write', 'admin'], false)
    when 'write' then coalesce(v_rules ?| array['write', 'admin'], false)
    when 'admin' then coalesce(v_rules ? 'admin', false)
    else false
  end;
end;
$$;

revoke all on function public.current_has_project_module_permission(
  bigint, text, text
) from public, anon;
grant execute on function public.current_has_project_module_permission(
  bigint, text, text
) to authenticated, service_role;

create or replace function public.current_has_project_granular_permission(
  p_project_id bigint,
  p_flag text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_person_id uuid;
  v_effect text;
  v_flags text[];
begin
  if public.current_is_app_admin() then
    return true;
  end if;

  v_person_id := public.current_person_id();
  if v_person_id is null or p_flag is null then
    return false;
  end if;

  select case
    when bool_or(ugpo.effect = 'deny') then 'deny'
    when bool_or(ugpo.effect = 'allow') then 'allow'
    else null
  end
  into v_effect
  from public.user_granular_permission_overrides ugpo
  where ugpo.person_id = v_person_id
    and ugpo.flag = p_flag
    and (ugpo.project_id is null or ugpo.project_id = p_project_id);

  if v_effect = 'deny' then
    return false;
  elsif v_effect = 'allow' then
    return true;
  end if;

  select coalesce(pt.granular_flags, '{}'::text[])
  into v_flags
  from public.project_directory_memberships pdm
  join public.permission_templates pt
    on pt.id = pdm.permission_template_id
  where pdm.project_id = p_project_id
    and pdm.person_id = v_person_id
    and pdm.status = 'active'
  limit 1;

  if found then
    return p_flag = any(v_flags);
  end if;

  select coalesce(pt.granular_flags, '{}'::text[])
  into v_flags
  from public.person_company_templates pct
  join public.permission_templates pt on pt.id = pct.template_id
  where pct.person_id = v_person_id
  limit 1;

  return found and p_flag = any(v_flags);
end;
$$;

revoke all on function public.current_has_project_granular_permission(
  bigint, text
) from public, anon;
grant execute on function public.current_has_project_granular_permission(
  bigint, text
) to authenticated, service_role;

create or replace function public.current_can_assign_project_permission_template(
  p_project_id bigint,
  p_template_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope text;
begin
  if public.current_is_app_admin() then
    return true;
  end if;

  if not public.current_has_project_module_permission(
    p_project_id, 'directory', 'write'
  ) then
    return false;
  end if;

  if p_template_id is null then
    return true;
  end if;

  select pt.scope
  into v_scope
  from public.permission_templates pt
  where pt.id = p_template_id;

  if not found or v_scope <> 'project' then
    return false;
  end if;

  if exists (
    select 1
    from public.permission_templates pt
    cross join lateral jsonb_each(coalesce(pt.rules_json, '{}'::jsonb)) module_rule
    cross join lateral jsonb_array_elements_text(module_rule.value) required_level
    where pt.id = p_template_id
      and required_level.value <> 'none'
      and not public.current_has_project_module_permission(
        p_project_id, module_rule.key, required_level.value
      )
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.permission_templates pt
    cross join lateral unnest(
      coalesce(pt.granular_flags, '{}'::text[])
    ) target_flag(value)
    where pt.id = p_template_id
      and not public.current_has_project_granular_permission(
        p_project_id, target_flag.value
      )
  ) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.current_can_assign_project_permission_template(
  bigint, uuid
) from public, anon;
grant execute on function public.current_can_assign_project_permission_template(
  bigint, uuid
) to authenticated, service_role;

-- The authorization helper above must only trust server-governed identity and
-- assignment data. Remove legacy browser policies that allowed callers to
-- create their own identity link or project membership.
alter table public.users_auth enable row level security;

drop policy if exists "Allow authenticated users to read users_auth"
on public.users_auth;
drop policy if exists authenticated_read_users_auth on public.users_auth;
drop policy if exists authenticated_insert_users_auth on public.users_auth;
drop policy if exists users_auth_select_authenticated on public.users_auth;
drop policy if exists users_auth_insert_verified_self on public.users_auth;

create policy users_auth_select_authenticated on public.users_auth
for select to authenticated
using (true);

revoke all on table public.users_auth from anon, authenticated;
grant select on table public.users_auth to authenticated;

alter table public.project_directory_memberships enable row level security;

drop policy if exists authenticated_read_pdm
on public.project_directory_memberships;
drop policy if exists authenticated_insert_pdm
on public.project_directory_memberships;
drop policy if exists authenticated_update_pdm
on public.project_directory_memberships;
drop policy if exists project_directory_memberships_select
on public.project_directory_memberships;
drop policy if exists project_directory_memberships_insert
on public.project_directory_memberships;
drop policy if exists project_directory_memberships_update
on public.project_directory_memberships;
drop policy if exists project_directory_memberships_delete
on public.project_directory_memberships;

create policy project_directory_memberships_select
on public.project_directory_memberships
for select to authenticated
using (
  public.current_is_app_admin()
  or person_id = public.current_person_id()
  or public.current_has_project_module_permission(
    project_id, 'directory', 'read'
  )
);

create policy project_directory_memberships_insert
on public.project_directory_memberships
for insert to authenticated
with check (
  public.current_is_app_admin()
  or (
    person_id <> public.current_person_id()
    and (
      permission_template_id is not null
      or not exists (
        select 1
        from public.person_company_templates target_company_template
        where target_company_template.person_id = person_id
      )
    )
    and public.current_can_assign_project_permission_template(
      project_id, permission_template_id
    )
  )
);

create policy project_directory_memberships_update
on public.project_directory_memberships
for update to authenticated
using (
  public.current_is_app_admin()
  or (
    person_id <> public.current_person_id()
    and public.current_has_project_module_permission(
      project_id, 'directory', 'write'
    )
  )
)
with check (
  public.current_is_app_admin()
  or (
    person_id <> public.current_person_id()
    and public.current_can_assign_project_permission_template(
      project_id, permission_template_id
    )
  )
);

create policy project_directory_memberships_delete
on public.project_directory_memberships
for delete to authenticated
using (
  public.current_is_app_admin()
  or (
    person_id <> public.current_person_id()
    and public.current_has_project_module_permission(
      project_id, 'directory', 'write'
    )
  )
);

revoke all on table public.project_directory_memberships
from anon, authenticated;
grant select, insert, update, delete
on table public.project_directory_memberships to authenticated;

create or replace function public.prevent_project_membership_identity_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_is_app_admin()
    and (
      new.id is distinct from old.id
      or new.project_id is distinct from old.project_id
      or new.person_id is distinct from old.person_id
      or (
        old.permission_template_id is not null
        and new.permission_template_id is null
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'PROJECT_MEMBERSHIP_IDENTITY_OR_TEMPLATE_INVALID';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_project_membership_identity_reassignment()
from public, anon, authenticated;

drop trigger if exists project_membership_identity_reassignment_guard
on public.project_directory_memberships;

create trigger project_membership_identity_reassignment_guard
before update on public.project_directory_memberships
for each row execute function public.prevent_project_membership_identity_reassignment();

-- people.status is part of the trusted identity boundary above. Remove legacy
-- allow-all browser policies so an inactive account cannot reactivate itself,
-- and scope directory edits to projects the actor can actually manage.
alter table public.people enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'people'
  loop
    execute format('drop policy %I on public.people', v_policy.policyname);
  end loop;
end;
$$;

create policy people_select_authenticated
on public.people
for select to authenticated
using (true);

create policy people_insert_governed
on public.people
for insert to authenticated
with check (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.project_directory_memberships actor_membership
    where actor_membership.person_id = public.current_person_id()
      and actor_membership.status = 'active'
      and public.current_has_project_module_permission(
        actor_membership.project_id, 'directory', 'write'
      )
  )
);

create policy people_update_governed
on public.people
for update to authenticated
using (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.project_directory_memberships target_membership
    where target_membership.person_id = people.id
      and public.current_has_project_module_permission(
        target_membership.project_id, 'directory', 'write'
      )
  )
)
with check (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.project_directory_memberships target_membership
    where target_membership.person_id = people.id
      and public.current_has_project_module_permission(
        target_membership.project_id, 'directory', 'write'
      )
  )
);

create policy people_service_role
on public.people
for all to service_role
using (true)
with check (true);

revoke all on table public.people from anon, authenticated;
grant select, insert, update on table public.people to authenticated;

create or replace function public.prevent_untrusted_people_identity_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
    and not public.current_is_app_admin()
    and (
      new.id is distinct from old.id
      or new.auth_user_id is distinct from old.auth_user_id
      or new.status is distinct from old.status
      or new.person_type is distinct from old.person_type
    )
  then
    raise exception using
      errcode = '42501',
      message = 'PEOPLE_IDENTITY_FIELDS_REQUIRE_APP_ADMIN';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_untrusted_people_identity_update()
from public, anon, authenticated;

drop trigger if exists people_identity_update_guard on public.people;
create trigger people_identity_update_guard
before update on public.people
for each row execute function public.prevent_untrusted_people_identity_update();

-- Company templates are another input to project access. Users may read their
-- own assignment and app admins may manage assignments, but browser roles can
-- no longer grant company-wide access to themselves.
alter table public.person_company_templates enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'person_company_templates'
  loop
    execute format(
      'drop policy %I on public.person_company_templates',
      v_policy.policyname
    );
  end loop;
end;
$$;

drop policy if exists person_company_templates_select
on public.person_company_templates;
drop policy if exists person_company_templates_insert
on public.person_company_templates;
drop policy if exists person_company_templates_update
on public.person_company_templates;
drop policy if exists person_company_templates_delete
on public.person_company_templates;

create policy person_company_templates_select
on public.person_company_templates
for select to authenticated
using (
  public.current_is_app_admin()
  or person_id = public.current_person_id()
);

create policy person_company_templates_insert
on public.person_company_templates
for insert to authenticated
with check (public.current_is_app_admin());

create policy person_company_templates_update
on public.person_company_templates
for update to authenticated
using (public.current_is_app_admin())
with check (public.current_is_app_admin());

create policy person_company_templates_delete
on public.person_company_templates
for delete to authenticated
using (public.current_is_app_admin());

create policy person_company_templates_service_role
on public.person_company_templates
for all to service_role
using (true)
with check (true);

revoke all on table public.person_company_templates from anon, authenticated;
grant select, insert, update, delete
on table public.person_company_templates to authenticated;

-- RLS does not govern TRUNCATE. Replace legacy ALL grants on the remaining
-- permission sources with the minimum operations their policies support.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'permission_templates',
        'user_module_permissions',
        'user_granular_permission_overrides'
      )
  loop
    execute format(
      'drop policy %I on public.%I',
      v_policy.policyname,
      v_policy.tablename
    );
  end loop;
end;
$$;

create policy permission_templates_select
on public.permission_templates
for select to authenticated
using (true);

create policy permission_templates_insert
on public.permission_templates
for insert to authenticated
with check (public.current_is_app_admin());

create policy permission_templates_update
on public.permission_templates
for update to authenticated
using (public.current_is_app_admin())
with check (public.current_is_app_admin());

create policy permission_templates_delete
on public.permission_templates
for delete to authenticated
using (public.current_is_app_admin() and not coalesce(is_system, false));

create policy permission_templates_service_role
on public.permission_templates
for all to service_role
using (true)
with check (true);

revoke all on table public.permission_templates from anon, authenticated;
grant select, insert, update, delete
on table public.permission_templates to authenticated;

create policy user_module_permissions_select
on public.user_module_permissions
for select to authenticated
using (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.project_directory_memberships pdm
    where pdm.project_id = user_module_permissions.project_id
      and pdm.person_id = public.current_person_id()
      and pdm.status = 'active'
  )
);

create policy user_module_permissions_write
on public.user_module_permissions
for all to authenticated
using (public.current_is_app_admin())
with check (public.current_is_app_admin());

create policy user_module_permissions_service_role
on public.user_module_permissions
for all to service_role
using (true)
with check (true);

revoke all on table public.user_module_permissions from anon, authenticated;
grant select, insert, update, delete
on table public.user_module_permissions to authenticated;

create policy user_granular_permission_overrides_select
on public.user_granular_permission_overrides
for select to authenticated
using (
  public.current_is_app_admin()
  or person_id = public.current_person_id()
  or (
    project_id is not null
    and exists (
      select 1
      from public.project_directory_memberships pdm
      where pdm.project_id = user_granular_permission_overrides.project_id
        and pdm.person_id = public.current_person_id()
        and pdm.status = 'active'
    )
  )
);

create policy user_granular_permission_overrides_write
on public.user_granular_permission_overrides
for all to authenticated
using (public.current_is_app_admin())
with check (public.current_is_app_admin());

create policy user_granular_permission_overrides_service_role
on public.user_granular_permission_overrides
for all to service_role
using (true)
with check (true);

revoke all on table public.user_granular_permission_overrides
from anon, authenticated;
grant select, insert, update, delete
on table public.user_granular_permission_overrides to authenticated;

-- Prime Contracts contain financial data. Project membership alone is not
-- sufficient: callers also need Contracts module access, and private records
-- are limited to app admins, the creator, and explicitly allowed users.
alter table public.prime_contracts enable row level security;

drop policy if exists prime_contracts_select on public.prime_contracts;
drop policy if exists prime_contracts_insert on public.prime_contracts;
drop policy if exists prime_contracts_update on public.prime_contracts;
drop policy if exists prime_contracts_delete on public.prime_contracts;

create policy prime_contracts_select on public.prime_contracts
for select to authenticated
using (
  public.current_has_project_module_permission(project_id, 'contracts', 'read')
  and (
    not is_private
    or public.current_is_app_admin()
    or created_by = (select auth.uid())
    or (select auth.uid()) = any(coalesce(allowed_user_ids, '{}'::uuid[]))
  )
);

create policy prime_contracts_insert on public.prime_contracts
for insert to authenticated
with check (
  public.current_has_project_module_permission(project_id, 'contracts', 'write')
  and (
    not is_private
    or public.current_is_app_admin()
    or created_by = (select auth.uid())
    or (select auth.uid()) = any(coalesce(allowed_user_ids, '{}'::uuid[]))
  )
);

create policy prime_contracts_update on public.prime_contracts
for update to authenticated
using (
  public.current_has_project_module_permission(project_id, 'contracts', 'write')
  and (
    not is_private
    or public.current_is_app_admin()
    or created_by = (select auth.uid())
    or (select auth.uid()) = any(coalesce(allowed_user_ids, '{}'::uuid[]))
  )
)
with check (
  public.current_has_project_module_permission(project_id, 'contracts', 'write')
  and (
    not is_private
    or public.current_is_app_admin()
    or created_by = (select auth.uid())
    or (select auth.uid()) = any(coalesce(allowed_user_ids, '{}'::uuid[]))
  )
);

create policy prime_contracts_delete on public.prime_contracts
for delete to authenticated
using (
  public.current_has_project_module_permission(project_id, 'contracts', 'admin')
  and (
    not is_private
    or public.current_is_app_admin()
    or created_by = (select auth.uid())
    or (select auth.uid()) = any(coalesce(allowed_user_ids, '{}'::uuid[]))
  )
);

revoke all on table public.prime_contracts from anon, authenticated;
grant select, insert, update, delete on table public.prime_contracts
to authenticated;

-- Child SOV rows inherit both project/module access and privacy from their
-- parent contract. Authenticated callers retain the existing CRUD surface,
-- but RLS now prevents read-only users and unauthorized private-contract users
-- from bypassing the guarded API routes through PostgREST.
alter table public.contract_line_items enable row level security;

drop policy if exists contract_line_items_select on public.contract_line_items;
drop policy if exists contract_line_items_insert on public.contract_line_items;
drop policy if exists contract_line_items_update on public.contract_line_items;
drop policy if exists contract_line_items_delete on public.contract_line_items;

create policy contract_line_items_select on public.contract_line_items
for select to authenticated
using (
  exists (
    select 1
    from public.prime_contracts pc
    where pc.id = contract_line_items.contract_id
      and public.current_has_project_module_permission(
        pc.project_id, 'contracts', 'read'
      )
  )
);

create policy contract_line_items_insert on public.contract_line_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.prime_contracts pc
    where pc.id = contract_line_items.contract_id
      and public.current_has_project_module_permission(
        pc.project_id, 'contracts', 'write'
      )
  )
);

create policy contract_line_items_update on public.contract_line_items
for update to authenticated
using (
  exists (
    select 1
    from public.prime_contracts pc
    where pc.id = contract_line_items.contract_id
      and public.current_has_project_module_permission(
        pc.project_id, 'contracts', 'write'
      )
  )
)
with check (
  exists (
    select 1
    from public.prime_contracts pc
    where pc.id = contract_line_items.contract_id
      and public.current_has_project_module_permission(
        pc.project_id, 'contracts', 'write'
      )
  )
);

create policy contract_line_items_delete on public.contract_line_items
for delete to authenticated
using (
  exists (
    select 1
    from public.prime_contracts pc
    where pc.id = contract_line_items.contract_id
      and public.current_has_project_module_permission(
        pc.project_id, 'contracts', 'admin'
      )
  )
);

revoke all on table public.contract_line_items from anon, authenticated;
grant select, insert, update, delete on table public.contract_line_items
to authenticated;

-- All SOV writers, including the existing manual line-item routes, must share
-- the parent-contract lock used by the AI RPC. Without this trigger, a manual
-- child-row write could race between the AI snapshot comparison and upsert.
create or replace function public.lock_prime_contract_for_sov_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_id uuid;
begin
  for v_contract_id in
    select candidates.contract_id
    from (
      select case when tg_op <> 'INSERT' then old.contract_id end as contract_id
      union
      select case when tg_op <> 'DELETE' then new.contract_id end as contract_id
    ) candidates
    where candidates.contract_id is not null
    order by candidates.contract_id
  loop
    perform 1
    from public.prime_contracts
    where id = v_contract_id
    for update;

    if not found then
      -- ON DELETE CASCADE removes child rows after the parent is already
      -- unavailable to this trigger. That path needs no competing-writer lock
      -- and must not make a governed Prime Contract deletion fail.
      if tg_op = 'DELETE' and v_contract_id = old.contract_id then
        continue;
      end if;
      raise exception using errcode = '23503', message = 'PRIME_CONTRACT_SOV_PARENT_UNAVAILABLE';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.lock_prime_contract_for_sov_write()
from public, anon, authenticated;

drop trigger if exists contract_line_items_parent_write_lock
on public.contract_line_items;

create trigger contract_line_items_parent_write_lock
before insert or update or delete on public.contract_line_items
for each row execute function public.lock_prime_contract_for_sov_write();

-- Payment rows do not have reliable historical foreign keys to Prime
-- Contracts. Lock their parent before a new reference becomes visible so a
-- concurrent contract delete cannot pass its history check and leave orphans.
create or replace function public.lock_prime_contract_for_financial_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_id uuid;
begin
  for v_contract_id in
    select candidates.contract_id
    from (
      select case when tg_op = 'UPDATE' then old.contract_id end as contract_id
      union
      select new.contract_id
    ) candidates
    where candidates.contract_id is not null
    order by candidates.contract_id
  loop
    perform 1
    from public.prime_contracts
    where id = v_contract_id
    for update;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'PRIME_CONTRACT_PARENT_UNAVAILABLE';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.lock_prime_contract_for_financial_history()
from public, anon, authenticated;

drop trigger if exists prime_contract_payment_app_parent_lock
on public.prime_contract_payment_applications;
create trigger prime_contract_payment_app_parent_lock
before insert or update of contract_id
on public.prime_contract_payment_applications
for each row execute function public.lock_prime_contract_for_financial_history();

drop trigger if exists prime_contract_payment_parent_lock
on public.prime_contract_payments;
create trigger prime_contract_payment_parent_lock
before insert or update of contract_id
on public.prime_contract_payments
for each row execute function public.lock_prime_contract_for_financial_history();

-- The API refuses to delete a Prime Contract once financial history exists.
-- Enforce the same invariant under the row lock so direct PostgREST calls and
-- concurrent inserts cannot bypass the route's preflight counts.
create or replace function public.prevent_prime_contract_financial_history_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.prime_contract_change_orders pcco
    where pcco.contract_id = old.id
       or pcco.prime_contract_id = old.id
  )
  or exists (
    select 1
    from public.prime_contract_payment_applications pcpa
    where pcpa.contract_id = old.id
  )
  or exists (
    select 1
    from public.prime_contract_payments pcp
    where pcp.contract_id = old.id
  )
  or exists (
    select 1
    from public.owner_invoices oi
    where oi.prime_contract_id = old.id
  )
  then
    raise exception using
      errcode = '23503',
      message = 'PRIME_CONTRACT_HAS_FINANCIAL_HISTORY';
  end if;

  return old;
end;
$$;

revoke all on function public.prevent_prime_contract_financial_history_delete()
from public, anon, authenticated;

drop trigger if exists prime_contract_financial_history_delete_guard
on public.prime_contracts;

create trigger prime_contract_financial_history_delete_guard
before delete on public.prime_contracts
for each row execute function public.prevent_prime_contract_financial_history_delete();

create or replace function public.ai_edit_draft_prime_contract_sov(
  p_project_id bigint,
  p_contract_id uuid,
  p_user_id uuid,
  p_is_admin boolean,
  p_expected_contract_updated_at timestamptz,
  p_expected_sov_rows jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.prime_contracts%rowtype;
  v_current_sov_rows jsonb;
  v_sov_total numeric(15, 2);
  v_updated_rows integer;
  v_appended_rows integer;
begin
  if p_user_id is null
    or p_project_id is null
    or p_contract_id is null
    or p_expected_contract_updated_at is null
    or jsonb_typeof(coalesce(p_expected_sov_rows, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_rows) < 1
    or jsonb_array_length(p_rows) > 500
  then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_REQUEST';
  end if;

  if not exists (
    select 1
    from public.users_auth ua
    join public.people p on p.id = ua.person_id
    where ua.auth_user_id = p_user_id
      and p.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_USER_UNAVAILABLE';
  end if;

  select *
  into v_contract
  from public.prime_contracts
  where id = p_contract_id
    and project_id = p_project_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if v_contract.is_private
    and not coalesce(p_is_admin, false)
    and v_contract.created_by is distinct from p_user_id
    and not (p_user_id = any(coalesce(v_contract.allowed_user_ids, '{}'::uuid[])))
  then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if v_contract.status::text <> 'draft' or coalesce(v_contract.executed, false) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_NOT_DRAFT';
  end if;

  if v_contract.updated_at is distinct from p_expected_contract_updated_at then
    raise exception using errcode = 'P0001', message = 'AI_SOV_STATE_CHANGED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cli.id,
        'contract_id', cli.contract_id,
        'line_number', cli.line_number,
        'description', cli.description,
        'budget_code_id', cli.budget_code_id,
        'cost_code_id', cli.cost_code_id,
        'quantity', cli.quantity,
        'unit_cost', cli.unit_cost,
        'unit_of_measure', cli.unit_of_measure,
        'markup_type', cli.markup_type,
        'updated_at', cli.updated_at
      ) order by cli.line_number, cli.id
    ),
    '[]'::jsonb
  )
  into v_current_sov_rows
  from public.contract_line_items cli
  where cli.contract_id = p_contract_id;

  if v_current_sov_rows <> p_expected_sov_rows then
    raise exception using errcode = 'P0001', message = 'AI_SOV_STATE_CHANGED';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as requested(
      id uuid,
      line_number integer,
      description text,
      budget_code_id uuid,
      cost_code_id text,
      quantity numeric,
      unit_cost numeric,
      unit_of_measure text
    )
    where requested.id is null
      or requested.line_number is null
      or requested.line_number < 1
      or requested.description is null
      or btrim(requested.description) = ''
      or char_length(requested.description) > 500
      or requested.budget_code_id is null
      or requested.cost_code_id is null
      or requested.quantity is null
      or requested.quantity <= 0
      or requested.quantity <> round(requested.quantity, 4)
      or requested.quantity >= 100000000000
      or requested.unit_cost is null
      or requested.unit_cost < 0
      or requested.unit_cost <> round(requested.unit_cost, 2)
      or requested.unit_cost >= 10000000000000
      or char_length(coalesce(requested.unit_of_measure, '')) > 50
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_ROWS';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as requested(id uuid, line_number integer)
    group by requested.id
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_to_recordset(p_rows) as requested(id uuid, line_number integer)
    group by requested.line_number
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_DUPLICATE_ROWS';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as requested(id uuid)
    join public.contract_line_items cli on cli.id = requested.id
    where cli.contract_id <> p_contract_id
  ) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as requested(
      budget_code_id uuid,
      cost_code_id text
    )
    left join public.project_budget_codes pbc
      on pbc.id = requested.budget_code_id
      and pbc.project_id = p_project_id
      and pbc.is_active = true
      and pbc.cost_code_id = requested.cost_code_id
    where pbc.id is null
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_BUDGET_CODE';
  end if;

  select count(*) filter (where cli.id is not null),
         count(*) filter (where cli.id is null)
  into v_updated_rows, v_appended_rows
  from jsonb_to_recordset(p_rows) as requested(id uuid)
  left join public.contract_line_items cli
    on cli.id = requested.id
    and cli.contract_id = p_contract_id;

  insert into public.contract_line_items (
    id,
    contract_id,
    line_number,
    description,
    budget_code_id,
    cost_code_id,
    quantity,
    unit_cost,
    unit_of_measure
  )
  select
    requested.id,
    p_contract_id,
    requested.line_number,
    btrim(requested.description),
    requested.budget_code_id,
    requested.cost_code_id,
    requested.quantity::numeric(15, 4),
    requested.unit_cost::numeric(15, 2),
    nullif(btrim(requested.unit_of_measure), '')
  from jsonb_to_recordset(p_rows) as requested(
    id uuid,
    line_number integer,
    description text,
    budget_code_id uuid,
    cost_code_id text,
    quantity numeric,
    unit_cost numeric,
    unit_of_measure text
  )
  on conflict (id) do update
  set line_number = excluded.line_number,
      description = excluded.description,
      budget_code_id = excluded.budget_code_id,
      cost_code_id = excluded.cost_code_id,
      quantity = excluded.quantity,
      unit_cost = excluded.unit_cost,
      unit_of_measure = excluded.unit_of_measure
  where contract_line_items.contract_id = p_contract_id;

  select coalesce(sum(cli.total_cost), 0)::numeric(15, 2)
  into v_sov_total
  from public.contract_line_items cli
  where cli.contract_id = p_contract_id;

  update public.prime_contracts
  set original_contract_value = v_sov_total,
      revised_contract_value = v_sov_total,
      updated_at = now()
  where id = p_contract_id
    and project_id = p_project_id;

  return jsonb_build_object(
    'sovTotal', v_sov_total,
    'updatedRows', v_updated_rows,
    'appendedRows', v_appended_rows,
    'contractUpdatedAt', now()
  );
exception
  when numeric_value_out_of_range then
    raise exception using errcode = '22003', message = 'AI_SOV_NUMERIC_OUT_OF_RANGE';
  when unique_violation then
    raise exception using errcode = '23505', message = 'AI_SOV_STATE_CHANGED';
end;
$$;

revoke all on function public.ai_edit_draft_prime_contract_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.ai_edit_draft_prime_contract_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) to service_role;

comment on function public.ai_edit_draft_prime_contract_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) is 'Atomically applies an approved Alleato AI SOV preview to an accessible unexecuted draft Prime Contract.';
