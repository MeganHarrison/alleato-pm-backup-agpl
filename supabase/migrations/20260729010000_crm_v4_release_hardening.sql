begin;

drop policy if exists crm_activity_contacts_write on public.crm_activity_contacts;
create policy crm_activity_contacts_write on public.crm_activity_contacts
for all to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or exists (
    select 1
    from public.crm_activities activity
    where activity.id = crm_activity_contacts.activity_id
      and activity.record_origin = 'manual'
      and activity.created_by_person_id = public.current_person_id()
      and public.current_has_company_module_permission('crm', 'write')
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or exists (
    select 1
    from public.crm_activities activity
    where activity.id = crm_activity_contacts.activity_id
      and activity.record_origin = 'manual'
      and activity.created_by_person_id = public.current_person_id()
      and public.current_has_company_module_permission('crm', 'write')
  )
);

drop policy if exists crm_deal_contacts_write on public.crm_deal_contacts;
create policy crm_deal_contacts_write on public.crm_deal_contacts
for all to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or exists (
    select 1
    from public.crm_deals deal
    where deal.id = crm_deal_contacts.deal_id
      and deal.owner_person_id = public.current_person_id()
      and public.current_has_company_module_permission('crm', 'write')
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or exists (
    select 1
    from public.crm_deals deal
    where deal.id = crm_deal_contacts.deal_id
      and deal.owner_person_id = public.current_person_id()
      and public.current_has_company_module_permission('crm', 'write')
  )
);

drop policy if exists crm_deal_documents_write on public.crm_deal_documents;
create policy crm_deal_documents_write on public.crm_deal_documents
for all to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or exists (
    select 1
    from public.crm_deals deal
    where deal.id = crm_deal_documents.deal_id
      and deal.owner_person_id = public.current_person_id()
      and public.current_has_company_module_permission('crm', 'write')
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    attached_by_person_id = public.current_person_id()
    and exists (
      select 1
      from public.crm_deals deal
      where deal.id = crm_deal_documents.deal_id
        and deal.owner_person_id = public.current_person_id()
        and public.current_has_company_module_permission('crm', 'write')
    )
  )
);

create or replace function public.crm_complete_conversion(
  p_attempt_id uuid,
  p_erp_external_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.crm_conversion_attempts;
begin
  if nullif(btrim(p_erp_external_id), '') is null then
    raise exception using
      errcode = '23514',
      message = 'An Acumatica project identifier is required.';
  end if;

  select *
  into v_attempt
  from public.crm_conversion_attempts
  where id = p_attempt_id
  for update;

  if not found
     or v_attempt.status not in ('project_created', 'erp_pending')
     or v_attempt.project_id is null then
    return false;
  end if;

  update public.crm_deals
  set project_sync_status = 'erp_synchronized'
  where id = v_attempt.deal_id
    and project_id = v_attempt.project_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The CRM deal no longer matches the conversion project.';
  end if;

  update public.crm_conversion_attempts
  set status = 'completed',
      erp_external_id = btrim(p_erp_external_id),
      last_error_code = null,
      last_error_message = null
  where id = v_attempt.id;

  return true;
end;
$$;

revoke all on function public.crm_complete_conversion(uuid, text)
from public, anon, authenticated;
grant execute on function public.crm_complete_conversion(uuid, text)
to service_role;

commit;
