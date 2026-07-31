-- Phase 2.3: Drift prevention for Acumatica sync tables.
-- FOR EACH STATEMENT trigger fires once per write batch (not per row),
-- inserting one sentinel row in acumatica_sync_runs so dashboards can alert
-- when any table has had no writes for >2h.

create or replace function public.record_acumatica_table_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.acumatica_sync_runs (
    entity_name,
    started_at,
    finished_at,
    status,
    upserted,
    fetched
  ) values (
    TG_TABLE_NAME,
    now(),
    now(),
    'drift_sentinel',
    1,
    1
  );
  return null;
end;
$$;

-- AR invoices
drop trigger if exists acumatica_ar_invoices_drift_sentinel on public.acumatica_ar_invoices;
create trigger acumatica_ar_invoices_drift_sentinel
  after insert or update on public.acumatica_ar_invoices
  for each statement execute function public.record_acumatica_table_write();

-- AP bills
drop trigger if exists acumatica_ap_bills_drift_sentinel on public.acumatica_ap_bills;
create trigger acumatica_ap_bills_drift_sentinel
  after insert or update on public.acumatica_ap_bills
  for each statement execute function public.record_acumatica_table_write();

-- Accounts
drop trigger if exists acumatica_accounts_drift_sentinel on public.acumatica_accounts;
create trigger acumatica_accounts_drift_sentinel
  after insert or update on public.acumatica_accounts
  for each statement execute function public.record_acumatica_table_write();

-- Customers
drop trigger if exists acumatica_customers_drift_sentinel on public.acumatica_customers;
create trigger acumatica_customers_drift_sentinel
  after insert or update on public.acumatica_customers
  for each statement execute function public.record_acumatica_table_write();

-- Project tasks
drop trigger if exists acumatica_project_tasks_drift_sentinel on public.acumatica_project_tasks;
create trigger acumatica_project_tasks_drift_sentinel
  after insert or update on public.acumatica_project_tasks
  for each statement execute function public.record_acumatica_table_write();

-- Payment applications
drop trigger if exists acumatica_payment_applications_drift_sentinel on public.acumatica_payment_applications;
create trigger acumatica_payment_applications_drift_sentinel
  after insert or update on public.acumatica_payment_applications
  for each statement execute function public.record_acumatica_table_write();

-- Projects
drop trigger if exists acumatica_projects_drift_sentinel on public.acumatica_projects;
create trigger acumatica_projects_drift_sentinel
  after insert or update on public.acumatica_projects
  for each statement execute function public.record_acumatica_table_write();

-- Project budgets
drop trigger if exists acumatica_project_budgets_drift_sentinel on public.acumatica_project_budgets;
create trigger acumatica_project_budgets_drift_sentinel
  after insert or update on public.acumatica_project_budgets
  for each statement execute function public.record_acumatica_table_write();
