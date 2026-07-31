-- ============================================================================
-- Seed: Prime Contracts Test Scenarios
-- Generated: 2026-04-08
-- Suite: prime-contracts
-- Type: scenario (plain-English guided tests for non-technical testers)
-- Runner: http://localhost:3000/testing
-- 27 scenarios across 13 categories
-- ============================================================================

-- Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('prime-contracts', 'Prime Contracts', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Insert all scenarios
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'prime-contracts')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

  -- ── 1. Navigation ────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the Prime Contracts list page',
   'Checks that the Prime Contracts page loads without errors and shows the list of contracts. A prime contract is the main legal agreement between the project owner (the client paying for construction) and the general contractor who builds it. It sets the total price, scope, and schedule for the entire project.',
   NULL,
   E'1. Log in as test1@mail.com\n2. Navigate to http://localhost:3000/767/prime-contracts\n3. Wait for the page to stop loading',
   'The page loads fully. A table of prime contracts is visible (or an empty-state message). Column headers include Contract #, Owner/Client, Title, Status, Executed, Original Contract Amount, Revised Contract Amount. No error messages appear.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '1.2', 'Navigation', 'Detail view',
   'Open a prime contract detail page',
   'Checks that clicking a row opens the full detail page for that contract, where all contract information and tabs are visible.',
   'The Prime Contracts list must have at least one existing record.',
   E'1. Open the Prime Contracts list page\n2. Click on any contract row in the table\n3. Wait for the page to stop loading',
   'The detail page opens. The contract number, title, and status are shown at the top. Tabs are visible — at minimum: Overview (or General), Schedule of Values, Change Orders, Invoices, and Payments. No error messages appear.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '1.3', 'Navigation', 'Back navigation',
   'Return to the list from a detail page',
   'Checks that the back button or breadcrumb on the detail page navigates the user back to the Prime Contracts list.',
   'Open any prime contract detail page first.',
   E'1. Open a prime contract detail page\n2. Click the back arrow or "Prime Contracts" breadcrumb link at the top of the page\n3. Wait for the page to load',
   'The Prime Contracts list page loads. The previously viewed contract is still visible in the list. No error messages appear.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '1.4', 'Navigation', 'Tabs',
   'Switch between tabs on the detail page',
   'Checks that each tab on the contract detail page loads without errors. Tabs hold different sections of contract data: overview info, the payment schedule (SOV), change orders issued against this contract, invoices, and payments received.',
   'Open any prime contract detail page.',
   E'1. Open a prime contract detail page\n2. Click the "Schedule of Values" tab\n3. Click the "Change Orders" tab\n4. Click the "Invoices" tab\n5. Click the "Payments" tab\n6. Click back to the first tab (Overview or General)',
   'Each tab loads without an error or blank screen. The active tab is visually highlighted. No JavaScript errors appear in the page.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  -- ── 2. Create ────────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '2.1', 'Create', 'Happy path',
   'Create a new prime contract with required fields',
   'Checks the basic creation flow — filling in the minimum required fields and saving the contract so it appears in the list.',
   NULL,
   E'1. On the Prime Contracts list page, click the "Create" button (top right)\n2. In the Contract # field, type: PC-TEST-001\n3. In the Title field, type: Test Prime Contract\n4. Leave Status as Draft (the default)\n5. Click Save (or Create)\n6. Wait for the page to stop loading',
   'A success message (toast notification) briefly appears. The app navigates to the detail page for the new contract, or back to the list showing "Test Prime Contract". No error messages appear.',
   'HIGH', 'scenario', '/767/prime-contracts/new'),

  ((SELECT id FROM suite), '2.2', 'Create', 'All fields',
   'Create a contract with all major fields filled in',
   'Checks that optional fields — Owner/Client, Contractor, Architect, Start Date, Estimated Completion Date, Default Retainage, and Description — all save correctly.',
   NULL,
   E'1. Click "Create" on the Prime Contracts page\n2. In Contract # type: PC-FULL-001\n3. In Title type: Full Fields Test Contract\n4. Set Status to Draft\n5. In the Owner/Client dropdown, select any available company\n6. In the Contractor dropdown, select any available company\n7. In Start Date, enter 2026-01-01\n8. In Estimated Completion Date, enter 2026-12-31\n9. In Default Retainage, type: 10\n10. Click Save',
   'The detail page opens showing all filled-in values. Owner/Client, Contractor, Start Date, Completion Date, and Retainage are all shown correctly. No fields revert to blank.',
   'MEDIUM', 'scenario', '/767/prime-contracts/new'),

  ((SELECT id FROM suite), '2.3', 'Create', 'Validation',
   'Try to create a contract without a title',
   'Checks that the form prevents saving when the required Title field is left blank, so incomplete contracts cannot be accidentally created.',
   NULL,
   E'1. Click "Create" on the Prime Contracts page\n2. Leave the Title field completely empty\n3. In Contract # type: PC-BLANK-TITLE\n4. Click the Save button',
   'A red error message appears near the Title field saying something like "Title is required". The form does not save and does not navigate away. The Create button can be clicked again after filling in the title.',
   'HIGH', 'scenario', '/767/prime-contracts/new'),

  -- ── 3. Edit ──────────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '3.1', 'Edit', 'Edit title',
   'Edit the title of an existing contract',
   'Checks that a user can open the edit form, change the title, and save it successfully.',
   'There must be at least one existing prime contract in the list.',
   E'1. Open the Prime Contracts list\n2. Click on any contract to open its detail page\n3. Click the Edit button (pencil icon or "Edit" label)\n4. Clear the Title field and type: Updated Contract Title\n5. Click Save\n6. Wait for the page to stop loading',
   'The detail page now shows "Updated Contract Title". A success toast briefly appears. The old title is no longer visible.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '3.2', 'Edit', 'Persist after refresh',
   'Saved edits persist after refreshing the page',
   'Checks that data is actually saved to the database, not just shown temporarily in the browser.',
   'Complete scenario 3.1 first (edit a title and save it).',
   E'1. After saving an edit, stay on the detail page\n2. Press Ctrl+R (or Cmd+R on Mac) to refresh the page\n3. Wait for the page to finish loading',
   'The updated title and any other changes are still shown after the refresh. No data reverted to the old values.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '3.3', 'Edit', 'Cancel discards changes',
   'Cancelling the edit form discards unsaved changes',
   'Checks that clicking Cancel does not save anything, so accidental edits cannot corrupt the contract.',
   'There must be at least one existing prime contract.',
   E'1. Open any prime contract detail page\n2. Click the Edit button\n3. Change the Title to: DO NOT SAVE THIS\n4. Click Cancel (instead of Save)',
   'The form closes and the original title is still displayed. "DO NOT SAVE THIS" does not appear anywhere on the page.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  -- ── 4. Delete ────────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '4.1', 'Delete', 'Delete with confirmation',
   'Delete a prime contract',
   'Checks that a contract can be permanently deleted and disappears from the list. Note: contracts with associated line items or change orders may be blocked from deletion.',
   'Create a contract named "Delete Me Contract" before running this scenario.',
   E'1. On the Prime Contracts list, find the row titled "Delete Me Contract"\n2. Click the three-dot menu (⋯) on that row\n3. Click "Delete"\n4. In the confirmation dialog that appears, click "Delete Contract"\n5. Wait for the page to stop loading',
   '"Delete Me Contract" is no longer visible in the list. A success toast briefly appears. The total contract count decreases by 1.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  -- ── 5. Status / Workflow ─────────────────────────────────────────────────────
  ((SELECT id FROM suite), '5.1', 'Status', 'Change to Out to Bid',
   'Move a contract from Draft to Out to Bid',
   'Checks that the status dropdown works. "Out to Bid" means the contract has been sent out for pricing quotes but is not yet signed.',
   'There must be at least one contract with status Draft.',
   E'1. Open a contract with status "Draft"\n2. Click Edit\n3. In the Status dropdown, select "Out to Bid"\n4. Click Save\n5. Wait for the page to stop loading',
   'The status badge on the page now shows "Out to Bid". The change is saved. No error messages appear.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '5.2', 'Status', 'Mark as Executed',
   'Mark a contract as Executed and check the Executed flag',
   'Checks the Executed checkbox/toggle. "Executed" means the contract has been signed by both parties — the owner and the contractor.',
   'There must be at least one contract that has NOT been marked Executed.',
   E'1. Open any prime contract detail page\n2. Click Edit\n3. Check the "Executed" checkbox (or toggle it to Yes)\n4. Click Save\n5. Wait for the page to stop loading',
   'The Executed field on the detail page now shows "Yes" (or a checkmark). The contract row in the list also shows Executed as checked. No error messages appear.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  -- ── 6. Schedule of Values (SOV) ──────────────────────────────────────────────
  ((SELECT id FROM suite), '6.1', 'Schedule of Values', 'View SOV tab',
   'Open the Schedule of Values tab on a contract',
   'Checks that the SOV tab loads. A Schedule of Values (SOV) is a breakdown of the total contract price into individual line items — for example, "Foundation Work: $50,000" or "Electrical: $120,000". It is used to track how much of the work has been completed and invoiced.',
   'There must be at least one existing prime contract.',
   E'1. Open any prime contract detail page\n2. Click the "Schedule of Values" tab\n3. Wait for the tab content to load',
   'The SOV tab displays without errors. Either a table of SOV line items is visible, or an empty-state message like "No line items yet" is shown. Column headers such as Description, Scheduled Value, % Complete, and Balance to Finish are visible.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '6.2', 'Schedule of Values', 'Add SOV line item',
   'Add a line item to the Schedule of Values',
   'Checks that a user can add a new SOV line item — a single priced work item — and that it is saved with the correct amount.',
   'Open a prime contract and go to the Schedule of Values tab.',
   E'1. On the Schedule of Values tab, click "Add Line Item" (or the + button)\n2. In the Description field, type: Foundation Work\n3. In the Scheduled Value (amount) field, type: 50000\n4. Click Save on the line item\n5. Wait for the page to stop loading',
   'The line item "Foundation Work" appears in the SOV table with a Scheduled Value of $50,000.00. The contract''s Original Contract Amount updates to reflect the new total. No error messages appear.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '6.3', 'Schedule of Values', 'SOV total updates',
   'Adding multiple SOV line items updates the contract total',
   'Checks that the Original Contract Amount shown in the Contract Summary reflects the sum of all SOV line items.',
   'Have a contract with at least one SOV line item already added (e.g., Foundation Work = $50,000).',
   E'1. On the Schedule of Values tab, add a second line item: Electrical Work with value 120000\n2. Add a third line item: Plumbing with value 80000\n3. After saving, look at the Contract Summary section',
   'The Original Contract Amount in the Contract Summary equals the sum of all line items ($250,000 if using the example values). Each line item shows the correct individual amount.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  -- ── 7. Change Orders tab ─────────────────────────────────────────────────────
  ((SELECT id FROM suite), '7.1', 'Change Orders', 'View change orders tab',
   'Open the Change Orders tab on a contract',
   'Checks that the Change Orders tab loads. Change orders are official amendments to the original contract — they adjust the price or scope after the contract is signed.',
   'There must be at least one existing prime contract.',
   E'1. Open any prime contract detail page\n2. Click the "Change Orders" tab\n3. Wait for the tab to load',
   'The Change Orders tab loads without errors. Either a table of change orders is shown (with columns for Number, Title, Status, Amount, etc.) or an empty-state message appears. No error messages appear.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  -- ── 8. Invoices / Payments tabs ──────────────────────────────────────────────
  ((SELECT id FROM suite), '8.1', 'Invoices', 'View invoices tab',
   'Open the Invoices tab on a contract',
   'Checks that the Invoices tab loads. Invoices (also called Pay Applications or Pay Apps) are requests the contractor submits to the owner asking to be paid for completed work.',
   'There must be at least one existing prime contract.',
   E'1. Open any prime contract detail page\n2. Click the "Invoices" tab\n3. Wait for the tab to load',
   'The Invoices tab loads without errors. Either a list of invoices is shown or an empty-state message appears. The tab does not show a blank white screen or a spinner that never stops.',
   'HIGH', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '8.2', 'Payments', 'View payments tab',
   'Open the Payments tab on a contract',
   'Checks that the Payments tab loads. Payments are records of money the owner has actually sent to the contractor in response to invoices.',
   'There must be at least one existing prime contract.',
   E'1. Open any prime contract detail page\n2. Click the "Payments" tab\n3. Wait for the tab to load',
   'The Payments tab loads without errors. Either a table of payments is shown (with columns for Invoice, Amount, Date Paid, Payment Number, Check Number) or an empty-state message is displayed. No error messages appear.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  -- ── 9. Filters / Search ──────────────────────────────────────────────────────
  ((SELECT id FROM suite), '9.1', 'Filter / Search', 'Search by title',
   'Search for a contract by title keyword',
   'Checks that the search box on the list page filters contracts by title in real time.',
   'The list must have at least two contracts with different titles.',
   E'1. Open the Prime Contracts list\n2. Click the search box (shows a magnifying glass icon or placeholder "Search contracts...")\n3. Type: Test Prime\n4. Wait for the list to filter',
   'The list narrows to show only contracts whose title or contract number contains "Test Prime". Contracts with unrelated titles disappear. Clearing the search box restores all contracts.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '9.2', 'Filter / Search', 'Filter by status',
   'Filter contracts by status',
   'Checks that the Status filter correctly narrows the list to only contracts with the chosen status.',
   'The list must have contracts with at least two different statuses (e.g., Draft and Approved).',
   E'1. Open the Prime Contracts list\n2. Click the Filters button in the toolbar\n3. Find the "Status" filter and select "Draft"\n4. Wait for the list to update',
   'Only contracts with status "Draft" are shown. Contracts with other statuses (e.g., Approved, Out to Bid) are hidden. The active filter chip is displayed in the toolbar.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '9.3', 'Filter / Search', 'Filter by executed',
   'Filter contracts by executed status',
   'Checks that the Executed filter works. "Executed" means the contract has been formally signed.',
   'The list must have at least one Executed and one non-Executed contract.',
   E'1. Open the Prime Contracts list\n2. Click the Filters button\n3. Find the "Executed" filter and select "Yes"\n4. Wait for the list to update',
   'Only contracts marked as Executed are shown in the list. Non-executed contracts are hidden. Clearing the filter restores all contracts.',
   'LOW', 'scenario', '/767/prime-contracts'),

  -- ── 10. Export ───────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '10.1', 'Export', 'Export contracts to CSV',
   'Export the contracts list to a CSV file',
   'Checks that the Export function downloads a CSV file of the current contract list. A CSV is a spreadsheet-like file that can be opened in Excel or Google Sheets.',
   'The list must have at least one contract.',
   E'1. Open the Prime Contracts list\n2. Click the Export icon in the toolbar (looks like a download arrow)\n3. Wait for the download to start',
   'A file named something like "prime-contracts-1.csv" is downloaded to your computer. Opening the file shows the contract data with column headers matching what is visible in the table. No error messages appear.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  -- ── 11. Row Expand ───────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '11.1', 'Row Expand', 'Expand contract to see change orders',
   'Expand a contract row to reveal its Prime Contract Change Orders',
   'Checks the expand/collapse feature. Each contract row has a small arrow on the left — clicking it shows change orders linked to that contract without leaving the list page.',
   'There must be at least one prime contract in the list. Change orders linked to it are ideal but not required.',
   E'1. On the Prime Contracts list, find the small arrow (chevron) icon on the far left of any contract row\n2. Click that arrow\n3. Wait for the sub-rows to load',
   'The row expands to reveal a nested table showing Prime Contract Change Orders (PCCOs) for that contract, or the message "No change orders" if there are none. Clicking the arrow again collapses the row.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  -- ── 12. Bulk Actions ─────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '12.1', 'Bulk Actions', 'Select multiple contracts',
   'Select multiple contract rows using checkboxes',
   'Checks that the bulk-selection checkboxes work and the bulk-action toolbar appears when rows are selected.',
   'The list must have at least two contracts.',
   E'1. On the Prime Contracts list, click the checkbox on the left of the first contract row\n2. Click the checkbox on the second contract row\n3. Look at the toolbar',
   'Both rows are visually highlighted (checkbox checked). The toolbar shows a count like "2 selected" and a bulk-delete button appears. Unchecking both rows hides the bulk-action toolbar.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  ((SELECT id FROM suite), '12.2', 'Bulk Actions', 'Bulk delete contracts',
   'Delete multiple contracts at once using bulk select',
   'Checks the bulk-delete workflow — selecting multiple rows and deleting them all in one action.',
   'Create two contracts named "Bulk Delete A" and "Bulk Delete B" before running this scenario.',
   E'1. On the Prime Contracts list, check the checkbox for "Bulk Delete A"\n2. Check the checkbox for "Bulk Delete B"\n3. Click the bulk-delete button that appears in the toolbar (trash icon or "Delete selected")\n4. In the confirmation dialog, click "Delete 2 Contracts"\n5. Wait for the page to stop loading',
   'Both "Bulk Delete A" and "Bulk Delete B" are removed from the list. A success toast shows how many were deleted. The selection count resets to 0.',
   'MEDIUM', 'scenario', '/767/prime-contracts'),

  -- ── 13. Integration ──────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '13.1', 'Integration', 'Change orders link from list',
   'Change orders listed under a contract link to the correct detail page',
   'Checks that when you expand a contract row and click a change order, it navigates to that change order''s detail page.',
   'There must be at least one prime contract with at least one linked prime contract change order (PCCO).',
   E'1. On the Prime Contracts list, expand a contract row that has change orders\n2. Click on one of the change order rows in the expanded sub-table\n3. Wait for the page to load',
   'The browser navigates to the detail page for that specific change order. The change order number and title match what was shown in the sub-row. No 404 or error page appears.',
   'HIGH', 'scenario', '/767/prime-contracts')

ON CONFLICT (suite_id, test_number) DO UPDATE SET
  category        = EXCLUDED.category,
  subcategory     = EXCLUDED.subcategory,
  test_name       = EXCLUDED.test_name,
  context_note    = EXCLUDED.context_note,
  setup_steps     = EXCLUDED.setup_steps,
  steps           = EXCLUDED.steps,
  expected_result = EXCLUDED.expected_result,
  priority        = EXCLUDED.priority,
  test_type       = EXCLUDED.test_type,
  start_url       = EXCLUDED.start_url;
-- Update total_cases count
UPDATE public.test_suites
SET total_cases = (
  SELECT count(*) FROM public.test_cases
  WHERE suite_id = test_suites.id AND test_type = 'scenario'
)
WHERE tool_name = 'prime-contracts';
