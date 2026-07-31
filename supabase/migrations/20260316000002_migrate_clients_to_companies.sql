-- Migrate clients table into companies table (type = 'client')
-- Drops the separate clients table and updates all FK references to use companies.id (uuid)
-- Affected tables: projects, prime_contracts, contracts, prospects
--
-- NOTE: This migration was applied manually before the migration system was in place.
-- All statements are wrapped in a conditional guard to make it idempotent.
-- If clients table no longer exists, the migration is a no-op.

DO $$
BEGIN
  -- If clients table doesn't exist, the migration was already applied
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients') THEN
    RAISE NOTICE 'clients table already migrated to companies, skipping';
    RETURN;
  END IF;

  -- 1. Mark existing linked companies as type='client'
  UPDATE companies c SET type = 'client' FROM clients cl WHERE cl.company_id = c.id;

  -- 2. Create company records for clients that had no company_id
  INSERT INTO companies (name, type, status)
  SELECT DISTINCT ON (name) name, 'client', COALESCE(status, 'active')
  FROM clients WHERE company_id IS NULL AND name IS NOT NULL;

  -- 3. Link new companies back to clients
  UPDATE clients cl SET company_id = c.id
  FROM companies c
  WHERE cl.company_id IS NULL AND cl.name IS NOT NULL AND c.name = cl.name AND c.type = 'client';

  -- 4. Drop dependent views + trigger
  DROP TRIGGER IF EXISTS trg_sync_client ON projects;
  DROP MATERIALIZED VIEW IF EXISTS contract_financial_summary_mv;
  DROP VIEW IF EXISTS contract_financial_summary;
  DROP VIEW IF EXISTS prime_contract_financial_summary;
  DROP VIEW IF EXISTS projects_with_counts;

  -- 5. Migrate projects.client_id (bigint -> uuid)
  ALTER TABLE projects ADD COLUMN client_company_id uuid REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE;
  UPDATE projects p SET client_company_id = cl.company_id FROM clients cl WHERE p.client_id = cl.id;
  ALTER TABLE projects DROP COLUMN client_id;
  ALTER TABLE projects RENAME COLUMN client_company_id TO client_id;

  -- 6. Update sync_client to use companies
  CREATE OR REPLACE FUNCTION public.sync_client() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    SELECT name INTO NEW.client FROM public.companies WHERE id = NEW.client_id;
    RETURN NEW;
  END;
  $fn$;
  CREATE TRIGGER trg_sync_client BEFORE INSERT OR UPDATE OF client_id ON public.projects
    FOR EACH ROW EXECUTE FUNCTION sync_client();

  -- 7. Recreate projects_with_counts view
  CREATE VIEW public.projects_with_counts AS
    SELECT p.id, p.created_at, p.name, p."job number", p."start date",
      p."est completion", p."est revenue", p."est profit", p.address,
      p.onedrive, p.phase, p.state, p.client_id, p.category, p.aliases,
      p.team_members, p.current_phase, p.completion_percentage, p.budget,
      p.budget_used, p.client, p.summary, p.summary_metadata, p.summary_updated_at,
      p.health_score, p.health_status, p.access, p.archived, p.archived_by, p.archived_at,
      p.erp_system, p.erp_last_job_cost_sync, p.erp_last_direct_cost_sync, p.erp_sync_status,
      p.project_manager, p.project_number, p.stakeholders, p.budget_locked, p.budget_locked_at,
      p.budget_locked_by, p.work_scope, p.project_sector, p.delivery_method, p.name_code, p.type,
      COALESCE(m.doc_count, 0::bigint) AS document_count
    FROM projects p
    LEFT JOIN (SELECT project_id, count(*) AS doc_count FROM document_metadata GROUP BY project_id) m
      ON m.project_id = p.id;

  -- 8. Migrate prime_contracts.client_id (bigint -> uuid)
  ALTER TABLE prime_contracts ADD COLUMN client_company_id uuid REFERENCES companies(id);
  UPDATE prime_contracts pc SET client_company_id = cl.company_id FROM clients cl WHERE pc.client_id = cl.id;
  ALTER TABLE prime_contracts DROP CONSTRAINT IF EXISTS prime_contracts_client_id_fkey;
  ALTER TABLE prime_contracts DROP COLUMN client_id;
  ALTER TABLE prime_contracts RENAME COLUMN client_company_id TO client_id;

  -- Recreate prime_contract_financial_summary
  CREATE VIEW public.prime_contract_financial_summary AS
    SELECT pc.id AS contract_id, pc.project_id, pc.contract_number, pc.title, pc.status,
      pc.client_id, pc.executed, pc.is_private AS private,
      pc.original_contract_value AS original_contract_amount,
      COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0) AS approved_change_orders,
      COALESCE(sum(co.amount) FILTER (WHERE co.status = 'pending'), 0) AS pending_change_orders,
      COALESCE(sum(co.amount) FILTER (WHERE co.status = 'draft'), 0) AS draft_change_orders,
      pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0) AS revised_contract_amount,
      pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0) + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'pending'), 0) AS pending_revised_contract_amount,
      COALESCE((SELECT sum(pa.amount) FROM prime_contract_payment_applications pa WHERE pa.contract_id = pc.id AND pa.status = 'approved'), 0) AS invoiced_amount,
      COALESCE((SELECT sum(p.amount) FROM prime_contract_payments p WHERE p.contract_id = pc.id), 0) AS payments_received,
      pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0) - COALESCE((SELECT sum(p.amount) FROM prime_contract_payments p WHERE p.contract_id = pc.id), 0) AS remaining_balance,
      CASE WHEN (pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0)) = 0 THEN 0
        ELSE round(COALESCE((SELECT sum(p.amount) FROM prime_contract_payments p WHERE p.contract_id = pc.id), 0) * 100.0 / (pc.original_contract_value + COALESCE(sum(co.amount) FILTER (WHERE co.status = 'approved'), 0)), 2)
      END AS percent_paid
    FROM prime_contracts pc
    LEFT JOIN contract_change_orders co ON co.contract_id = pc.id
    GROUP BY pc.id, pc.project_id, pc.contract_number, pc.title, pc.status, pc.client_id,
      pc.executed, pc.is_private, pc.original_contract_value;

  -- 9. Migrate contracts (4 columns)
  ALTER TABLE contracts ADD COLUMN client_company_id uuid;
  ALTER TABLE contracts ADD COLUMN ae_company_id uuid;
  ALTER TABLE contracts ADD COLUMN contractor_company_id uuid;
  ALTER TABLE contracts ADD COLUMN owner_company_id uuid;

  UPDATE contracts c SET client_company_id = cl.company_id FROM clients cl WHERE c.client_id = cl.id;
  UPDATE contracts c SET ae_company_id = cl.company_id FROM clients cl WHERE c.architect_engineer_id = cl.id;
  UPDATE contracts c SET contractor_company_id = cl.company_id FROM clients cl WHERE c.contractor_id = cl.id;
  UPDATE contracts c SET owner_company_id = cl.company_id FROM clients cl WHERE c.owner_client_id = cl.id;

  ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_client_id_fkey;
  ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_architect_engineer_id_fkey;
  ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_contractor_id_fkey;
  ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_owner_client_id_fkey;
  ALTER TABLE contracts DROP COLUMN client_id;
  ALTER TABLE contracts DROP COLUMN architect_engineer_id;
  ALTER TABLE contracts DROP COLUMN contractor_id;
  ALTER TABLE contracts DROP COLUMN owner_client_id;

  ALTER TABLE contracts RENAME COLUMN client_company_id TO client_id;
  ALTER TABLE contracts RENAME COLUMN ae_company_id TO architect_engineer_id;
  ALTER TABLE contracts RENAME COLUMN contractor_company_id TO contractor_id;
  ALTER TABLE contracts RENAME COLUMN owner_company_id TO owner_client_id;

  ALTER TABLE contracts ADD CONSTRAINT contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES companies(id) ON DELETE RESTRICT;
  ALTER TABLE contracts ADD CONSTRAINT contracts_architect_engineer_id_fkey FOREIGN KEY (architect_engineer_id) REFERENCES companies(id);
  ALTER TABLE contracts ADD CONSTRAINT contracts_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES companies(id);
  ALTER TABLE contracts ADD CONSTRAINT contracts_owner_client_id_fkey FOREIGN KEY (owner_client_id) REFERENCES companies(id);

  -- Recreate contract_financial_summary + materialized view
  CREATE VIEW public.contract_financial_summary AS
    WITH original_sov AS (
      SELECT contract_id, COALESCE(sum(line_amount), 0) AS original_contract_amount FROM prime_contract_sovs GROUP BY contract_id
    ), approved_pccos AS (
      SELECT pc.contract_id, COALESCE(sum(li.line_amount), 0) AS approved_change_orders
      FROM prime_contract_change_orders pc JOIN pcco_line_items li ON li.pcco_id = pc.id WHERE pc.status = 'Approved' GROUP BY pc.contract_id
    ), pending_pcos AS (
      SELECT pc.contract_id, COALESCE(sum(li.line_amount), 0) AS pending_change_orders
      FROM prime_potential_change_orders pc JOIN pco_line_items li ON li.pco_id = pc.id WHERE pc.status = 'Pending' GROUP BY pc.contract_id
    ), draft_pcos AS (
      SELECT pc.contract_id, COALESCE(sum(li.line_amount), 0) AS draft_change_orders
      FROM prime_potential_change_orders pc JOIN pco_line_items li ON li.pco_id = pc.id WHERE pc.status = 'Draft' GROUP BY pc.contract_id
    ), invoiced AS (
      SELECT oi.contract_id, COALESCE(sum(li.approved_amount), 0) AS invoiced_amount
      FROM owner_invoices oi JOIN owner_invoice_line_items li ON li.invoice_id = oi.id WHERE oi.status = 'Approved' GROUP BY oi.contract_id
    ), payments AS (
      SELECT contract_id, COALESCE(sum(amount), 0) AS payments_received FROM payment_transactions GROUP BY contract_id
    )
    SELECT c.id AS contract_id, c.contract_number, c.client_id, c.project_id, c.title,
      c.status, c.erp_status, c.executed, c.private,
      COALESCE(os.original_contract_amount, 0) AS original_contract_amount,
      COALESCE(ap.approved_change_orders, 0) AS approved_change_orders,
      COALESCE(os.original_contract_amount, 0) + COALESCE(ap.approved_change_orders, 0) AS revised_contract_amount,
      COALESCE(pp.pending_change_orders, 0) AS pending_change_orders,
      COALESCE(dp.draft_change_orders, 0) AS draft_change_orders,
      COALESCE(inv.invoiced_amount, 0) AS invoiced_amount,
      COALESCE(pay.payments_received, 0) AS payments_received,
      CASE WHEN (COALESCE(os.original_contract_amount, 0) + COALESCE(ap.approved_change_orders, 0)) > 0
        THEN round(COALESCE(pay.payments_received, 0) / (COALESCE(os.original_contract_amount, 0) + COALESCE(ap.approved_change_orders, 0)) * 100, 2)
        ELSE 0 END AS percent_paid,
      COALESCE(os.original_contract_amount, 0) + COALESCE(ap.approved_change_orders, 0) - COALESCE(pay.payments_received, 0) AS remaining_balance
    FROM contracts c
    LEFT JOIN original_sov os ON os.contract_id = c.id
    LEFT JOIN approved_pccos ap ON ap.contract_id = c.id
    LEFT JOIN pending_pcos pp ON pp.contract_id = c.id
    LEFT JOIN draft_pcos dp ON dp.contract_id = c.id
    LEFT JOIN invoiced inv ON inv.contract_id = c.id
    LEFT JOIN payments pay ON pay.contract_id = c.id;

  CREATE MATERIALIZED VIEW public.contract_financial_summary_mv AS SELECT * FROM public.contract_financial_summary;

  -- 10. Migrate prospects.client_id
  ALTER TABLE prospects ADD COLUMN client_company_id uuid REFERENCES companies(id);
  UPDATE prospects p SET client_company_id = cl.company_id FROM clients cl WHERE p.client_id = cl.id;
  ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_client_id_fkey;
  ALTER TABLE prospects DROP COLUMN client_id;
  ALTER TABLE prospects RENAME COLUMN client_company_id TO client_id;
  ALTER TABLE prospects ADD CONSTRAINT prospects_client_id_fkey FOREIGN KEY (client_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL;

  -- 11. Drop clients table
  DROP TABLE clients;
END $$;
