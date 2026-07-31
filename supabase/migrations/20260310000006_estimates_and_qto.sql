-- =============================================================================
-- Estimates & Quantity Takeoff System
-- Digitizes Alleato's Excel-based estimate/QTO workbook
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. estimates — The estimate document
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimates (
  estimate_id    SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  estimate_number TEXT,
  revision       INTEGER NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
  estimate_date  DATE,
  location       TEXT,
  estimator      TEXT,
  project_duration_weeks INTEGER,
  contingency_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  insurance_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0125,
  fee_rate       NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES auth.users(id),
  is_deleted     BOOLEAN NOT NULL DEFAULT false
);
-- Index for project-scoped queries
CREATE INDEX idx_estimates_project_id ON estimates(project_id) WHERE NOT is_deleted;
CREATE INDEX idx_estimates_status ON estimates(status) WHERE NOT is_deleted;
-- Auto-update updated_at
CREATE TRIGGER set_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- -----------------------------------------------------------------------------
-- 2. estimate_line_items — QTO line items with 4 cost categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimate_line_items (
  line_item_id   SERIAL PRIMARY KEY,
  estimate_id    INTEGER NOT NULL REFERENCES estimates(estimate_id) ON DELETE CASCADE,
  line_number    INTEGER,
  division_code  TEXT NOT NULL,
  description    TEXT,

  -- Dimensions
  length         NUMERIC(15,4),
  width          NUMERIC(15,4),
  depth          NUMERIC(15,4),
  number_of_each NUMERIC(15,4),
  quantity       NUMERIC(15,4),
  unit           TEXT,

  -- Material costs
  material_unit_price NUMERIC(15,2) DEFAULT 0,
  material_cost       NUMERIC(15,2) DEFAULT 0,

  -- Labor costs
  labor_crew_size  NUMERIC(8,2),
  labor_hours      NUMERIC(8,2),
  labor_man_hours  NUMERIC(10,2) DEFAULT 0,
  labor_rate       NUMERIC(10,2),
  labor_cost       NUMERIC(15,2) DEFAULT 0,

  -- Equipment costs
  equipment_duration NUMERIC(10,2),
  equipment_unit     TEXT,
  equipment_rate     NUMERIC(10,2),
  equipment_cost     NUMERIC(15,2) DEFAULT 0,

  -- Subcontract costs
  subcontract_unit_price NUMERIC(15,2) DEFAULT 0,
  subcontract_cost       NUMERIC(15,2) DEFAULT 0,

  -- Total (sum of 4 categories)
  total_cost     NUMERIC(15,2) DEFAULT 0,

  -- Metadata
  comments       TEXT,
  comment_type   TEXT CHECK (comment_type IS NULL OR comment_type IN (
                   'plug_number', 'vendor', 'included_in', 'internal',
                   'allowance', 'swag', 'excluded'
                 )),
  vendor_name    TEXT,
  gc_cost_code   TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Indexes for efficient queries
CREATE INDEX idx_estimate_line_items_estimate_id ON estimate_line_items(estimate_id);
CREATE INDEX idx_estimate_line_items_division ON estimate_line_items(estimate_id, division_code);
CREATE INDEX idx_estimate_line_items_sort ON estimate_line_items(estimate_id, sort_order);
-- Auto-update updated_at
CREATE TRIGGER set_estimate_line_items_updated_at
  BEFORE UPDATE ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- -----------------------------------------------------------------------------
-- 3. estimate_alternates — Add/deduct alternates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimate_alternates (
  alternate_id     SERIAL PRIMARY KEY,
  estimate_id      INTEGER NOT NULL REFERENCES estimates(estimate_id) ON DELETE CASCADE,
  alternate_number INTEGER NOT NULL,
  description      TEXT NOT NULL,
  amount           NUMERIC(15,2) NOT NULL DEFAULT 0,
  alternate_type   TEXT NOT NULL DEFAULT 'add'
                     CHECK (alternate_type IN ('add', 'deduct')),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimate_alternates_estimate_id ON estimate_alternates(estimate_id);
-- -----------------------------------------------------------------------------
-- 4. estimate_allowances — Allowance schedule
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimate_allowances (
  allowance_id     SERIAL PRIMARY KEY,
  estimate_id      INTEGER NOT NULL REFERENCES estimates(estimate_id) ON DELETE CASCADE,
  allowance_number INTEGER NOT NULL,
  description      TEXT NOT NULL,
  amount           NUMERIC(15,2) NOT NULL DEFAULT 0,
  scope_type       TEXT CHECK (scope_type IS NULL OR scope_type IN (
                     'material_and_labor', 'material_only', 'labor_only'
                   )),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimate_allowances_estimate_id ON estimate_allowances(estimate_id);
-- -----------------------------------------------------------------------------
-- 5. View: Division totals for summary display
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_estimate_division_totals AS
SELECT
  eli.estimate_id,
  eli.division_code,
  COALESCE(ccd.title, 'Division ' || eli.division_code) AS division_name,
  SUM(COALESCE(eli.material_cost, 0))    AS material_total,
  SUM(COALESCE(eli.labor_cost, 0))       AS labor_total,
  SUM(COALESCE(eli.equipment_cost, 0))   AS equipment_total,
  SUM(COALESCE(eli.subcontract_cost, 0)) AS subcontract_total,
  SUM(COALESCE(eli.total_cost, 0))       AS division_total,
  COUNT(*)                                AS line_count
FROM estimate_line_items eli
LEFT JOIN cost_code_divisions ccd ON ccd.code = eli.division_code
GROUP BY eli.estimate_id, eli.division_code, ccd.title
ORDER BY eli.division_code;
-- -----------------------------------------------------------------------------
-- 6. RLS Policies
-- -----------------------------------------------------------------------------
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_alternates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_allowances ENABLE ROW LEVEL SECURITY;
-- Authenticated users can do everything (same pattern as other tables)
CREATE POLICY "Authenticated users can view estimates"
  ON estimates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert estimates"
  ON estimates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update estimates"
  ON estimates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete estimates"
  ON estimates FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can view estimate_line_items"
  ON estimate_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert estimate_line_items"
  ON estimate_line_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update estimate_line_items"
  ON estimate_line_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete estimate_line_items"
  ON estimate_line_items FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can view estimate_alternates"
  ON estimate_alternates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert estimate_alternates"
  ON estimate_alternates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update estimate_alternates"
  ON estimate_alternates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete estimate_alternates"
  ON estimate_alternates FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can view estimate_allowances"
  ON estimate_allowances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert estimate_allowances"
  ON estimate_allowances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update estimate_allowances"
  ON estimate_allowances FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete estimate_allowances"
  ON estimate_allowances FOR DELETE TO authenticated USING (true);
