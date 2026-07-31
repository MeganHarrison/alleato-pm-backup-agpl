-- Migration: Create user_can_access_entity shared RLS helper
-- Purpose: Single helper function used by all junction table RLS policies.
--          Delegates to existing current_is_app_admin() and current_is_project_member()
--          rather than reimplementing the access chain.
-- Affects: New function public.user_can_access_entity(text, text)
-- Note: entity_id is text to accommodate uuid, bigint, and integer PKs.

create or replace function public.user_can_access_entity(
  entity_type text,
  entity_id   text     -- accepts uuid::text, bigint::text, integer::text
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project_id integer;
  has_access   boolean;
begin
  -- Admin bypass via existing helper (reads user_profiles.is_admin)
  if public.current_is_app_admin() then
    return true;
  end if;

  case entity_type

    when 'project' then
      -- project_id is integer in projects table
      return public.current_is_project_member(entity_id::integer);

    when 'commitment' then
      select cu.project_id into v_project_id
      from public.commitments_unified cu
      where cu.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'prime_contract' then
      select pc.project_id::integer into v_project_id
      from public.prime_contracts pc
      where pc.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'change_order' then
      select co.project_id into v_project_id
      from public.change_orders co
      where co.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'invoice' then
      -- owner_invoices reaches project through prime_contracts
      select pc.project_id::integer into v_project_id
      from public.owner_invoices oi
      join public.prime_contracts pc on pc.id = oi.prime_contract_id
      where oi.id = entity_id::bigint;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'submittal' then
      select s.project_id into v_project_id
      from public.submittals s
      where s.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'rfi' then
      select r.project_id::integer into v_project_id
      from public.rfis r
      where r.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'drawing' then
      select d.project_id into v_project_id
      from public.drawings d
      where d.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'company' then
      -- companies are cross-project; allow read for any authenticated user
      has_access := (select auth.uid()) is not null;

    else
      has_access := false;

  end case;

  return coalesce(has_access, false);
end;
$$;

comment on function public.user_can_access_entity(text, text) is
  'Shared RLS helper for document junction tables. Returns true if the current '
  'user has access to the given entity. Delegates to current_is_app_admin() and '
  'current_is_project_member(). entity_id must be cast to text at call site.';

grant execute on function public.user_can_access_entity(text, text) to authenticated;
