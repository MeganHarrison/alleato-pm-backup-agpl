-- Project Manager commitment permission correction (post-02:00 ledger slot).
--
-- The Commitments permission module was introduced after the system Project
-- Manager templates were seeded. Missing module keys resolve to None, so both
-- the project- and company-scoped Project Manager templates must be backfilled.
--
-- Forward-only rollback procedure, if the product decision is reversed:
--   update public.permission_templates
--   set rules_json = rules_json - 'commitments', updated_at = now()
--   where lower(btrim(name)) = 'project manager';
-- Run only after confirming no Project Manager template had a deliberate
-- Commitments rule before this migration.

begin;

update public.permission_templates
set
  rules_json = jsonb_set(
    coalesce(rules_json, '{}'::jsonb),
    '{commitments}',
    '["read","write"]'::jsonb,
    true
  ),
  updated_at = now()
where lower(btrim(name)) = 'project manager';

do $$
declare
  project_manager_count integer;
  invalid_template_count integer;
begin
  select count(*)
  into project_manager_count
  from public.permission_templates
  where lower(btrim(name)) = 'project manager';

  if project_manager_count = 0 then
    raise exception
      'Project Manager commitment migration found no Project Manager templates';
  end if;

  select count(*)
  into invalid_template_count
  from public.permission_templates
  where lower(btrim(name)) = 'project manager'
    and not (
      rules_json -> 'commitments' @> '["read"]'::jsonb
      and rules_json -> 'commitments' @> '["write"]'::jsonb
    );

  if invalid_template_count > 0 then
    raise exception
      'Project Manager commitment migration left % invalid templates',
      invalid_template_count;
  end if;
end
$$;

-- Keep private-commitment visibility on the same project/company template
-- hierarchy as the application permission loader.
create or replace function public.current_can_view_private_commitments(
  p_project_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_is_app_admin()
    or public.current_has_project_module_permission(
      p_project_id,
      'commitments',
      'admin'
    )
    or public.current_has_project_granular_permission(
      p_project_id,
      'view_private_commitments'
    );
$$;

revoke all on function public.current_can_view_private_commitments(bigint)
from public, anon;
grant execute on function public.current_can_view_private_commitments(bigint)
to authenticated, service_role;

-- Enforce the Commitments module at the database write boundary. This also
-- makes company-wide templates work without adding synthetic rows to every
-- project_directory_memberships record.
drop policy if exists subcontracts_select on public.subcontracts;
create policy subcontracts_select
on public.subcontracts
for select
to authenticated
using (
  public.current_is_app_admin()
  or (
    public.current_has_project_module_permission(project_id, 'commitments', 'read')
    and (
      not coalesce(is_private, false)
      or public.current_can_view_private_commitments(project_id)
      or public.current_person_id() = any(invoice_contact_ids)
    )
  )
);

drop policy if exists subcontracts_insert on public.subcontracts;
create policy subcontracts_insert
on public.subcontracts
for insert
to authenticated
with check (
  public.current_has_project_module_permission(project_id, 'commitments', 'write')
);

drop policy if exists subcontracts_update on public.subcontracts;
create policy subcontracts_update
on public.subcontracts
for update
to authenticated
using (
  public.current_has_project_module_permission(project_id, 'commitments', 'write')
)
with check (
  public.current_has_project_module_permission(project_id, 'commitments', 'write')
);

drop policy if exists subcontracts_delete on public.subcontracts;
create policy subcontracts_delete
on public.subcontracts
for delete
to authenticated
using (
  public.current_has_project_module_permission(project_id, 'commitments', 'write')
);

drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select
on public.purchase_orders
for select
to authenticated
using (
  public.current_is_app_admin()
  or (
    public.current_has_project_module_permission(project_id, 'commitments', 'read')
    and (
      not coalesce(is_private, false)
      or public.current_can_view_private_commitments(project_id)
      or public.current_person_id() = any(invoice_contact_ids)
    )
  )
);

drop policy if exists purchase_orders_insert on public.purchase_orders;
create policy purchase_orders_insert
on public.purchase_orders
for insert
to authenticated
with check (
  public.current_has_project_module_permission(project_id, 'commitments', 'write')
);

drop policy if exists purchase_orders_update on public.purchase_orders;
create policy purchase_orders_update
on public.purchase_orders
for update
to authenticated
using (
  public.current_has_project_module_permission(project_id, 'commitments', 'write')
)
with check (
  public.current_has_project_module_permission(project_id, 'commitments', 'write')
);

drop policy if exists purchase_orders_delete on public.purchase_orders;
create policy purchase_orders_delete
on public.purchase_orders
for delete
to authenticated
using (
  public.current_has_project_module_permission(project_id, 'commitments', 'write')
);

commit;
