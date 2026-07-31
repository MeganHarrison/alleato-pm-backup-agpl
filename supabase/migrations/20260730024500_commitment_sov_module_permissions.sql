-- Keep commitment schedule-of-values authorization aligned with its parent.
--
-- Commitment parent policies use the Commitments module, so their SOV rows
-- must use the same permission source. Prime-contract SOV behavior remains
-- membership-based because it belongs to the Contracts module.

begin;

drop policy if exists schedule_of_values_write on public.schedule_of_values;
drop policy if exists schedule_of_values_select on public.schedule_of_values;
create policy schedule_of_values_select
on public.schedule_of_values
for select
to authenticated
using (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.subcontracts s
    where s.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        s.project_id,
        'commitments',
        'read'
      )
      and (
        not coalesce(s.is_private, false)
        or public.current_can_view_private_commitments(s.project_id)
        or public.current_person_id() = any(s.invoice_contact_ids)
      )
  )
  or exists (
    select 1
    from public.purchase_orders po
    where po.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        po.project_id,
        'commitments',
        'read'
      )
      and (
        not coalesce(po.is_private, false)
        or public.current_can_view_private_commitments(po.project_id)
        or public.current_person_id() = any(po.invoice_contact_ids)
      )
  )
  or exists (
    select 1
    from public.prime_contracts pc
    where pc.id = schedule_of_values.contract_id
      and public.current_is_project_member(pc.project_id)
  )
);

drop policy if exists schedule_of_values_insert on public.schedule_of_values;
create policy schedule_of_values_insert
on public.schedule_of_values
for insert
to authenticated
with check (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.subcontracts s
    where s.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        s.project_id,
        'commitments',
        'write'
      )
  )
  or exists (
    select 1
    from public.purchase_orders po
    where po.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        po.project_id,
        'commitments',
        'write'
      )
  )
  or exists (
    select 1
    from public.prime_contracts pc
    where pc.id = schedule_of_values.contract_id
      and public.current_is_project_member(pc.project_id)
  )
);

drop policy if exists schedule_of_values_update on public.schedule_of_values;
create policy schedule_of_values_update
on public.schedule_of_values
for update
to authenticated
using (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.subcontracts s
    where s.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        s.project_id,
        'commitments',
        'write'
      )
  )
  or exists (
    select 1
    from public.purchase_orders po
    where po.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        po.project_id,
        'commitments',
        'write'
      )
  )
  or exists (
    select 1
    from public.prime_contracts pc
    where pc.id = schedule_of_values.contract_id
      and public.current_is_project_member(pc.project_id)
  )
)
with check (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.subcontracts s
    where s.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        s.project_id,
        'commitments',
        'write'
      )
  )
  or exists (
    select 1
    from public.purchase_orders po
    where po.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        po.project_id,
        'commitments',
        'write'
      )
  )
  or exists (
    select 1
    from public.prime_contracts pc
    where pc.id = schedule_of_values.contract_id
      and public.current_is_project_member(pc.project_id)
  )
);

drop policy if exists schedule_of_values_delete on public.schedule_of_values;
create policy schedule_of_values_delete
on public.schedule_of_values
for delete
to authenticated
using (
  public.current_is_app_admin()
  or exists (
    select 1
    from public.subcontracts s
    where s.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        s.project_id,
        'commitments',
        'write'
      )
  )
  or exists (
    select 1
    from public.purchase_orders po
    where po.id = schedule_of_values.commitment_id
      and public.current_has_project_module_permission(
        po.project_id,
        'commitments',
        'write'
      )
  )
  or exists (
    select 1
    from public.prime_contracts pc
    where pc.id = schedule_of_values.contract_id
      and public.current_is_project_member(pc.project_id)
  )
);

-- Executable contract: every SOV policy must contain the expected module
-- permission while retaining the separate prime-contract membership branch.
do $$
declare
  invalid_policy_count integer;
begin
  select count(*)
  into invalid_policy_count
  from (
    values
      ('schedule_of_values_select', 'read', true),
      ('schedule_of_values_insert', 'write', false),
      ('schedule_of_values_update', 'write', true),
      ('schedule_of_values_delete', 'write', true)
  ) as expected(policy_name, action_name, permission_in_using)
  left join pg_policies policy
    on policy.schemaname = 'public'
    and policy.tablename = 'schedule_of_values'
    and policy.policyname = expected.policy_name
  where policy.policyname is null
    or (
      expected.permission_in_using
      and coalesce(policy.qual, '') not ilike
        '%' || 'current_has_project_module_permission' || '%' ||
        expected.action_name || '%'
    )
    or (
      not expected.permission_in_using
      and coalesce(policy.with_check, '') not ilike
        '%' || 'current_has_project_module_permission' || '%' ||
        expected.action_name || '%'
    )
    or (
      coalesce(policy.qual, '') || coalesce(policy.with_check, '')
    ) not ilike '%current_is_project_member%';

  if invalid_policy_count > 0 then
    raise exception
      'Commitment SOV migration left % invalid policies',
      invalid_policy_count;
  end if;
end
$$;

commit;
