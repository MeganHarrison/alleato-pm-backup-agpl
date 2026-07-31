-- Add estimate V2 supporting tables.
-- Recovered from the linked Supabase migration ledger so local migration
-- history matches the already-applied production migration.

-- Add months field to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS project_duration_months NUMERIC;

-- Table 1: New-format General Conditions line items
CREATE TABLE IF NOT EXISTS estimate_gc_items (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(estimate_id) ON DELETE CASCADE,
  cost_code TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cost_type TEXT NOT NULL DEFAULT 'Expense' CHECK (cost_type IN ('Revenue', 'Labor', 'Expense', 'Subcontract')),
  qty NUMERIC DEFAULT 0,
  qty_basis TEXT DEFAULT 'custom' CHECK (qty_basis IN ('weeks', 'months', 'ls', 'sf', 'ea', 'lf', 'custom')),
  unit TEXT DEFAULT 'LS',
  rate NUMERIC DEFAULT 0,
  allocation NUMERIC DEFAULT 0 CHECK (allocation >= 0 AND allocation <= 1),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: Details tab line items (CSI divisions 02-51)
CREATE TABLE IF NOT EXISTS estimate_detail_items (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(estimate_id) ON DELETE CASCADE,
  division_code TEXT NOT NULL DEFAULT '',
  division_name TEXT NOT NULL DEFAULT '',
  cost_code TEXT DEFAULT '',
  cost_type TEXT DEFAULT '' CHECK (cost_type IN ('', 'Labor', 'Expense', 'Subcontract', 'Revenue')),
  cost_code_name TEXT DEFAULT '',
  work_description TEXT DEFAULT '',
  estimated_amount NUMERIC DEFAULT 0,
  sub_name TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: SubList tab - subcontractor tracking
CREATE TABLE IF NOT EXISTS estimate_sublist_subs (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(estimate_id) ON DELETE CASCADE,
  division_code TEXT NOT NULL DEFAULT '',
  division_name TEXT NOT NULL DEFAULT '',
  position INTEGER DEFAULT 1 CHECK (position BETWEEN 1 AND 5),
  company TEXT DEFAULT '',
  intend_to_submit TEXT DEFAULT '' CHECK (intend_to_submit IN ('', 'Yes', 'No')),
  email_sent TEXT DEFAULT '' CHECK (email_sent IN ('', 'Yes', 'No', 'Other')),
  phone_follow_up TEXT DEFAULT '' CHECK (phone_follow_up IN ('', 'Yes', 'No', 'Voicemail')),
  bid_received TEXT DEFAULT '' CHECK (bid_received IN ('', 'Yes', 'No', 'Other')),
  contact_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  cell TEXT DEFAULT '',
  price NUMERIC,
  comments TEXT DEFAULT '',
  scope_1 TEXT DEFAULT '',
  scope_2 TEXT DEFAULT '',
  scope_3 TEXT DEFAULT '',
  scope_4 TEXT DEFAULT '',
  scope_5 TEXT DEFAULT '',
  scope_6 TEXT DEFAULT '',
  scope_7 TEXT DEFAULT '',
  scope_8 TEXT DEFAULT '',
  scope_9 TEXT DEFAULT '',
  scope_10 TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast per-estimate queries
CREATE INDEX IF NOT EXISTS idx_estimate_gc_items_estimate_id ON estimate_gc_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_detail_items_estimate_id ON estimate_detail_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_sublist_subs_estimate_id ON estimate_sublist_subs(estimate_id);

-- RLS: match existing estimate tables pattern
ALTER TABLE estimate_gc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_detail_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_sublist_subs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage estimate_gc_items"
  ON estimate_gc_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage estimate_detail_items"
  ON estimate_detail_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage estimate_sublist_subs"
  ON estimate_sublist_subs FOR ALL TO authenticated USING (true) WITH CHECK (true);
