-- CRM workflow layer: shared identity, separate workflow tables.
--
-- Decision (2026-07-23, Megan + Brandon): prospects/leads/networking contacts do
-- NOT get their own parallel identity tables. `companies` and `people` stay the
-- single identity source (80 FKs already point at them; email/meeting/Teams
-- intelligence already resolves to them). The CRM lives beside them:
--   - `lifecycle_stage` on companies/people marks relationship maturity
--     (prospect -> qualified -> active). Existing rows backfill to 'active'.
--   - New workflow tables (crm_pipeline_stages, crm_deals, crm_activities,
--     company_qualification) hold all pipeline data and FK into the identity.
--   - `verified_companies` view is the leak-proof read path for PM surfaces
--     (vendor dropdowns, directory): only active-lifecycle, non-archived rows.
-- Converting a prospect is a status flip plus a qualification record — never a
-- row migration.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

-- ---------------------------------------------------------------------------
-- 1. Lifecycle stage on the identity tables
-- ---------------------------------------------------------------------------

alter table public.companies
  add column if not exists lifecycle_stage text not null default 'active';

alter table public.companies
  drop constraint if exists companies_lifecycle_stage_check,
  add constraint companies_lifecycle_stage_check check (
    lifecycle_stage in ('prospect', 'qualified', 'active')
  );

comment on column public.companies.lifecycle_stage is
  'CRM relationship maturity: prospect (CRM-only, unverified), qualified (in vetting), active (verified — visible to PM surfaces via verified_companies). Orthogonal to status (active/archived).';

create index if not exists companies_lifecycle_stage_idx
  on public.companies (lifecycle_stage)
  where lifecycle_stage <> 'active';

alter table public.people
  add column if not exists lifecycle_stage text not null default 'active';

alter table public.people
  drop constraint if exists people_lifecycle_stage_check,
  add constraint people_lifecycle_stage_check check (
    lifecycle_stage in ('prospect', 'qualified', 'active')
  );

comment on column public.people.lifecycle_stage is
  'CRM relationship maturity for contacts: prospect (CRM-only networking contact), qualified, active (working relationship). Orthogonal to person_type and status.';

create index if not exists people_lifecycle_stage_idx
  on public.people (lifecycle_stage)
  where lifecycle_stage <> 'active';

-- ---------------------------------------------------------------------------
-- 2. Pipeline stages (admin-managed lookup)
-- ---------------------------------------------------------------------------

create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null,
  is_terminal boolean not null default false,
  outcome text check (outcome in ('won', 'lost')),
  created_at timestamptz not null default now()
);

comment on table public.crm_pipeline_stages is
  'Ordered CRM deal pipeline stages. Terminal stages carry an outcome (won/lost). Admin-managed; deals reference these.';

insert into public.crm_pipeline_stages (name, sort_order, is_terminal, outcome)
values
  ('Lead', 10, false, null),
  ('Contacted', 20, false, null),
  ('Qualified', 30, false, null),
  ('Proposal', 40, false, null),
  ('Negotiation', 50, false, null),
  ('Won', 60, true, 'won'),
  ('Lost', 70, true, 'lost')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Deals
-- ---------------------------------------------------------------------------

create table if not exists public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_id uuid not null references public.companies(id) on delete restrict,
  primary_contact_id uuid references public.people(id) on delete set null,
  owner_id uuid references public.people(id) on delete set null,
  stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  value numeric(14, 2),
  expected_close_date date,
  lead_source text,
  description text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.crm_deals is
  'CRM opportunities/deals. FK to the shared identity (companies/people) — never to a parallel CRM identity table. company_id is restrict so closing out a company requires resolving its deals.';
comment on column public.crm_deals.owner_id is
  'Internal person responsible for the deal (people row, typically person_type=employee).';
comment on column public.crm_deals.created_by is
  'Auth user UUID. Intentionally not a foreign key so account deletion cannot erase history.';

create index if not exists crm_deals_company_idx on public.crm_deals (company_id);
create index if not exists crm_deals_stage_idx on public.crm_deals (stage_id) where status = 'open';
create index if not exists crm_deals_owner_idx on public.crm_deals (owner_id) where status = 'open';

drop trigger if exists set_crm_deals_updated_at on public.crm_deals;
create trigger set_crm_deals_updated_at
before update on public.crm_deals
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Activities (calls, follow-ups, notes)
-- ---------------------------------------------------------------------------

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  deal_id uuid references public.crm_deals(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  activity_type text not null check (
    activity_type in ('call', 'email', 'meeting', 'note', 'follow_up')
  ),
  subject text not null,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.crm_activities is
  'Manually logged CRM touchpoints and follow-ups. Automated communication history (emails, meetings, Teams) is NOT copied here — it already resolves to companies/people via document_metadata.';
comment on column public.crm_activities.created_by is
  'Auth user UUID. Intentionally not a foreign key so account deletion cannot erase history.';

create index if not exists crm_activities_company_idx on public.crm_activities (company_id, created_at desc);
create index if not exists crm_activities_deal_idx on public.crm_activities (deal_id) where deal_id is not null;
create index if not exists crm_activities_due_idx on public.crm_activities (due_at) where completed_at is null and due_at is not null;

drop trigger if exists set_crm_activities_updated_at on public.crm_activities;
create trigger set_crm_activities_updated_at
before update on public.crm_activities
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Company qualification (W-9 / insurance / license vetting)
-- ---------------------------------------------------------------------------

create table if not exists public.company_qualification (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  w9_received_at date,
  insurance_certificate_received_at date,
  insurance_expires_at date,
  license_verified_at date,
  qualified_at timestamptz,
  qualified_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_qualification is
  'Vetting evidence per company (one row max). When qualification completes, flip companies.lifecycle_stage to active — the company row itself never moves. Qualification documents attach via the existing company_documents Pattern C junction.';
comment on column public.company_qualification.qualified_by is
  'Auth user UUID. Intentionally not a foreign key so account deletion cannot erase audit evidence.';

drop trigger if exists set_company_qualification_updated_at on public.company_qualification;
create trigger set_company_qualification_updated_at
before update on public.company_qualification
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Leak-proof read path for PM surfaces
-- ---------------------------------------------------------------------------

create or replace view public.verified_companies
with (security_invoker = true) as
select *
from public.companies
where lifecycle_stage = 'active'
  and coalesce(status, 'active') <> 'archived';

comment on view public.verified_companies is
  'The only read path PM surfaces (vendor dropdowns, directory) should use. Excludes CRM prospects/qualifying companies and archived rows so unvetted CRM entries can never leak into project workflows.';

revoke all on table public.verified_companies from anon;
grant select on table public.verified_companies to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. RLS + grants (mirrors companies/people: authenticated read/insert/update,
--    service_role everything; no authenticated deletes on evidence tables)
-- ---------------------------------------------------------------------------

alter table public.crm_pipeline_stages enable row level security;

drop policy if exists crm_pipeline_stages_select_authenticated on public.crm_pipeline_stages;
create policy crm_pipeline_stages_select_authenticated
  on public.crm_pipeline_stages for select to authenticated using (true);

drop policy if exists crm_pipeline_stages_service_role on public.crm_pipeline_stages;
create policy crm_pipeline_stages_service_role
  on public.crm_pipeline_stages for all to service_role using (true) with check (true);

revoke all on table public.crm_pipeline_stages from anon;
grant select on table public.crm_pipeline_stages to authenticated;
grant all on table public.crm_pipeline_stages to service_role;

alter table public.crm_deals enable row level security;

drop policy if exists crm_deals_select_authenticated on public.crm_deals;
create policy crm_deals_select_authenticated
  on public.crm_deals for select to authenticated using (true);

drop policy if exists crm_deals_insert_authenticated on public.crm_deals;
create policy crm_deals_insert_authenticated
  on public.crm_deals for insert to authenticated with check (true);

drop policy if exists crm_deals_update_authenticated on public.crm_deals;
create policy crm_deals_update_authenticated
  on public.crm_deals for update to authenticated using (true) with check (true);

drop policy if exists crm_deals_delete_authenticated on public.crm_deals;
create policy crm_deals_delete_authenticated
  on public.crm_deals for delete to authenticated using (true);

drop policy if exists crm_deals_service_role on public.crm_deals;
create policy crm_deals_service_role
  on public.crm_deals for all to service_role using (true) with check (true);

revoke all on table public.crm_deals from anon;
grant select, insert, update, delete on table public.crm_deals to authenticated;
grant all on table public.crm_deals to service_role;

alter table public.crm_activities enable row level security;

drop policy if exists crm_activities_select_authenticated on public.crm_activities;
create policy crm_activities_select_authenticated
  on public.crm_activities for select to authenticated using (true);

drop policy if exists crm_activities_insert_authenticated on public.crm_activities;
create policy crm_activities_insert_authenticated
  on public.crm_activities for insert to authenticated with check (true);

drop policy if exists crm_activities_update_authenticated on public.crm_activities;
create policy crm_activities_update_authenticated
  on public.crm_activities for update to authenticated using (true) with check (true);

drop policy if exists crm_activities_delete_authenticated on public.crm_activities;
create policy crm_activities_delete_authenticated
  on public.crm_activities for delete to authenticated using (true);

drop policy if exists crm_activities_service_role on public.crm_activities;
create policy crm_activities_service_role
  on public.crm_activities for all to service_role using (true) with check (true);

revoke all on table public.crm_activities from anon;
grant select, insert, update, delete on table public.crm_activities to authenticated;
grant all on table public.crm_activities to service_role;

alter table public.company_qualification enable row level security;

drop policy if exists company_qualification_select_authenticated on public.company_qualification;
create policy company_qualification_select_authenticated
  on public.company_qualification for select to authenticated using (true);

drop policy if exists company_qualification_insert_authenticated on public.company_qualification;
create policy company_qualification_insert_authenticated
  on public.company_qualification for insert to authenticated with check (true);

drop policy if exists company_qualification_update_authenticated on public.company_qualification;
create policy company_qualification_update_authenticated
  on public.company_qualification for update to authenticated using (true) with check (true);

drop policy if exists company_qualification_service_role on public.company_qualification;
create policy company_qualification_service_role
  on public.company_qualification for all to service_role using (true) with check (true);

revoke all on table public.company_qualification from anon;
grant select, insert, update on table public.company_qualification to authenticated;
grant all on table public.company_qualification to service_role;

commit;
