-- ============================================================================
-- Seed: Direct Costs Test Scenarios
-- Generated: 2026-04-08
-- Suite: direct-costs
-- Type: scenario (plain-English guided tests for non-technical testers)
-- Runner: http://localhost:3000/testing
-- 26 scenarios across 10 categories
-- ============================================================================

-- Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('direct-costs', 'Direct Costs', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Insert all scenarios
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'direct-costs')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

  -- ── 1. Navigation ──────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the Direct Costs page',
   'Checks that the Direct Costs list page loads without errors and shows the data table. A direct cost is a project expense paid directly — like buying materials from a store, renting equipment, or logging labor — not through a subcontract.',
   NULL,
   E'1. Make sure you are logged in as test1@mail.com\n2. In the left sidebar, click "Direct Costs" under project "Alleato AI"\n3. Wait for the page to stop loading',
   'The page loads fully. A table is visible with columns for Date, Vendor, Type, Invoice #, Status, and Amount. No error messages appear. The page title says "Direct Costs".',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '1.2', 'Navigation', 'View toggle',
   'Switch between Summary and Cost Code views',
   'Checks that the two views — the default summary list and the cost code hierarchy view — both load correctly.',
   NULL,
   E'1. Open the Direct Costs page\n2. Click the "Cost Code" or "By Cost Code" view toggle in the toolbar\n3. Note the layout change\n4. Click back to the default "Summary" view',
   'The Cost Code view shows records grouped by budget code/division. Switching back to Summary shows the flat list again. No errors appear in either view.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '1.3', 'Navigation', 'Detail view',
   'Open a direct cost detail page',
   'Checks that clicking a row opens the full detail page for that cost record.',
   'The Direct Costs list must have at least one existing record.',
   E'1. Open the Direct Costs page\n2. Click on any row in the table\n3. Wait for the page to finish loading',
   'The detail page opens. The vendor name, date, invoice number, status, and amount are displayed. A line items table shows the individual cost breakdowns. No error messages appear.',
   'HIGH', 'scenario', '/767/direct-costs'),

  -- ── 2. Create ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '2.1', 'Create', 'Basic creation',
   'Create a new direct cost with required fields',
   'Checks that a user can create a new direct cost record and that it saves correctly and appears in the list.',
   NULL,
   E'1. Click the "Add Direct Cost" button (top right of the page)\n2. In the Description field, type: Test Direct Cost\n3. In the Amount field, type: 5000\n4. Set the Date to today''s date\n5. In the Type dropdown, select Materials\n6. Click Save\n7. Wait for the page to stop loading',
   'A success message (toast) appears briefly. The new record "Test Direct Cost" appears in the list with an amount of $5,000.00. No error messages are shown.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '2.2', 'Create', 'All fields',
   'Create a direct cost with every field filled in',
   'Checks that all optional fields — vendor, invoice number, received date, paid date — save correctly.',
   NULL,
   E'1. Click "Add Direct Cost"\n2. Set Description: Full Fields Direct Cost\n3. Set Amount: 2500\n4. Set Type: Equipment\n5. Set Status: Pending\n6. In the Vendor field, select or type any available vendor\n7. In the Invoice # field, type: INV-TEST-001\n8. Set the Received Date to today\n9. Click Save',
   'All fields appear correctly on the detail page. Invoice # shows "INV-TEST-001", vendor shows the selected vendor, and the status shows "Pending".',
   'MEDIUM', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '2.3', 'Create', 'Validation',
   'Submitting without required fields shows an error',
   'Checks that the form prevents saving when required fields like Amount or Date are left blank, so incomplete records cannot be created.',
   NULL,
   E'1. Click "Add Direct Cost"\n2. Leave the Amount field completely empty\n3. Leave the Date field empty\n4. Click Save',
   'Red error messages appear near the required fields saying they are required. The form does not save and does not navigate away. No new record is created.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '2.4', 'Create', 'Cancel',
   'Canceling create does not save anything',
   'Checks that pressing Cancel on the create form goes back without creating any record.',
   NULL,
   E'1. Click "Add Direct Cost"\n2. Fill in Description: Should Not Be Saved\n3. Fill in Amount: 9999\n4. Click the Cancel or X button to close the form',
   'The form closes. No new record named "Should Not Be Saved" appears in the list. The list is unchanged.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '2.5', 'Create', 'With line items',
   'Create a direct cost with a cost line item',
   'Checks that when you add a line item (a breakdown of the cost by budget code) during creation, it is saved and the total is correct.',
   'A budget code must exist in the project.',
   E'1. Click "Add Direct Cost"\n2. Fill in Description: Labor with Line Item and Amount: 3000\n3. Set Type: Labor\n4. Click "Add Line Item" inside the form\n5. In the line item Description field, type: Site Labor\n6. Enter Quantity: 8, Unit Cost: 375\n7. Click Save on the form',
   'The direct cost is created. On the detail page, the line item "Site Labor" appears with quantity 8, unit cost $375, and line total $3,000. The total amount matches. No error is shown.',
   'HIGH', 'scenario', '/767/direct-costs'),

  -- ── 3. Edit ────────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '3.1', 'Edit', 'Basic edit',
   'Edit the description and amount of an existing direct cost',
   'Checks that changes made in the edit form are saved and displayed correctly after saving.',
   'There must be at least one existing direct cost record.',
   E'1. Open the Direct Costs page\n2. Click any row to open the detail page\n3. Click the Edit (pencil) button\n4. Change the Description to: Updated Direct Cost Description\n5. Change the Amount to: 7500\n6. Click Save\n7. Wait for the page to stop loading',
   'The detail page now shows the updated description and amount $7,500.00. A success toast appeared after saving. The old values are no longer shown.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '3.2', 'Edit', 'Persist after refresh',
   'Saved changes persist after refreshing the page',
   'Checks that changes are stored in the database — not just shown temporarily in the browser.',
   'Complete scenario 3.1 first.',
   E'1. After saving an edit, stay on the detail page\n2. Press Ctrl+R (or Cmd+R on Mac) to refresh the browser\n3. Wait for the page to load',
   'The updated description and amount are still visible after refresh. No data reverted to old values.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '3.3', 'Edit', 'Cancel edit',
   'Canceling edit discards all changes',
   'Checks that pressing Cancel on the edit form does not save any of the in-progress changes.',
   NULL,
   E'1. Open any direct cost detail page\n2. Click Edit\n3. Change the Description to: THIS SHOULD NOT SAVE\n4. Click Cancel',
   'The form closes and the original description is still shown. "THIS SHOULD NOT SAVE" does not appear anywhere on the page.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '3.4', 'Edit', 'Status change',
   'Change the status from Draft to Approved',
   'Checks that the status dropdown works correctly and the status badge updates after saving.',
   'There must be a direct cost with status Draft.',
   E'1. Open a direct cost with status Draft\n2. Click Edit\n3. In the Status dropdown, select Approved\n4. Click Save',
   'The status badge on the detail page now shows "Approved" in green (or the appropriate color). No error message appears.',
   'HIGH', 'scenario', '/767/direct-costs'),

  -- ── 4. Delete ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '4.1', 'Delete', 'Single delete',
   'Delete a direct cost record',
   'Checks that a direct cost can be deleted and disappears from the list after deletion.',
   'Create a direct cost named "Delete Me Test" before running this scenario.',
   E'1. Open the Direct Costs page\n2. Find the record with description "Delete Me Test"\n3. Click the three-dot (more options) menu on that row\n4. Click Delete\n5. Confirm deletion in the dialog that appears\n6. Wait for the page to reload',
   'The record "Delete Me Test" is no longer visible in the list. A success toast appeared. No error messages are shown.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '4.2', 'Delete', 'Cancel delete',
   'Canceling delete leaves the record unchanged',
   'Checks that pressing Cancel in the delete confirmation dialog does not remove the record.',
   NULL,
   E'1. Hover over any row in the list\n2. Click the three-dot action menu → Delete\n3. In the confirmation dialog, click Cancel',
   'The dialog closes. The direct cost record is still visible in the list, unchanged.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '4.3', 'Delete', 'Delete from detail page',
   'Delete a direct cost from its detail page',
   'Checks that you can delete a record directly from the detail page using the action menu at the top.',
   NULL,
   E'1. Open any direct cost detail page\n2. Click the three-dot menu at the top right of the page\n3. Click Delete\n4. Confirm in the dialog',
   'The app returns to the Direct Costs list. The deleted record is no longer shown.',
   'MEDIUM', 'scenario', '/767/direct-costs'),

  -- ── 5. Status ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '5.1', 'Status', 'Status badge colors',
   'Status badges show the correct color for each status',
   'Checks that the status labels are color-coded so they are easy to read at a glance: Draft is gray, Pending is yellow, Approved is green.',
   'There must be records with different statuses in the list.',
   E'1. Open the Direct Costs page\n2. Look at the Status column in the table\n3. Find records with different statuses (Draft, Pending, Approved)',
   'Each status shows a distinct colored badge. Draft appears in gray, Pending in yellow/orange, Approved in green. The colors make it easy to tell statuses apart without reading the text.',
   'MEDIUM', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '5.2', 'Status', 'Bulk approve',
   'Approve multiple direct costs at once',
   'Checks that selecting multiple records and using the bulk action to approve them all at once works correctly.',
   'There must be at least two direct costs with status Draft or Pending.',
   E'1. On the Direct Costs list, check the checkbox on 2 or more rows\n2. Look for a bulk action button or dropdown that appears\n3. Click Approve (or the relevant bulk action)\n4. Confirm if prompted',
   'All selected records now show status "Approved". A message confirms how many were updated (e.g. "2 records approved"). No error messages appear.',
   'HIGH', 'scenario', '/767/direct-costs'),

  -- ── 6. Calculations ────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '6.1', 'Calculations', 'Line item total',
   'Line items add up to the record total',
   'Checks that when a direct cost has multiple line items, the sum of their amounts equals the total amount displayed at the top of the record.',
   NULL,
   E'1. Open any direct cost that has at least two line items\n2. Add up the "Line Total" column values yourself (e.g. $1,000 + $2,000 = $3,000)\n3. Look at the total amount displayed at the top of the page',
   'The total amount at the top matches the sum of the line items. For example, if line items are $1,000 and $2,000, the total shows $3,000.00.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '6.2', 'Calculations', 'Quantity × unit cost',
   'Line item total = quantity × unit cost',
   'Checks that the math for each line item is correct: multiplying quantity by unit cost gives the line total.',
   NULL,
   E'1. Open a direct cost detail page\n2. Look at a line item that has both Quantity and Unit Cost filled in\n3. Multiply Quantity × Unit Cost yourself (e.g. 4 × $250 = $1,000)\n4. Compare to the Line Total column',
   'The Line Total column shows the correct product of Quantity × Unit Cost. For example, 4 units at $250 each = $1,000.00.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '6.3', 'Calculations', 'List total footer',
   'Footer row shows the sum of all visible amounts',
   'Checks that the grand total at the bottom of the table correctly sums all the Amount values for records currently shown.',
   'There must be at least two direct cost records in the list.',
   E'1. Open the Direct Costs page\n2. Look at the bottom of the table for a footer/totals row\n3. Add up the individual Amount values yourself',
   'A totals row at the bottom shows the sum of all displayed amounts. The number matches what you get adding up the individual rows.',
   'HIGH', 'scenario', '/767/direct-costs'),

  -- ── 7. Filters & Search ────────────────────────────────────────────────────
  ((SELECT id FROM suite), '7.1', 'Filters & Search', 'Search by description',
   'Search for a direct cost by description',
   'Checks that the search box filters the list to records whose description matches the typed text.',
   'The list must have at least two records with different descriptions.',
   E'1. Open the Direct Costs page\n2. Click the search box in the toolbar\n3. Type: Test Direct Cost\n4. Wait for the list to update',
   'Only records whose description contains "Test Direct Cost" are shown. Records with unrelated descriptions disappear. Clearing the search box brings all records back.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '7.2', 'Filters & Search', 'Filter by status',
   'Filter the list to show only Approved records',
   'Checks that the status filter narrows the list to only the selected status.',
   NULL,
   E'1. Click the Filters button in the toolbar\n2. Select Status: Approved\n3. Apply the filter',
   'Only records with status "Approved" are visible. Records with other statuses (Draft, Pending) disappear from the list.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '7.3', 'Filters & Search', 'Filter by type',
   'Filter to show only a specific cost type',
   'Checks that the Type filter correctly narrows the list.',
   NULL,
   E'1. Click Filters\n2. Select Type: Materials (or whichever type has records)\n3. Apply the filter',
   'Only records with the selected type are shown. Other cost types disappear from the list.',
   'MEDIUM', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '7.4', 'Filters & Search', 'Clear filters',
   'Clearing filters restores the full list',
   'Checks that after applying a filter, you can get back to seeing all records by clearing the filter.',
   NULL,
   E'1. Apply any filter (e.g. Status: Draft)\n2. Confirm the list is filtered\n3. Click the X or Clear Filters button',
   'All records reappear. The filter badge or indicator is gone from the toolbar.',
   'MEDIUM', 'scenario', '/767/direct-costs'),

  -- ── 8. Export ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '8.1', 'Export', 'Export to CSV',
   'Export the direct costs list as a spreadsheet',
   'Checks that clicking the export button downloads a CSV file that can be opened in Excel or Google Sheets.',
   NULL,
   E'1. On the Direct Costs page, click the export or download icon in the toolbar\n2. If a dialog appears, choose CSV format\n3. Wait for the download to start',
   'A CSV file downloads. Opening it shows columns like Date, Vendor, Type, Invoice #, Status, Amount. The data matches what is shown on the page.',
   'MEDIUM', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '8.2', 'Export', 'Export filtered results',
   'Export only the filtered subset of records',
   'Checks that when a filter is active, the export only includes the filtered records — not everything.',
   NULL,
   E'1. Apply a filter (e.g. Status: Approved)\n2. Click the export icon\n3. Download the CSV',
   'The downloaded CSV only contains records matching the active filter. Records that were hidden by the filter are not in the file.',
   'MEDIUM', 'scenario', '/767/direct-costs'),

  -- ── 9. Budget Integration ──────────────────────────────────────────────────
  ((SELECT id FROM suite), '9.1', 'Budget Integration', 'Budget code assignment',
   'Assign a budget code to a line item',
   'Checks that a line item can be linked to a budget code (a category in the project budget), and that the assignment saves correctly. This is how the cost gets tracked against the project budget.',
   'A budget code must exist in the project.',
   E'1. Open a direct cost detail page\n2. Click Edit\n3. On a line item row, click the Budget Code field\n4. Select any available budget code from the dropdown\n5. Click Save',
   'The line item now shows the selected budget code. After refreshing the page, the budget code is still shown on that line item.',
   'HIGH', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '9.2', 'Budget Integration', 'Cost code hierarchy view',
   'Cost Code view groups direct costs by budget division',
   'Checks that the Cost Code hierarchy view correctly groups all direct costs under their budget divisions so you can see spending by category at a glance.',
   'At least two direct costs with different budget codes must exist.',
   E'1. Open the Direct Costs page\n2. Switch to the Cost Code view using the view toggle\n3. Look at how the records are organized',
   'Records are grouped by budget division (e.g. "Division 03 - Concrete", "Division 05 - Metals"). Each group shows a subtotal. Expanding a group shows the individual cost records.',
   'HIGH', 'scenario', '/767/direct-costs'),

  -- ── 10. Edge Cases ─────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '10.1', 'Edge Cases', 'Empty state',
   'Empty state message appears when no direct costs exist',
   'Checks that the page shows a helpful message rather than a blank screen when no records exist.',
   NULL,
   E'1. If you have applied a filter with no matching results (e.g. search for a term that matches nothing), look at the main content area',
   'A message appears saying something like "No direct costs found" and optionally a button to create one. The page does not show a blank white space or an error.',
   'MEDIUM', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '10.2', 'Edge Cases', 'Column visibility',
   'Hide and show table columns',
   'Checks that the column selector lets you customize which columns appear in the table.',
   NULL,
   E'1. Click the column visibility button in the toolbar (looks like columns or a grid icon)\n2. Uncheck "Invoice #" to hide that column\n3. Close the selector',
   'The "Invoice #" column disappears from the table. All other columns still display correctly. No error message appears.',
   'LOW', 'scenario', '/767/direct-costs'),

  ((SELECT id FROM suite), '10.3', 'Edge Cases', 'ERP / Acumatica sync status',
   'ERP sync status column shows the accounting integration state',
   'Checks that the ERP Status column (which shows whether a cost has been synced to the accounting system) is visible in the list.',
   NULL,
   E'1. Open the Direct Costs page\n2. Look for the "ERP Status" column in the table\n3. Note the values shown (e.g. "Synced", "Pending", or blank)',
   'The ERP Status column is visible. Records that have been synced to accounting show a status indicator. Records not yet synced show blank or "Not Synced". No error appears.',
   'LOW', 'scenario', '/767/direct-costs')

ON CONFLICT (suite_id, test_number) DO UPDATE SET
  test_name       = EXCLUDED.test_name,
  context_note    = EXCLUDED.context_note,
  setup_steps     = EXCLUDED.setup_steps,
  steps           = EXCLUDED.steps,
  expected_result = EXCLUDED.expected_result,
  priority        = EXCLUDED.priority,
  test_type       = EXCLUDED.test_type,
  start_url       = EXCLUDED.start_url,
  category        = EXCLUDED.category,
  subcategory     = EXCLUDED.subcategory,
  updated_at      = now();
-- Update suite total_cases (scenario type only)
UPDATE public.test_suites
   SET total_cases = (
     SELECT count(*) FROM public.test_cases
     WHERE suite_id = test_suites.id AND test_type = 'scenario'
   )
 WHERE tool_name = 'direct-costs';
