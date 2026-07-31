-- ALL-52: keep pre-customer CRM identity separate from ERP-owned companies.
begin;

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null check (
    length(btrim(organization_name)) between 1 and 300
  ),
  contact_name text check (
    contact_name is null or length(btrim(contact_name)) between 1 and 200
  ),
  contact_email text check (
    contact_email is null or length(btrim(contact_email)) between 3 and 320
  ),
  contact_phone text check (
    contact_phone is null or length(btrim(contact_phone)) between 3 and 50
  ),
  source text not null default 'manual' check (length(btrim(source)) > 0),
  notes text,
  owner_person_id uuid not null references public.people(id) on delete restrict,
  status text not null default 'lead' check (
    status in ('lead', 'qualified', 'converted', 'disqualified')
  ),
  last_meaningful_activity_at timestamptz,
  health_status text not null default 'unknown' check (
    health_status in ('active', 'watch', 'stale', 'unknown')
  ),
  health_reason text not null default 'No meaningful activity has been recorded.',
  health_evaluated_at timestamptz,
  converted_company_id uuid unique references public.companies(id) on delete restrict,
  converted_at timestamptz,
  row_version integer not null default 1 check (row_version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_leads_conversion_contract check (
    (
      status = 'converted'
      and converted_company_id is not null
      and converted_at is not null
    )
    or (
      status <> 'converted'
      and converted_company_id is null
      and converted_at is null
    )
  )
);

alter table public.crm_deals
  alter column company_id drop not null,
  add column lead_id uuid references public.crm_leads(id) on delete restrict;

alter table public.crm_deals
  add constraint crm_deals_relationship_target_check
  check (num_nonnulls(company_id, lead_id) = 1);

alter table public.crm_activities
  alter column company_id drop not null,
  add column lead_id uuid references public.crm_leads(id) on delete restrict;

alter table public.crm_activities
  add constraint crm_activities_relationship_target_check
  check (num_nonnulls(company_id, lead_id) = 1);

alter table public.tasks
  add column crm_lead_id uuid references public.crm_leads(id) on delete restrict;

create index crm_leads_owner_status_idx
  on public.crm_leads(owner_person_id, status)
  where archived_at is null;
create index crm_leads_name_idx
  on public.crm_leads(lower(organization_name))
  where archived_at is null;
create index crm_deals_lead_status_idx
  on public.crm_deals(lead_id, status)
  where lead_id is not null;
create index crm_activities_lead_occurred_idx
  on public.crm_activities(lead_id, occurred_at desc)
  where lead_id is not null;
create index tasks_crm_lead_due_idx
  on public.tasks(crm_lead_id, due_date)
  where crm_lead_id is not null;

create trigger crm_leads_touch
before update on public.crm_leads
for each row execute function public.crm_set_versioned_updated_at();

create trigger crm_leads_owner_guard
before insert or update of owner_person_id on public.crm_leads
for each row execute function public.crm_validate_internal_owner();

alter table public.crm_leads enable row level security;

create policy crm_leads_read on public.crm_leads
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));

create policy crm_leads_insert on public.crm_leads
for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'write')
  and owner_person_id = public.current_person_id()
);

create policy crm_leads_update on public.crm_leads
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
  or owner_person_id = public.current_person_id()
);

grant select, insert, update on public.crm_leads to authenticated;
grant all on public.crm_leads to service_role;

comment on table public.crm_leads is
'CRM-owned pre-customer relationships that do not require an ERP-owned company.';
comment on column public.crm_deals.lead_id is
'CRM-native relationship target; exactly one of company_id or lead_id is required.';
comment on column public.crm_activities.lead_id is
'CRM-native relationship target; exactly one of company_id or lead_id is required.';
comment on column public.tasks.crm_lead_id is
'Optional CRM-native lead target for shared follow-up tasks.';

commit;
