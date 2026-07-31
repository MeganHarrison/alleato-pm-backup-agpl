-- Generic database audit log
--
-- Captures INSERT / UPDATE / DELETE on all key business entity tables.
-- One central table, one reusable trigger function.
-- Acumatica sync tables, RAG pipeline tables, and existing per-table audit
-- tables are excluded — they already have domain-specific logging or are
-- high-volume append-only.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Audit log table
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists public.db_audit_log (
  id             uuid          primary key default gen_random_uuid(),
  table_name     text          not null,
  record_id      text          not null,   -- pk cast to text (works for uuid + bigint)
  operation      text          not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by     uuid,                     -- auth.uid() at time of change; null for service-role / cron
  changed_at     timestamptz   not null default now(),
  changed_columns text[],                  -- only populated for UPDATE
  old_data       jsonb,
  new_data       jsonb
);

comment on table public.db_audit_log is
  'Central audit log. Populated by fn_audit_log_generic trigger on key business tables.';

-- indexes for common query patterns
create index if not exists idx_db_audit_log_table_record
  on public.db_audit_log (table_name, record_id, changed_at desc);

create index if not exists idx_db_audit_log_changed_at
  on public.db_audit_log (changed_at desc);

create index if not exists idx_db_audit_log_changed_by
  on public.db_audit_log (changed_by, changed_at desc)
  where changed_by is not null;

create index if not exists idx_db_audit_log_operation
  on public.db_audit_log (table_name, operation, changed_at desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Generic trigger function
-- ──────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_audit_log_generic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id   text;
  v_changed_cols text[];
  v_old         jsonb;
  v_new         jsonb;
begin
  if TG_OP = 'INSERT' then
    v_new       := to_jsonb(NEW);
    v_record_id := coalesce(v_new ->> 'id', '?');
    insert into public.db_audit_log
      (table_name, record_id, operation, changed_by, changed_columns, old_data, new_data)
    values
      (TG_TABLE_NAME, v_record_id, 'INSERT', auth.uid(),
       array(select jsonb_object_keys(v_new)), null, v_new);
    return NEW;

  elsif TG_OP = 'UPDATE' then
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
    v_record_id := coalesce(v_new ->> 'id', v_old ->> 'id', '?');
    select array_agg(key) into v_changed_cols
    from (
      select key
      from jsonb_each_text(v_new)
      where (v_old ->> key) is distinct from (v_new ->> key)
    ) s(key);

    -- skip no-op updates (e.g. updated_at-only ticks from set_updated_at)
    if v_changed_cols is null or array_length(v_changed_cols, 1) = 0
       or (v_changed_cols = array['updated_at']) then
      return NEW;
    end if;

    insert into public.db_audit_log
      (table_name, record_id, operation, changed_by, changed_columns, old_data, new_data)
    values
      (TG_TABLE_NAME, v_record_id, 'UPDATE', auth.uid(), v_changed_cols, v_old, v_new);
    return NEW;

  elsif TG_OP = 'DELETE' then
    v_old       := to_jsonb(OLD);
    v_record_id := coalesce(v_old ->> 'id', '?');
    insert into public.db_audit_log
      (table_name, record_id, operation, changed_by, changed_columns, old_data, new_data)
    values
      (TG_TABLE_NAME, v_record_id, 'DELETE', auth.uid(),
       array(select jsonb_object_keys(v_old)), v_old, null);
    return OLD;
  end if;

  return null;
end;
$$;

comment on function public.fn_audit_log_generic() is
  'Reusable AFTER INSERT OR UPDATE OR DELETE trigger that writes to db_audit_log.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Helper macro: attach trigger to a table
-- ──────────────────────────────────────────────────────────────────────────────
-- We use a DO block + dynamic SQL so we can do "CREATE TRIGGER IF NOT EXISTS"
-- which Postgres < 17 does not support natively.

do $$
declare
  tbl text;
  tables text[] := array[
    -- Projects & directory
    'projects',
    'companies',
    'people',
    'project_companies',
    'project_directory_memberships',
    'project_roles',
    'project_role_members',
    'project_vendors',

    -- Financial — budget
    'budget_lines',
    'budget_modifications',
    'budget_mod_lines',
    'project_budget_codes',

    -- Financial — contracts
    'prime_contracts',
    'contract_line_items',
    'contract_change_orders',

    -- Financial — commitments
    'subcontracts',
    'subcontract_sov_items',
    'purchase_orders',
    'purchase_order_sov_items',
    'direct_costs',
    'direct_cost_line_items',

    -- Financial — invoicing
    'owner_invoices',
    'owner_invoice_line_items',
    'subcontractor_invoices',
    'subcontractor_invoice_line_items',

    -- Change management
    'change_events',
    'change_event_line_items',
    'prime_contract_change_orders',

    -- Field tools
    'rfis',
    'submittals',
    'drawings',
    'drawing_revisions',

    -- Schedule & tasks
    'schedule_tasks',
    'tasks',

    -- Contacts & permissions
    'user_module_permissions',
    'user_directory_permissions',
    'user_granular_permission_overrides'
  ];
begin
  foreach tbl in array tables loop
    -- skip if table does not exist (guards against schema drift)
    if not exists (
      select 1 from pg_tables
      where schemaname = 'public' and tablename = tbl
    ) then
      raise notice 'db_audit_log: table % not found, skipping trigger', tbl;
      continue;
    end if;

    -- drop + recreate so reruns are idempotent
    execute format(
      'drop trigger if exists trg_audit_log on public.%I', tbl
    );
    execute format(
      $sql$
        create trigger trg_audit_log
        after insert or update or delete on public.%I
        for each row execute function public.fn_audit_log_generic()
      $sql$,
      tbl
    );
  end loop;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. RLS — service role can write; authenticated users can read their own project rows
-- ──────────────────────────────────────────────────────────────────────────────

alter table public.db_audit_log enable row level security;

-- service role (crons, API routes) can always read + write
create policy "service role full access"
  on public.db_audit_log
  as permissive
  for all
  to service_role
  using (true)
  with check (true);

-- authenticated users can read audit rows where they were the actor
create policy "users read own audit entries"
  on public.db_audit_log
  as permissive
  for select
  to authenticated
  using (changed_by = auth.uid());

commit;
