-- =============================================================================
-- Retire legacy subcontractors table
-- =============================================================================
--
-- Subcontractor companies now live in public.companies and commitments use
-- financial_contracts.company_id. This migration removes the old
-- public.subcontractors catalog and its empty child tables.
--
-- Guardrails:
--   1. Do not drop financial_contracts.subcontractor_id unless every populated
--      legacy reference already has a valid company_id.
--   2. Do not drop subcontractor_documents/subcontractor_projects if they have
--      rows that need migration.
-- =============================================================================

begin;

do $$
begin
  if exists (
    select 1
    from public.financial_contracts fc
    left join public.companies c on c.id = fc.company_id
    where fc.subcontractor_id is not null
      and (fc.company_id is null or c.id is null)
  ) then
    raise exception
      'Cannot retire public.subcontractors: financial_contracts has legacy subcontractor_id values without valid company_id replacements.';
  end if;

  if to_regclass('public.subcontractor_documents') is not null
    and exists (select 1 from public.subcontractor_documents)
  then
    raise exception
      'Cannot retire public.subcontractors: subcontractor_documents still contains rows.';
  end if;

  if to_regclass('public.subcontractor_projects') is not null
    and exists (select 1 from public.subcontractor_projects)
  then
    raise exception
      'Cannot retire public.subcontractors: subcontractor_projects still contains rows.';
  end if;
end $$;

drop view if exists public.subcontractors_summary cascade;

alter table if exists public.financial_contracts
  drop constraint if exists financial_contracts_subcontractor_id_fkey;

alter table if exists public.financial_contracts
  drop column if exists subcontractor_id;

drop table if exists public.subcontractor_documents cascade;
drop table if exists public.subcontractor_projects cascade;
drop table if exists public.subcontractors cascade;

commit;
