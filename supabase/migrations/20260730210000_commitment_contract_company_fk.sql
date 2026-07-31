-- Commitments: enforce contract_company_id -> companies.id
--
-- WHY: subcontracts.contract_company_id and purchase_orders.contract_company_id are
-- the vendor/contract-company reference shown on every commitment, but neither column
-- had a foreign key constraint. Nothing stopped a dangling uuid from being written, and
-- 62 commitments (48 subcontracts + 14 purchase orders) ended up pointing at companies
-- that do not exist. On those records the vendor renders blank in the commitments table
-- and on the detail page, and the vendor dropdown shows a placeholder on edit — with no
-- error anywhere. Audited 2026-07-30, see docs/reports/fk-audit-2026-07-30.md.
--
-- The dangling ids are not recoverable from inside the database: they match no row in
-- companies, people, project_vendors, project_companies or vendor_contacts. Rather than
-- discard them, this migration parks them in an audit table so the reference can still
-- be traced back to its source system, then nulls the column so the rows are editable
-- and the constraint can be validated.

-- 1. Preserve every dangling reference before clearing it.
CREATE TABLE IF NOT EXISTS public.commitment_company_id_orphans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table        text        NOT NULL CHECK (source_table IN ('subcontracts', 'purchase_orders')),
  commitment_id       uuid        NOT NULL,
  project_id          integer,
  contract_number     text,
  title               text,
  orphaned_company_id uuid        NOT NULL,
  detected_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commitment_company_id_orphans IS
  'Dangling contract_company_id values cleared from subcontracts/purchase_orders when the '
  'companies FK was added (2026-07-30). Retained so the vendor can be re-identified from '
  'the source system. Safe to drop once every row has been reconciled.';

CREATE INDEX IF NOT EXISTS commitment_company_id_orphans_commitment_idx
  ON public.commitment_company_id_orphans (source_table, commitment_id);

INSERT INTO public.commitment_company_id_orphans
  (source_table, commitment_id, project_id, contract_number, title, orphaned_company_id)
SELECT 'subcontracts', s.id, s.project_id, s.contract_number, s.title, s.contract_company_id
FROM public.subcontracts s
WHERE s.contract_company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = s.contract_company_id);

INSERT INTO public.commitment_company_id_orphans
  (source_table, commitment_id, project_id, contract_number, title, orphaned_company_id)
SELECT 'purchase_orders', p.id, p.project_id, p.contract_number, p.title, p.contract_company_id
FROM public.purchase_orders p
WHERE p.contract_company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p.contract_company_id);

-- 2. Clear the dangling references (now safely recorded above).
UPDATE public.subcontracts s
SET contract_company_id = NULL
WHERE s.contract_company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = s.contract_company_id);

UPDATE public.purchase_orders p
SET contract_company_id = NULL
WHERE p.contract_company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p.contract_company_id);

-- 3. Close the hole. ON DELETE SET NULL matches the existing behaviour of the other
--    company-referencing columns on purchase_orders (bill_to_company_id, ship_to_company_id)
--    and keeps deleting a company from cascading into financial records.
ALTER TABLE public.subcontracts
  DROP CONSTRAINT IF EXISTS subcontracts_contract_company_id_fkey;
ALTER TABLE public.subcontracts
  ADD CONSTRAINT subcontracts_contract_company_id_fkey
  FOREIGN KEY (contract_company_id) REFERENCES public.companies (id) ON DELETE SET NULL;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_contract_company_id_fkey;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_contract_company_id_fkey
  FOREIGN KEY (contract_company_id) REFERENCES public.companies (id) ON DELETE SET NULL;

-- 4. Supporting indexes for the new FKs (Postgres does not create these automatically).
CREATE INDEX IF NOT EXISTS subcontracts_contract_company_id_idx
  ON public.subcontracts (contract_company_id);
CREATE INDEX IF NOT EXISTS purchase_orders_contract_company_id_idx
  ON public.purchase_orders (contract_company_id);
