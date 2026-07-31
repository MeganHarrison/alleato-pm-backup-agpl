-- ============================================================================
-- Seed: Punch List Test Scenarios
-- Generated: 2026-04-08
-- Suite: punch-list
-- Type: scenario (plain-English guided tests for non-technical testers)
-- Runner: http://localhost:3000/testing
-- 13 scenarios across 9 categories
-- ============================================================================

-- Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('punch-list', 'Punch List', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Insert all scenarios
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'punch-list')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

  -- ── 1. Navigation ──────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the Punch List page',
   'Checks that the Punch List page loads without errors and shows the list of items. A punch list is a record of defects or incomplete work found during a construction walkthrough — things that need to be fixed before the project is considered done.',
   NULL,
   E'1. Make sure you are logged in as test1@mail.com\n2. Click "Punch List" in the left sidebar of project "Alleato AI"\n3. Wait for the page to stop loading',
   'The page loads fully. A table of punch items is visible (or a "No punch items found" empty state message). The page title says "Punch List". No error messages appear.',
   'HIGH', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '1.2', 'Navigation', 'Tabs',
   'Switch between Items and Recycle Bin tabs',
   'Checks that the two tabs — Items and Recycle Bin — each show the correct set of records.',
   NULL,
   E'1. On the Punch List page, click the "Items" tab\n2. Note how many records are shown\n3. Click the "Recycle Bin" tab\n4. Look at what is shown',
   'The Items tab shows active punch items. The Recycle Bin tab shows deleted items (or an empty state if none have been deleted). The counts in each tab badge are correct. No errors appear.',
   'HIGH', 'scenario', '/767/punch-list'),

  -- ── 2. Create ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '2.1', 'Create', 'Basic creation',
   'Create a new punch item with required fields only',
   'Checks that a user can create a basic punch item and it appears in the list. A punch item describes one specific defect or task — for example, "Paint chipped on north wall of Room 101."',
   NULL,
   E'1. Click the "Create Punch Item" button (top right of the page)\n2. In the Title field, type: Paint chipped on north wall\n3. Leave all other fields at their defaults\n4. Click "Create Punch Item"\n5. Wait for the dialog to close',
   'The dialog closes. The new punch item "Paint chipped on north wall" appears in the list with a status of "Draft". A success message briefly appears. No errors are shown.',
   'HIGH', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '2.2', 'Create', 'All fields',
   'Create a punch item with every field filled in',
   'Checks that all optional fields — description, priority, assignee, location, trade, type, reference, due date, ball in court — save correctly and appear in the list.',
   NULL,
   E'1. Click "Create Punch Item"\n2. Title: Broken window latch in stairwell B\n3. Description: Latch does not engage when door is closed\n4. Status: Work Required\n5. Priority: High\n6. Assignee Company: ABC Glass Co\n7. Ball in Court: Site Superintendent\n8. Due Date: pick any future date\n9. Location: Stairwell B, Level 2\n10. Trade: Glazing\n11. Type: Deficiency\n12. Reference: RFI-042\n13. Click "Create Punch Item"',
   'The dialog closes. The new item appears in the list. The Assignee column shows "ABC Glass Co", Location shows "Stairwell B, Level 2", and the Priority badge shows "High". No fields are blank when they were filled in.',
   'MEDIUM', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '2.3', 'Create', 'Validation',
   'Submitting without a title shows an error',
   'Checks that the form prevents saving if the Title field is left blank, so incomplete records cannot be created by accident.',
   NULL,
   E'1. Click "Create Punch Item"\n2. Leave the Title field completely blank\n3. Click "Create Punch Item" to submit',
   'A red error message appears near the Title field saying the title is required. The dialog stays open. No record is created.',
   'HIGH', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '2.4', 'Create', 'Cancel',
   'Canceling the create form does not save anything',
   'Checks that pressing Cancel on the create dialog goes back to the list without creating any record.',
   NULL,
   E'1. Click "Create Punch Item"\n2. Type: Should Not Be Saved in the Title field\n3. Click the Cancel button',
   'The dialog closes. No new record named "Should Not Be Saved" appears in the list.',
   'HIGH', 'scenario', '/767/punch-list'),

  -- ── 3. Edit ────────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '3.1', 'Edit', 'Edit title and fields',
   'Edit an existing punch item and verify changes are saved',
   'Checks that changes made in the edit form are saved and appear correctly after the dialog closes.',
   'There must be at least one existing punch item in the list.',
   E'1. Hover over any row in the Punch List table\n2. Click the three-dot action menu on the right side of that row\n3. Click "Edit"\n4. Change the Title to: Updated — Cracked tile in lobby\n5. Change Priority to: Medium\n6. Click "Save Changes"',
   'The dialog closes. The row in the list now shows the title "Updated — Cracked tile in lobby" and the Priority badge shows "Medium". A success message briefly appears.',
   'HIGH', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '3.2', 'Edit', 'Pre-filled values',
   'Edit form shows the previously saved values',
   'Checks that when you open the edit form, every field shows the value that was previously saved — not a blank placeholder. This prevents accidentally overwriting data.',
   NULL,
   E'1. Create a punch item with Location: Room 204 and Trade: Electrical\n2. Hover over that row and click the action menu → Edit\n3. Look at the Location and Trade fields in the edit form',
   'The Location field shows "Room 204" and the Trade field shows "Electrical". No field shows a blank or placeholder when a value was previously saved.',
   'HIGH', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '3.3', 'Edit', 'Cancel edit',
   'Canceling the edit form discards all changes',
   'Checks that pressing Cancel on the edit dialog does not save any of the changes made.',
   'There must be at least one existing punch item.',
   E'1. Open the edit form for any punch item\n2. Change the Title to: This Should Not Save\n3. Click Cancel',
   'The dialog closes. The original title is still shown in the list. "This Should Not Save" does not appear anywhere.',
   'HIGH', 'scenario', '/767/punch-list'),

  -- ── 4. Status / Mark Complete ──────────────────────────────────────────────
  ((SELECT id FROM suite), '4.1', 'Status', 'Mark as closed',
   'Change a punch item status to Closed',
   'Checks that a punch item can be marked as Closed — meaning the defect has been fixed and the work is complete. Closing a punch item is the main goal of the entire punch list process.',
   'There must be at least one punch item with status Draft or Work Required.',
   E'1. Hover over any active punch item in the list\n2. Click the three-dot action menu → Edit\n3. Change the Status dropdown to: Closed\n4. Click "Save Changes"',
   'The dialog closes. The punch item now shows a "Closed" status badge in the list. No error appears.',
   'HIGH', 'scenario', '/767/punch-list'),

  -- ── 5. Delete & Restore ────────────────────────────────────────────────────
  ((SELECT id FROM suite), '5.1', 'Delete & Restore', 'Delete a punch item',
   'Delete a punch item and verify it moves to the Recycle Bin',
   'Checks that deleting a punch item moves it to the Recycle Bin rather than permanently erasing it, so it can be recovered if needed.',
   NULL,
   E'1. Create a punch item titled: Delete Me Test\n2. Hover over that row and click the three-dot action menu\n3. Click "Delete"\n4. Wait for the action to complete\n5. Click the "Recycle Bin" tab',
   'The item "Delete Me Test" disappears from the Items tab. It appears in the Recycle Bin tab. A success message briefly appears.',
   'HIGH', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '5.2', 'Delete & Restore', 'Restore a deleted item',
   'Restore a punch item from the Recycle Bin',
   'Checks that a deleted punch item can be recovered from the Recycle Bin and returned to the active list.',
   'Complete scenario 5.1 first so there is at least one item in the Recycle Bin.',
   E'1. Click the "Recycle Bin" tab\n2. Find "Delete Me Test" in the list\n3. Click the "Restore" button on that row\n4. Click the "Items" tab',
   'The item "Delete Me Test" reappears in the Items tab. It is no longer in the Recycle Bin.',
   'HIGH', 'scenario', '/767/punch-list'),

  -- ── 6. Filter & Search ─────────────────────────────────────────────────────
  ((SELECT id FROM suite), '6.1', 'Filter & Search', 'Search by title',
   'Search for a punch item by part of its title',
   'Checks that typing in the search box filters the list to only show matching records.',
   'There must be at least two punch items with different titles.',
   E'1. Find the search box in the toolbar (shows "Search punch items...")\n2. Type: cracked\n3. Wait for the list to update',
   'Only punch items whose title or location contains "cracked" are shown. All other rows disappear. Clearing the search box brings all records back.',
   'MEDIUM', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '6.2', 'Filter & Search', 'Filter by status',
   'Filter the list to show only Work Required items',
   'Checks that the Status filter narrows the list to matching records only.',
   'There must be punch items with different statuses.',
   E'1. Click the Filters button in the toolbar\n2. In the Status dropdown, select: Work Required\n3. Apply the filter\n4. Look at the results',
   'Only punch items with status "Work Required" are shown. Items with other statuses (Draft, Initiated, Closed) are hidden. Clearing the filter brings all items back.',
   'MEDIUM', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '6.3', 'Filter & Search', 'Filter by priority',
   'Filter the list to show only High priority items',
   'Checks that the Priority filter works correctly to help users focus on the most urgent deficiencies.',
   'There must be punch items with different priority levels.',
   E'1. Click the Filters button in the toolbar\n2. In the Priority dropdown, select: High\n3. Apply the filter',
   'Only punch items with priority "High" are shown in the list. Low and Medium priority items are hidden.',
   'MEDIUM', 'scenario', '/767/punch-list'),

  -- ── 7. Column Visibility ───────────────────────────────────────────────────
  ((SELECT id FROM suite), '7.1', 'Column Visibility', 'Hide and show columns',
   'Hide a column then show it again',
   'Checks that the column visibility control lets you customize which columns appear in the table.',
   NULL,
   E'1. Click the column selector button in the toolbar (looks like a list/columns icon)\n2. Uncheck "Trade" to hide it\n3. Close the column selector\n4. Open the column selector again and re-check "Trade"',
   'After unchecking, the Trade column disappears from the table. After re-checking, it reappears. All other columns remain unchanged throughout.',
   'LOW', 'scenario', '/767/punch-list'),

  -- ── 8. Export ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '8.1', 'Export', 'Export as CSV',
   'Download the punch list as a CSV file',
   'Checks that clicking the Export button downloads a spreadsheet-compatible file with all visible punch items.',
   'There must be at least one punch item in the list.',
   E'1. On the Punch List page, click the "Export" button (top right, next to "Create Punch Item")\n2. Click "CSV" from the dropdown menu\n3. Wait for the download to start',
   'A CSV file downloads to your computer. Opening it in a spreadsheet app shows columns including #, Title, Status, Priority, Assignee, Location, Trade, and Due Date. No error appears.',
   'MEDIUM', 'scenario', '/767/punch-list'),

  ((SELECT id FROM suite), '8.2', 'Export', 'Export as PDF',
   'Download the punch list as a PDF file',
   'Checks that a printable PDF version of the punch list can be downloaded.',
   'There must be at least one punch item in the list.',
   E'1. Click the "Export" button (top right)\n2. Click "PDF" from the dropdown menu\n3. Wait for the download to start',
   'A PDF file downloads. It contains the punch list items in a readable format. No error appears.',
   'MEDIUM', 'scenario', '/767/punch-list'),

  -- ── 9. Views ───────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '9.1', 'Views', 'Switch between table, card, and list views',
   'Switch between the three display styles',
   'Checks that all three view options — Table, Card, and List — display the punch items correctly without errors.',
   NULL,
   E'1. In the toolbar, find the view toggle (grid/list icons)\n2. Click "Card" view\n3. Look at how items are displayed\n4. Click "List" view\n5. Look at how items are displayed\n6. Switch back to "Table" view',
   'Card view shows each punch item as a card with title, status, assignee, and due date. List view shows compact rows. Table view shows the full data grid. No errors appear in any view.',
   'MEDIUM', 'scenario', '/767/punch-list')

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
 WHERE tool_name = 'punch-list';
