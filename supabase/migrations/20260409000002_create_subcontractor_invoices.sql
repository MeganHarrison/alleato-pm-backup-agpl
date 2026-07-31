-- Migration: Create subcontractor_invoices and subcontractor_invoice_line_items
-- Subcontractor invoices originate from subcontracts or purchase orders (commitments)

CREATE TABLE IF NOT EXISTS subcontractor_invoices (
  id                  BIGSERIAL PRIMARY KEY,
  project_id          INTEGER       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subcontract_id      UUID          REFERENCES subcontracts(id) ON DELETE SET NULL,
  purchase_order_id   UUID          REFERENCES purchase_orders(id) ON DELETE SET NULL,
  billing_period_id   UUID          REFERENCES billing_periods(id) ON DELETE SET NULL,
  invoice_number      TEXT,
  period_start        DATE,
  period_end          DATE,
  billing_date        DATE,
  status              invoice_status NOT NULL DEFAULT 'draft',
  notes               TEXT,
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Exactly one of subcontract_id or purchase_order_id must be set
  CONSTRAINT chk_commitment_ref CHECK (
    (subcontract_id IS NOT NULL AND purchase_order_id IS NULL)
    OR
    (subcontract_id IS NULL AND purchase_order_id IS NOT NULL)
  )
);
CREATE TABLE IF NOT EXISTS subcontractor_invoice_line_items (
  id                          BIGSERIAL PRIMARY KEY,
  invoice_id                  BIGINT        NOT NULL REFERENCES subcontractor_invoices(id) ON DELETE CASCADE,
  description                 TEXT,
  scheduled_value             NUMERIC(15,2) NOT NULL DEFAULT 0,
  work_completed_previous     NUMERIC(15,2) NOT NULL DEFAULT 0,
  work_completed_period       NUMERIC(15,2) NOT NULL DEFAULT 0,
  work_completed_pct          NUMERIC(6,4)  NOT NULL DEFAULT 0,
  materials_stored            NUMERIC(15,2) NOT NULL DEFAULT 0,
  retainage_pct               NUMERIC(6,4)  NOT NULL DEFAULT 0,
  retainage_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  retainage_released          NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order                  INTEGER       NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Computed columns
  net_amount_this_period NUMERIC(15,2)
    GENERATED ALWAYS AS (work_completed_period + materials_stored - retainage_amount) STORED,
  balance_to_finish NUMERIC(15,2)
    GENERATED ALWAYS AS (scheduled_value - (work_completed_previous + work_completed_period + materials_stored)) STORED,
  total_completed_stored NUMERIC(15,2)
    GENERATED ALWAYS AS (work_completed_previous + work_completed_period + materials_stored) STORED
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_project_id    ON subcontractor_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_subcontract_id ON subcontractor_invoices(subcontract_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_po_id          ON subcontractor_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_billing_period ON subcontractor_invoices(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_status         ON subcontractor_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sub_invoice_line_items_invoice_id     ON subcontractor_invoice_line_items(invoice_id);
-- RLS
ALTER TABLE subcontractor_invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_invoice_line_items  ENABLE ROW LEVEL SECURITY;
-- Authenticated users can read/write (project-level access enforced at API layer)
CREATE POLICY "Authenticated users can manage subcontractor_invoices"
  ON subcontractor_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Authenticated users can manage subcontractor_invoice_line_items"
  ON subcontractor_invoice_line_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
