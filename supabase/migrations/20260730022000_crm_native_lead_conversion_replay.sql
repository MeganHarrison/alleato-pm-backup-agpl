-- ALL-52: make lead conversion replay-safe and move tasks to one identity.
begin;

create or replace function public.crm_convert_lead_to_company(
  p_lead_id uuid,
  p_company_id uuid,
  p_expected_row_version integer
)
returns public.crm_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_person_id uuid;
  v_lead public.crm_leads;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then
    raise exception using
      errcode = '42501',
      message = 'An active internal CRM user is required.';
  end if;

  select *
  into v_lead
  from public.crm_leads
  where id = p_lead_id
    and archived_at is null
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CRM lead was not found.';
  end if;

  if not (
    public.current_has_company_module_permission('crm', 'admin')
    or (
      public.current_has_company_module_permission('crm', 'write')
      and v_lead.owner_person_id = v_person_id
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'You do not have permission to convert this CRM lead.';
  end if;

  if v_lead.status = 'converted' then
    if v_lead.converted_company_id = p_company_id then
      return v_lead;
    end if;
    raise exception using
      errcode = '23514',
      message = 'This lead is already linked to a different company.';
  end if;

  if v_lead.row_version <> p_expected_row_version then
    raise exception using
      errcode = '40001',
      message = 'The CRM lead changed before conversion. Refresh and try again.';
  end if;

  if not exists (
    select 1
    from public.companies
    where id = p_company_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'The selected company does not exist.';
  end if;

  update public.crm_deals
  set company_id = p_company_id,
      lead_id = null
  where lead_id = p_lead_id;

  update public.crm_activities
  set company_id = p_company_id,
      lead_id = null
  where lead_id = p_lead_id;

  update public.tasks
  set company_id = p_company_id,
      crm_lead_id = null,
      source_url = case
        when crm_deal_id is not null then source_url
        else format('/crm/companies/%s', p_company_id)
      end
  where crm_lead_id = p_lead_id;

  update public.crm_leads
  set status = 'converted',
      converted_company_id = p_company_id,
      converted_at = now()
  where id = p_lead_id
  returning * into v_lead;

  perform public.crm_evaluate_account(p_company_id);
  return v_lead;
end;
$$;

revoke all on function public.crm_convert_lead_to_company(uuid, uuid, integer)
from public, anon;
grant execute on function public.crm_convert_lead_to_company(uuid, uuid, integer)
to authenticated, service_role;

commit;
