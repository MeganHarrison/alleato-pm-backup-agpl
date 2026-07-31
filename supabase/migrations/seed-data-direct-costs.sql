-- =============================================================================
-- SEED DATA: Direct Costs Feature
-- =============================================================================
-- This script creates test data for the Direct Costs feature
-- Run this AFTER the 20260110_fix_direct_costs_schema.sql migration

-- =============================================================================
-- PREREQUISITES
-- =============================================================================
-- These must exist in your database:
-- 1. Test user: test1@mail.com (from auth.users)
-- 2. Test project with id = 1 (or adjust project_id below)
-- 3. Vendors table (we'll insert test vendors)
-- 4. Budget lines (we'll reference existing or create dummy budget codes)

-- =============================================================================
-- 1. INSERT TEST VENDORS
-- =============================================================================
-- Note: Adjust based on your vendors table schema
-- This is a simplified version - adjust column names as needed

INSERT INTO vendors (id, name, contact_email, contact_phone, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'ABC Electrical Supply', 'contact@abcelectrical.com', '555-0101', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'BuildMart Lumber', 'sales@buildmart.com', '555-0102', NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Pro Plumbing Supply', 'info@proplumbing.com', '555-0103', NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Steel & Metal Co', 'orders@steelmetal.com', '555-0104', NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'HVAC Distributors Inc', 'service@hvacdist.com', '555-0105', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. GET TEST USER ID
-- =============================================================================
-- We need the user ID for created_by_user_id and updated_by_user_id
-- Assumes test1@mail.com exists in auth.users

DO $$
DECLARE
  test_user_id UUID;
  test_project_id BIGINT := 1; -- Adjust this to your test project ID
BEGIN
  -- Get test user ID
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'test1@mail.com'
  LIMIT 1;

  -- Verify user exists
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'Test user test1@mail.com not found in auth.users';
  END IF;

  -- Verify project exists
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = test_project_id) THEN
    RAISE EXCEPTION 'Test project with id % not found', test_project_id;
  END IF;

  -- =============================================================================
  -- 3. INSERT TEST DIRECT COSTS
  -- =============================================================================

  -- Direct Cost 1: Electrical Invoice (Approved)
  INSERT INTO direct_costs (
    id,
    project_id,
    cost_type,
    date,
    vendor_id,
    invoice_number,
    status,
    description,
    total_amount,
    created_by_user_id,
    updated_by_user_id,
    received_date,
    paid_date
  ) VALUES (
    'dc000001-0001-0001-0001-000000000001'::uuid,
    test_project_id,
    'Invoice',
    '2026-01-05'::date,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'INV-2026-001',
    'Approved',
    'Electrical supplies for Phase 1',
    15750.00,
    test_user_id,
    test_user_id,
    '2026-01-06'::date,
    NULL
  );

  -- Direct Cost 2: Lumber Expense (Paid)
  INSERT INTO direct_costs (
    id,
    project_id,
    cost_type,
    date,
    vendor_id,
    invoice_number,
    status,
    description,
    total_amount,
    created_by_user_id,
    updated_by_user_id,
    received_date,
    paid_date
  ) VALUES (
    'dc000002-0002-0002-0002-000000000002'::uuid,
    test_project_id,
    'Expense',
    '2026-01-03'::date,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'INV-2026-002',
    'Paid',
    'Lumber and framing materials',
    8450.50,
    test_user_id,
    test_user_id,
    '2026-01-04'::date,
    '2026-01-08'::date
  );

  -- Direct Cost 3: Plumbing Invoice (Draft)
  INSERT INTO direct_costs (
    id,
    project_id,
    cost_type,
    date,
    vendor_id,
    invoice_number,
    status,
    description,
    total_amount,
    created_by_user_id,
    updated_by_user_id,
    received_date
  ) VALUES (
    'dc000003-0003-0003-0003-000000000003'::uuid,
    test_project_id,
    'Invoice',
    '2026-01-08'::date,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'INV-2026-003',
    'Draft',
    'Plumbing fixtures and supplies',
    12300.75,
    test_user_id,
    test_user_id,
    '2026-01-09'::date
  );

  -- Direct Cost 4: Metal Work (Approved)
  INSERT INTO direct_costs (
    id,
    project_id,
    cost_type,
    date,
    vendor_id,
    invoice_number,
    status,
    description,
    total_amount,
    created_by_user_id,
    updated_by_user_id,
    received_date
  ) VALUES (
    'dc000004-0004-0004-0004-000000000004'::uuid,
    test_project_id,
    'Subcontractor Invoice',
    '2026-01-07'::date,
    '44444444-4444-4444-4444-444444444444'::uuid,
    'INV-2026-004',
    'Approved',
    'Structural steel fabrication',
    25600.00,
    test_user_id,
    test_user_id,
    '2026-01-07'::date
  );

  -- Direct Cost 5: HVAC Equipment (Paid)
  INSERT INTO direct_costs (
    id,
    project_id,
    cost_type,
    date,
    vendor_id,
    invoice_number,
    status,
    description,
    total_amount,
    created_by_user_id,
    updated_by_user_id,
    received_date,
    paid_date
  ) VALUES (
    'dc000005-0005-0005-0005-000000000005'::uuid,
    test_project_id,
    'Invoice',
    '2025-12-28'::date,
    '55555555-5555-5555-5555-555555555555'::uuid,
    'INV-2025-999',
    'Paid',
    'HVAC units and ductwork',
    34200.00,
    test_user_id,
    test_user_id,
    '2025-12-29'::date,
    '2026-01-02'::date
  );

  -- =============================================================================
  -- 4. INSERT TEST LINE ITEMS
  -- =============================================================================
  -- Note: budget_code_id is UUID - you'll need to get actual budget code IDs
  -- For this seed data, we'll use placeholder UUIDs
  -- In production, query budget_lines or budget_codes table for real IDs

  -- Line items for Direct Cost 1 (Electrical)
  INSERT INTO direct_cost_line_items (
    id, direct_cost_id, budget_code_id, description,
    quantity, uom, unit_cost, line_order
  ) VALUES
    (gen_random_uuid(), 'dc000001-0001-0001-0001-000000000001'::uuid, gen_random_uuid(), 'Wire - 12/2 Romex', 1500, 'FT', 1.25, 1),
    (gen_random_uuid(), 'dc000001-0001-0001-0001-000000000001'::uuid, gen_random_uuid(), 'Circuit Breakers - 20A', 45, 'EA', 12.50, 2),
    (gen_random_uuid(), 'dc000001-0001-0001-0001-000000000001'::uuid, gen_random_uuid(), 'Conduit - 3/4" EMT', 800, 'FT', 2.85, 3),
    (gen_random_uuid(), 'dc000001-0001-0001-0001-000000000001'::uuid, gen_random_uuid(), 'Junction Boxes', 120, 'EA', 8.75, 4);

  -- Line items for Direct Cost 2 (Lumber)
  INSERT INTO direct_cost_line_items (
    id, direct_cost_id, budget_code_id, description,
    quantity, uom, unit_cost, line_order
  ) VALUES
    (gen_random_uuid(), 'dc000002-0002-0002-0002-000000000002'::uuid, gen_random_uuid(), '2x4x8 Studs', 250, 'EA', 6.50, 1),
    (gen_random_uuid(), 'dc000002-0002-0002-0002-000000000002'::uuid, gen_random_uuid(), '2x6x12 Joists', 180, 'EA', 14.75, 2),
    (gen_random_uuid(), 'dc000002-0002-0002-0002-000000000002'::uuid, gen_random_uuid(), '4x8 Plywood Sheets', 95, 'EA', 42.00, 3);

  -- Line items for Direct Cost 3 (Plumbing)
  INSERT INTO direct_cost_line_items (
    id, direct_cost_id, budget_code_id, description,
    quantity, uom, unit_cost, line_order
  ) VALUES
    (gen_random_uuid(), 'dc000003-0003-0003-0003-000000000003'::uuid, gen_random_uuid(), 'Copper Pipe - 3/4"', 500, 'FT', 4.25, 1),
    (gen_random_uuid(), 'dc000003-0003-0003-0003-000000000003'::uuid, gen_random_uuid(), 'PVC Pipe - 4"', 300, 'FT', 3.50, 2),
    (gen_random_uuid(), 'dc000003-0003-0003-0003-000000000003'::uuid, gen_random_uuid(), 'Fixtures - Toilets', 12, 'EA', 285.00, 3),
    (gen_random_uuid(), 'dc000003-0003-0003-0003-000000000003'::uuid, gen_random_uuid(), 'Fixtures - Sinks', 18, 'EA', 195.50, 4);

  -- Line items for Direct Cost 4 (Metal Work)
  INSERT INTO direct_cost_line_items (
    id, direct_cost_id, budget_code_id, description,
    quantity, uom, unit_cost, line_order
  ) VALUES
    (gen_random_uuid(), 'dc000004-0004-0004-0004-000000000004'::uuid, gen_random_uuid(), 'W12x26 Steel Beams', 24, 'EA', 650.00, 1),
    (gen_random_uuid(), 'dc000004-0004-0004-0004-000000000004'::uuid, gen_random_uuid(), 'Steel Columns', 16, 'EA', 425.00, 2),
    (gen_random_uuid(), 'dc000004-0004-0004-0004-000000000004'::uuid, gen_random_uuid(), 'Steel Plates', 45, 'EA', 125.00, 3);

  -- Line items for Direct Cost 5 (HVAC)
  INSERT INTO direct_cost_line_items (
    id, direct_cost_id, budget_code_id, description,
    quantity, uom, unit_cost, line_order
  ) VALUES
    (gen_random_uuid(), 'dc000005-0005-0005-0005-000000000005'::uuid, gen_random_uuid(), 'HVAC Unit - 5 Ton', 8, 'EA', 2850.00, 1),
    (gen_random_uuid(), 'dc000005-0005-0005-0005-000000000005'::uuid, gen_random_uuid(), 'Ductwork - Galvanized', 1200, 'FT', 8.50, 2),
    (gen_random_uuid(), 'dc000005-0005-0005-0005-000000000005'::uuid, gen_random_uuid(), 'Thermostats', 24, 'EA', 145.00, 3);

  RAISE NOTICE 'Seed data created successfully';
  RAISE NOTICE 'Test user ID: %', test_user_id;
  RAISE NOTICE 'Test project ID: %', test_project_id;
  RAISE NOTICE 'Created 5 direct costs with % total line items', (
    SELECT COUNT(*) FROM direct_cost_line_items
    WHERE direct_cost_id IN (
      'dc000001-0001-0001-0001-000000000001'::uuid,
      'dc000002-0002-0002-0002-000000000002'::uuid,
      'dc000003-0003-0003-0003-000000000003'::uuid,
      'dc000004-0004-0004-0004-000000000004'::uuid,
      'dc000005-0005-0005-0005-000000000005'::uuid
    )
  );

END $$;

-- =============================================================================
-- 5. VERIFICATION QUERIES
-- =============================================================================

-- Verify direct costs
SELECT
  id,
  invoice_number,
  cost_type,
  status,
  total_amount,
  date
FROM direct_costs
WHERE project_id = 1
ORDER BY date DESC;

-- Verify line items
SELECT
  dc.invoice_number,
  dcli.description,
  dcli.quantity,
  dcli.uom,
  dcli.unit_cost,
  dcli.line_total
FROM direct_cost_line_items dcli
JOIN direct_costs dc ON dc.id = dcli.direct_cost_id
WHERE dc.project_id = 1
ORDER BY dc.date DESC, dcli.line_order;

-- Verify totals using view
SELECT
  invoice_number,
  vendor_name,
  cost_type,
  status,
  line_item_count,
  total_amount,
  calculated_total
FROM direct_costs_with_details
WHERE project_id = 1
ORDER BY date DESC;
