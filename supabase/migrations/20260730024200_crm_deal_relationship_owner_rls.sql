-- ALL-52: require deal owners to own the selected CRM relationship.
begin;

drop policy if exists crm_deals_insert on public.crm_deals;
create policy crm_deals_insert on public.crm_deals
for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    public.current_has_company_module_permission('crm', 'write')
    and owner_person_id = public.current_person_id()
    and (
      (
        company_id is not null
        and exists (
          select 1
          from public.crm_account_profiles profile
          where profile.company_id = crm_deals.company_id
            and profile.owner_person_id = crm_deals.owner_person_id
            and profile.archived_at is null
        )
      )
      or (
        lead_id is not null
        and exists (
          select 1
          from public.crm_leads lead
          where lead.id = crm_deals.lead_id
            and lead.owner_person_id = crm_deals.owner_person_id
            and lead.archived_at is null
            and lead.status <> 'converted'
        )
      )
    )
  )
);

drop policy if exists crm_deals_update on public.crm_deals;
create policy crm_deals_update on public.crm_deals
for update to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    public.current_has_company_module_permission('crm', 'write')
    and owner_person_id = public.current_person_id()
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    owner_person_id = public.current_person_id()
    and (
      (
        company_id is not null
        and exists (
          select 1
          from public.crm_account_profiles profile
          where profile.company_id = crm_deals.company_id
            and profile.owner_person_id = crm_deals.owner_person_id
            and profile.archived_at is null
        )
      )
      or (
        lead_id is not null
        and exists (
          select 1
          from public.crm_leads lead
          where lead.id = crm_deals.lead_id
            and lead.owner_person_id = crm_deals.owner_person_id
            and lead.archived_at is null
            and lead.status <> 'converted'
        )
      )
    )
  )
);

commit;
