-- Migration: Seed Change Orders test scenarios
-- Generated: 2026-04-08
-- Suite: change-orders / Change Orders
-- Cases: 13

-- ---------------------------------------------------------------------------
-- 1. Upsert the test suite
-- ---------------------------------------------------------------------------
INSERT INTO test_suites (id, tool_name, display_name, source_doc_count, total_cases, created_at, last_generated_at)
VALUES (
  gen_random_uuid(),
  'change-orders',
  'Change Orders',
  3,
  0,
  now(),
  now()
)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name        = EXCLUDED.display_name,
  last_generated_at   = now();
-- ---------------------------------------------------------------------------
-- 2. Insert test cases
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_suite_id uuid;
BEGIN
  SELECT id INTO v_suite_id FROM test_suites WHERE tool_name = 'change-orders';

  -- Clean re-seed
  DELETE FROM test_cases WHERE suite_id = v_suite_id;

  -- 1.1 Navigation: Open the Change Orders page
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '1.1', 'Navigation', NULL,
    'Open the Change Orders page',
    E'1. Make sure you are logged in as test1@mail.com\n2. Navigate to /767/change-orders\n3. Wait for the page to finish loading',
    'The page loads fully. A table of change orders is visible with columns for #, Title, Status, Amount, and Contract Company. Two tabs are visible: "Prime Contract" and "Commitments". No error messages appear.',
    'HIGH', 'feature', '/767/change-orders', NULL, NULL, now(), now());

  -- 1.2 Navigation: Switch between tabs
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '1.2', 'Navigation', NULL,
    'Switch between Prime Contract and Commitments tabs',
    E'1. Open the Change Orders page at /767/change-orders\n2. Click the "Commitments" tab\n3. Wait for the table to reload\n4. Click the "Prime Contract" tab',
    'Clicking "Commitments" loads the commitments change orders table. The URL updates to include ?tab=commitment. Clicking "Prime Contract" switches back to the prime list. No errors appear on either tab.',
    'HIGH', 'feature', '/767/change-orders', NULL, NULL, now(), now());

  -- 1.3 Navigation: Open a detail page
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '1.3', 'Navigation', NULL,
    'Open a prime contract change order detail page',
    E'1. Open the Change Orders page\n2. Make sure the "Prime Contract" tab is selected\n3. Click on the title of any change order in the list',
    'The detail page opens at /767/change-orders/prime/{id}. The change order title, PCCO number, status badge, and amount are displayed. Tabs are visible (Details, Line Items, Attachments). No error messages appear.',
    'HIGH', 'feature', '/767/change-orders', 'The Prime Contract tab must have at least one existing record.', NULL, now(), now());

  -- 2.1 Create: Prime contract CO
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '2.1', 'Create', 'Prime Contract',
    'Create a new prime contract change order',
    E'1. Open the Change Orders page at /767/change-orders\n2. Click the "New Change Order" button (top right)\n3. In the "PCCO Number" field, type: 001776\n4. In the "Title" field, type: Test PCCO from Scenario\n5. Leave Status as "Proposed"\n6. In the "Amount ($)" field, type: 15000\n7. Click the "Create" button\n8. Wait for the page to stop loading',
    'The new change order is created and the page navigates to the detail view. The PCCO number "001776", title "Test PCCO from Scenario", status "Proposed", and amount "$15,000.00" are all shown correctly. A success toast appears briefly.',
    'HIGH', 'feature', '/767/change-orders', NULL, NULL, now(), now());

  -- 2.2 Create: Validation failure
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '2.2', 'Create', 'Prime Contract',
    'Create fails when PCCO Number or Title is missing',
    E'1. Open the Change Orders page\n2. Click the "New Change Order" button\n3. Leave both "PCCO Number" and "Title" fields empty\n4. Click the "Create" button',
    'Error messages appear below the PCCO Number and Title fields (e.g. "PCCO number is required", "Title is required"). The record is NOT created. The form stays open.',
    'HIGH', 'feature', '/767/change-orders', NULL, NULL, now(), now());

  -- 2.3 Create: Commitment CO
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '2.3', 'Create', 'Commitment',
    'Create a new commitment change order',
    E'1. Open /767/change-orders?tab=commitment\n2. Click the "New Change Order" button\n3. Select a contract from the "Contract" dropdown\n4. In the "CO Number" field, type: 001816\n5. In the "Description" field, type: Test Commitment CO from Scenario\n6. In the "Amount ($)" field, type: 5000\n7. Click the "Create" button\n8. Wait for the page to stop loading',
    'The new commitment change order is created and the detail page opens. The CO number "001816", description "Test Commitment CO from Scenario", and amount "$5,000.00" are all shown. A success toast appears briefly.',
    'HIGH', 'feature', '/767/change-orders?tab=commitment', 'At least one contract must exist in the project for the Contract dropdown to have options.', NULL, now(), now());

  -- 3.1 Edit: title and amount
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '3.1', 'Edit', NULL,
    'Edit the title and amount of an existing prime contract change order',
    E'1. Open a prime contract change order detail page\n2. Click the "Edit" button\n3. Change the Title to: Updated PCCO Title Test\n4. Change the Amount to: 20000\n5. Click "Save"\n6. Wait for the page to stop loading',
    'The detail page now shows the title "Updated PCCO Title Test" and amount "$20,000.00". A success toast appears briefly. The old values are no longer shown.',
    'HIGH', 'feature', '/767/change-orders', NULL, 'Create a prime contract change order first (scenario 2.1).', now(), now());

  -- 3.2 Edit: persist after refresh
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '3.2', 'Edit', NULL,
    'Saved edits persist after page refresh',
    E'1. Complete scenario 3.1 (edit and save a change order)\n2. Stay on the detail page\n3. Press Ctrl+R (or Cmd+R on Mac) to refresh the browser\n4. Wait for the page to reload',
    'The updated title "Updated PCCO Title Test" and amount "$20,000.00" are still shown after the refresh. No data reverted to the original values.',
    'HIGH', 'feature', '/767/change-orders', NULL, 'Complete scenario 3.1 first.', now(), now());

  -- 4.1 Delete
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '4.1', 'Delete', NULL,
    'Delete a prime contract change order',
    E'1. Open the Change Orders page\n2. Find the row titled "Test PCCO from Scenario" in the Prime Contract tab\n3. Click the three-dot menu (⋯) on that row\n4. Click "Delete"\n5. Confirm the deletion in the dialog that appears\n6. Wait for the page to reload',
    'The record "Test PCCO from Scenario" is no longer visible in the list. A success toast ("Change order deleted") appears briefly.',
    'HIGH', 'feature', '/767/change-orders', NULL, 'Create a prime contract change order named "Test PCCO from Scenario" (scenario 2.1).', now(), now());

  -- 5.1 Status/Workflow: Approve
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '5.1', 'Status / Workflow', NULL,
    'Approve a proposed prime contract change order',
    E'1. Open a prime contract change order with status "Proposed"\n2. Click the "Edit" button\n3. In the "Status" dropdown, select "Approved"\n4. Click "Save"\n5. Wait for the page to stop loading',
    'The status badge now shows "Approved" in green. No error messages appear. The change is saved and visible after refresh.',
    'HIGH', 'feature', '/767/change-orders', NULL, 'A prime contract change order with status "Proposed" must exist.', now(), now());

  -- 5.2 Status/Workflow: Reject
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '5.2', 'Status / Workflow', NULL,
    'Reject a proposed prime contract change order',
    E'1. Open a prime contract change order with status "Proposed"\n2. Click the "Edit" button\n3. In the "Status" dropdown, select "Rejected"\n4. Click "Save"\n5. Wait for the page to stop loading',
    'The status badge now shows "Rejected". The change is saved. No error messages appear.',
    'MEDIUM', 'feature', '/767/change-orders', NULL, 'A prime contract change order with status "Proposed" must exist.', now(), now());

  -- 6.1 Filter/Search: Search by title
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '6.1', 'Filter / Search', NULL,
    'Search prime contract change orders by title',
    E'1. Open the Change Orders page at /767/change-orders\n2. Make sure the "Prime Contract" tab is selected\n3. Click the search box (shows "Search prime contract COs...")\n4. Type part of a known change order title, e.g. Test PCCO\n5. Wait for the list to filter',
    'The list narrows to show only records whose title or PCCO number contains "Test PCCO". Records with unrelated titles are hidden. Clearing the search box brings all records back.',
    'MEDIUM', 'feature', '/767/change-orders', 'The Prime Contract list must have at least two records with different titles.', NULL, now(), now());

  -- 6.2 Filter/Search: Filter by status
  INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
  VALUES (gen_random_uuid(), v_suite_id, '6.2', 'Filter / Search', NULL,
    'Filter prime contract change orders by status',
    E'1. Open the Change Orders page at /767/change-orders\n2. Click the "Filters" button in the toolbar\n3. In the Status filter, select "Approved"\n4. Wait for the list to update',
    'Only change orders with status "Approved" are shown. The record count in the toolbar updates to reflect the filtered results. Clearing the filter brings all records back.',
    'MEDIUM', 'feature', '/767/change-orders', 'At least one Approved and one non-Approved prime contract change order must exist.', NULL, now(), now());

END $$;
-- ---------------------------------------------------------------------------
-- 3. Update total_cases count
-- ---------------------------------------------------------------------------
UPDATE test_suites
SET total_cases = (
  SELECT COUNT(*) FROM test_cases
  WHERE suite_id = (SELECT id FROM test_suites WHERE tool_name = 'change-orders')
)
WHERE tool_name = 'change-orders';
