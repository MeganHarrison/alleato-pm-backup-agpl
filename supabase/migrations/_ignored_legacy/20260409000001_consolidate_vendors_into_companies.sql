-- Consolidate vendors table into companies table.
-- Procore uses a unified directory — companies ARE vendors.
-- This migration:
--   1. Adds vendor-specific columns to companies
--   2. Migrates vendor row data into their linked company rows
--   3. Updates all FK references that pointed to vendors.id → companies.id
--   4. Drops vendors table

BEGIN;

----------------------------------------------------------------------
-- PART 1: Add vendor columns to companies
----------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS contact_name       text,
  ADD COLUMN IF NOT EXISTS contact_email      text,
  ADD COLUMN IF NOT EXISTS contact_phone      text,
  ADD COLUMN IF NOT EXISTS zip_code           text,
  ADD COLUMN IF NOT EXISTS country            text,
  ADD COLUMN IF NOT EXISTS tax_id             text,
  ADD COLUMN IF NOT EXISTS legal_name         text,
  ADD COLUMN IF NOT EXISTS vendor_class       text,
  ADD COLUMN IF NOT EXISTS terms              text,
  ADD COLUMN IF NOT EXISTS payment_method     text,
  ADD COLUMN IF NOT EXISTS ap_account         text,
  ADD COLUMN IF NOT EXISTS cash_account       text,
  ADD COLUMN IF NOT EXISTS is_1099_vendor     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_foreign_entity  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_labor_union     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_tax_agency      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS acumatica_vendor_id text,
  ADD COLUMN IF NOT EXISTS acumatica_sync_at  timestamptz,
  ADD COLUMN IF NOT EXISTS is_vendor          boolean NOT NULL DEFAULT false;

-- Unique index on acumatica_vendor_id
CREATE UNIQUE INDEX IF NOT EXISTS companies_acumatica_vendor_id_key
  ON companies (acumatica_vendor_id)
  WHERE acumatica_vendor_id IS NOT NULL;

----------------------------------------------------------------------
-- PART 2: Migrate vendor data into companies rows
----------------------------------------------------------------------
UPDATE companies c
SET
  contact_name        = v.contact_name,
  contact_email       = v.contact_email,
  contact_phone       = v.contact_phone,
  address             = COALESCE(NULLIF(c.address, ''), v.address),
  city                = COALESCE(NULLIF(c.city, ''), v.city),
  state               = COALESCE(NULLIF(c.state, ''), v.state),
  zip_code            = v.zip_code,
  country             = v.country,
  notes               = COALESCE(NULLIF(c.notes, ''), v.notes),
  tax_id              = v.tax_id,
  legal_name          = v.legal_name,
  vendor_class        = v.vendor_class,
  terms               = v.terms,
  payment_method      = v.payment_method,
  ap_account          = v.ap_account,
  cash_account        = v.cash_account,
  is_1099_vendor      = COALESCE(v.is_1099_vendor, false),
  is_foreign_entity   = COALESCE(v.is_foreign_entity, false),
  is_labor_union      = COALESCE(v.is_labor_union, false),
  is_tax_agency       = COALESCE(v.is_tax_agency, false),
  acumatica_vendor_id = v.acumatica_vendor_id,
  acumatica_sync_at   = v.acumatica_sync_at,
  is_vendor           = true
FROM vendors v
WHERE v.company_id = c.id;

----------------------------------------------------------------------
-- PART 3: Update FK references from vendors.id → companies.id
----------------------------------------------------------------------

-- 3a. direct_costs.vendor_id
ALTER TABLE direct_costs DROP CONSTRAINT IF EXISTS direct_costs_vendor_id_fkey;

UPDATE direct_costs dc
SET vendor_id = v.company_id
FROM vendors v
WHERE dc.vendor_id = v.id;

ALTER TABLE direct_costs
  ADD CONSTRAINT direct_costs_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES companies(id) ON DELETE SET NULL;

-- 3b. change_event_line_items.vendor_id
ALTER TABLE change_event_line_items DROP CONSTRAINT IF EXISTS change_event_line_items_vendor_id_fkey;

UPDATE change_event_line_items celi
SET vendor_id = v.company_id
FROM vendors v
WHERE celi.vendor_id = v.id;

ALTER TABLE change_event_line_items
  ADD CONSTRAINT change_event_line_items_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES companies(id) ON DELETE SET NULL;

-- 3c. prime_contracts.vendor_id
ALTER TABLE prime_contracts DROP CONSTRAINT IF EXISTS prime_contracts_vendor_id_fkey;

UPDATE prime_contracts pc
SET vendor_id = v.company_id
FROM vendors v
WHERE pc.vendor_id = v.id;

ALTER TABLE prime_contracts
  ADD CONSTRAINT prime_contracts_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES companies(id) ON DELETE SET NULL;

-- 3d. project_vendors.vendor_id → now points to companies
ALTER TABLE project_vendors DROP CONSTRAINT IF EXISTS project_vendors_vendor_id_fkey;
ALTER TABLE project_vendors DROP CONSTRAINT IF EXISTS project_vendors_project_vendor_key;

UPDATE project_vendors pv
SET vendor_id = v.company_id
FROM vendors v
WHERE pv.vendor_id = v.id;

-- Deduplicate: multiple vendor rows may share a company_id, keep only the oldest row per (project_id, vendor_id)
DELETE FROM project_vendors
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY project_id, vendor_id ORDER BY id) AS rn
    FROM project_vendors
  ) ranked
  WHERE rn > 1
);

ALTER TABLE project_vendors
  ADD CONSTRAINT project_vendors_project_vendor_key UNIQUE (project_id, vendor_id);

ALTER TABLE project_vendors
  ADD CONSTRAINT project_vendors_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES companies(id) ON DELETE CASCADE;

-- 3e. vendor_contacts: rename column vendor_id → company_id, retarget FK
ALTER TABLE vendor_contacts DROP CONSTRAINT IF EXISTS vendor_contacts_vendor_id_fkey;
ALTER TABLE vendor_contacts RENAME COLUMN vendor_id TO company_id;

UPDATE vendor_contacts vc
SET company_id = v.company_id
FROM vendors v
WHERE vc.company_id = v.id;

ALTER TABLE vendor_contacts
  ADD CONSTRAINT vendor_contacts_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- 3f. acumatica_subcontracts.vendor_uuid
ALTER TABLE acumatica_subcontracts DROP CONSTRAINT IF EXISTS acumatica_subcontracts_vendor_uuid_fkey;

UPDATE acumatica_subcontracts asub
SET vendor_uuid = v.company_id
FROM vendors v
WHERE asub.vendor_uuid = v.id;

ALTER TABLE acumatica_subcontracts
  ADD CONSTRAINT acumatica_subcontracts_vendor_uuid_fkey
  FOREIGN KEY (vendor_uuid) REFERENCES companies(id) ON DELETE SET NULL;

----------------------------------------------------------------------
-- PART 4: Drop vendors table
----------------------------------------------------------------------
DROP TABLE IF EXISTS vendors CASCADE;

----------------------------------------------------------------------
-- PART 5: Backfill is_vendor for Acumatica-imported companies
----------------------------------------------------------------------
-- Companies imported from Acumatica have type = 'VENDOR' but
-- is_vendor was not set during the initial sync. Backfill now.
UPDATE companies
SET is_vendor = true
WHERE type = 'VENDOR'
  AND is_vendor = false;

COMMIT;
