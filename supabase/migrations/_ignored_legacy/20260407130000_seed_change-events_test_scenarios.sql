-- ============================================================================
-- Seed: Change Events Test Scenarios
-- Generated: 2026-04-07
-- Suite: change-events
-- Type: scenario (plain-English guided tests for non-technical testers)
-- Runner: http://localhost:3000/testing
-- 51 scenarios across 13 categories
-- ============================================================================

-- Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('change-events', 'Change Events', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();

-- Insert all scenarios
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'change-events')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

  -- ── 1. Navigation ──────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the Change Events page',
   'Checks that the Change Events page loads without errors and shows the list of records. A change event is a record of a potential cost or scope change on a project.',
   NULL,
   E'1. Make sure you are logged in to the app\n2. Click "Change Events" in the left sidebar under project "Vermillion Rise Warehouse"\n3. Wait for the page to stop loading',
   'The page loads fully. A table of change events is visible (or an empty state message). No error messages appear. The page title says "Change Events".',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '1.2', 'Navigation', 'Tabs',
   'Switch between the four list tabs',
   'Checks that the four tabs — Line Items, No Line Items, RFQs, Recycle Bin — each filter the list correctly.',
   NULL,
   E'1. On the Change Events page, click the "Line Items" tab\n2. Note how many records are shown\n3. Click "No Line Items" tab\n4. Click "RFQs" tab\n5. Click "Recycle Bin" tab',
   'Each tab shows a different filtered set of records. The counts in the tab badges match the number of visible rows. No errors appear.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '1.3', 'Navigation', 'Detail view',
   'Open a change event record',
   'Checks that clicking a row opens the detail page for that change event, where you can see all its information.',
   NULL,
   E'1. On the Change Events page, click any row in the table\n2. Wait for the page to stop loading',
   'The detail page opens. The title at the top shows the change event number and name. Six tabs are visible: General, Prime Contract Change Orders, Related Items, Comments, Emails, Change History.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '1.4', 'Navigation', 'Views',
   'Switch between table, card, and list views',
   'Checks that the three different display styles all work correctly for browsing change events.',
   'Make sure you are on the Change Events page.',
   E'1. Click the view toggle button in the toolbar (looks like a grid icon)\n2. Select "Card" view\n3. Look at the result\n4. Select "List" view\n5. Look at the result\n6. Switch back to "Table" view',
   'Each view style loads without errors. In Card view, records appear as cards. In List view, records appear as rows. Table view shows a full data grid.',
   'MEDIUM', 'scenario', '/67/change-events'),

  -- ── 2. Create ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '2.1', 'Create', 'Basic creation',
   'Create a new change event with required fields',
   'Checks that a user can create a new change event — the most basic record of a potential project cost or scope change — and that it saves correctly.',
   NULL,
   E'1. Click the "Create" button (top right of the Change Events page)\n2. In the Title field, type: Test Scope Change\n3. In the Type dropdown, select Owner Change\n4. In the Scope dropdown, select TBD\n5. Click the Save button\n6. Wait for the page to stop loading',
   'A success message appears. The app navigates to the detail page for the new change event. The title shows "Test Scope Change". A number like "001" or the next sequential number is shown. Status shows "Open".',
   'HIGH', 'scenario', '/67/change-events/new'),

  ((SELECT id FROM suite), '2.2', 'Create', 'All fields',
   'Create a change event with every field filled in',
   'Checks that all optional fields — description, origin, change reason, scope, etc. — save correctly and appear on the detail page.',
   NULL,
   E'1. Click "Create"\n2. Fill in Title: Full Fields Test\n3. Set Type: Design Change\n4. Set Status: Open\n5. Set Scope: Out of Scope\n6. Set Origin: RFI\n7. Set Change Reason: Client Request\n8. Type a description: Testing all fields\n9. Click Save',
   'All fields appear correctly on the detail page after saving. No fields are blank or showing a default placeholder when a specific value was chosen.',
   'MEDIUM', 'scenario', '/67/change-events/new'),

  ((SELECT id FROM suite), '2.3', 'Create', 'Validation',
   'Submitting without a title shows an error',
   'Checks that the form prevents saving if the Title field is left blank, so incomplete records cannot be created by accident.',
   NULL,
   E'1. Click "Create"\n2. Leave the Title field blank\n3. Fill in Type: Owner Change and Scope: TBD\n4. Click the Save button',
   'A red error message appears near the Title field saying it is required. The form does not save and does not navigate away.',
   'HIGH', 'scenario', '/67/change-events/new'),

  ((SELECT id FROM suite), '2.4', 'Create', 'Cancel',
   'Canceling create does not save anything',
   'Checks that pressing Cancel on the create form goes back to the list without creating any record.',
   NULL,
   E'1. Click "Create"\n2. Fill in Title: Should Not Be Saved\n3. Click the Cancel or Back button',
   'The app returns to the Change Events list. No new record named "Should Not Be Saved" appears in the list.',
   'HIGH', 'scenario', '/67/change-events/new'),

  ((SELECT id FROM suite), '2.5', 'Create', 'Auto-numbering',
   'Change events are numbered sequentially',
   'Checks that each new change event automatically gets the next sequential number, so records are easy to reference by number.',
   NULL,
   E'1. Create a change event titled Number Test A (note its number)\n2. Create another titled Number Test B (note its number)',
   'The second change event has a number exactly one higher than the first (e.g. if first is 005, second is 006). Numbers are formatted with leading zeros like "001".',
   'HIGH', 'scenario', '/67/change-events/new'),

  ((SELECT id FROM suite), '2.6', 'Create', 'Line items',
   'Create a change event with a cost line item',
   'Checks that when you add a line item (a specific cost detail) during creation, it is saved and the total reflects that cost.',
   'You will need a budget code to exist in the project.',
   E'1. Click "Create"\n2. Fill in Title: With Line Item Test\n3. Set Type: Owner Change, Scope: TBD\n4. Click "Add Line Item"\n5. Fill in Description: Test Labor\n6. Enter Cost ROM: 5000\n7. Click Save',
   'The change event is created. On the detail page, the line item "Test Labor" appears with a cost of $5,000. The total cost shown at the top reflects this amount.',
   'HIGH', 'scenario', '/67/change-events/new'),

  ((SELECT id FROM suite), '2.7', 'Create', 'Attachments',
   'Attach a file when creating a change event',
   'Checks that you can upload a supporting document (such as a photo or PDF) when creating a change event.',
   NULL,
   E'1. Click "Create"\n2. Fill in Title: Attachment Test\n3. Set Type and Scope\n4. Click the attachment/file upload area and select any small file from your computer\n5. Click Save',
   'The change event is created. On the detail page under the General tab, the attachment is visible with its filename. Clicking it downloads the file.',
   'MEDIUM', 'scenario', '/67/change-events/new'),

  ((SELECT id FROM suite), '2.8', 'Create', 'Expecting Revenue',
   'Create a change event with Expecting Revenue turned off',
   'Checks that when a change event is marked as not expecting revenue (meaning the project will absorb the cost without billing the client), the revenue columns show zero.',
   NULL,
   E'1. Click "Create"\n2. Fill in Title: No Revenue Test\n3. Set Type and Scope\n4. Find the "Expecting Revenue" toggle or checkbox and turn it OFF\n5. Add a line item with Cost ROM: 2000\n6. Click Save',
   'The change event is saved. On the list, the Revenue column for this record shows $0.00. The Cost ROM shows $2,000.',
   'MEDIUM', 'scenario', '/67/change-events/new'),

  -- ── 3. Edit ────────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '3.1', 'Edit', 'Basic edit',
   'Edit an existing change event title and scope',
   'Checks that changes made in the edit form are saved and appear correctly after refreshing the page.',
   NULL,
   E'1. On the Change Events list, click any row to open it\n2. Click the Edit button (top right of the detail page)\n3. Change the Title to: Updated Title Test\n4. Change the Scope to: In Scope\n5. Click Save\n6. Press Ctrl+R (or Cmd+R on Mac) to refresh the page',
   'After refreshing, the title shows "Updated Title Test" and the scope shows "In Scope". A success toast appeared after saving.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '3.2', 'Edit', 'Pre-filled dropdowns',
   'Edit form shows correct previously saved values',
   'Checks that when you open the edit form, every dropdown and field shows what was previously saved — not a blank placeholder. This is critical to avoid accidentally overwriting data.',
   NULL,
   E'1. Create a change event with Type: Design Change, Scope: Out of Scope, Origin: RFI\n2. Click on the record to open it\n3. Click Edit',
   'In the edit form, the Type dropdown shows "Design Change", the Scope dropdown shows "Out of Scope", and Origin shows "RFI". No dropdown shows a blank or "Select..." placeholder.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '3.3', 'Edit', 'Cancel edit',
   'Canceling edit discards all changes',
   'Checks that pressing Cancel on the edit form does not save any of the changes made.',
   NULL,
   E'1. Open a change event\n2. Click Edit\n3. Change the Title to: This Should Not Save\n4. Click Cancel Edit',
   'The page returns to the detail view. The title still shows the original value, not "This Should Not Save".',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '3.4', 'Edit', 'Edit from list',
   'Edit from the row action menu on the list',
   'Checks that the quick-edit shortcut in the table row menu works the same as editing from the detail page.',
   NULL,
   E'1. On the Change Events list, hover over any row\n2. Click the three-dot action menu that appears on the right\n3. Click "Edit"',
   'The edit form opens for that change event with all fields pre-filled.',
   'MEDIUM', 'scenario', '/67/change-events'),

  -- ── 4. Delete ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '4.1', 'Delete', 'Single delete',
   'Delete a change event and find it in the Recycle Bin',
   'Checks that deleting a record moves it to the Recycle Bin (soft delete) rather than permanently removing it, so it can be recovered if needed.',
   NULL,
   E'1. On the Change Events list, hover over a row\n2. Click the three-dot action menu\n3. Click "Delete"\n4. In the confirmation dialog that appears, click Delete\n5. Click the Recycle Bin tab',
   'The record disappears from the active list (Line Items, No Line Items tabs). It appears in the Recycle Bin tab. A success message was shown.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '4.2', 'Delete', 'Cancel delete',
   'Canceling delete leaves the record unchanged',
   'Checks that pressing Cancel in the delete confirmation dialog does not remove the record.',
   NULL,
   E'1. Hover over a row in the list\n2. Click the action menu → Delete\n3. In the confirmation dialog, click Cancel',
   'The dialog closes. The change event is still visible in the list, unchanged.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '4.3', 'Delete', 'Bulk delete',
   'Delete multiple records at once',
   'Checks that selecting multiple change events and deleting them all at once works correctly.',
   NULL,
   E'1. Check the checkbox on 2 or more rows\n2. Click the Delete Selected bulk action button that appears\n3. Confirm in the dialog',
   'All selected records are moved to the Recycle Bin. A message says how many were deleted (e.g. "2 change events moved to recycle bin").',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '4.4', 'Delete', 'Delete from detail',
   'Delete from the detail page action menu',
   'Checks that you can delete a record directly from its detail page.',
   NULL,
   E'1. Open any change event\n2. Click the three-dot (more options) menu at the top right\n3. Click "Delete"\n4. Confirm',
   'The app returns to the Change Events list. The deleted record is no longer shown in the active tabs.',
   'HIGH', 'scenario', '/67/change-events'),

  -- ── 5. Status & Workflow ───────────────────────────────────────────────────
  ((SELECT id FROM suite), '5.1', 'Status & Workflow', 'Submit for approval',
   'Move a change event from Open to Pending Approval',
   'Checks the first step of the approval process — submitting a change event for review. This is how a team signals that a potential cost change needs a decision.',
   NULL,
   E'1. Open a change event that has status Open\n2. Click the three-dot menu at the top right\n3. Click Submit for Approval',
   'The status badge on the detail page changes to "Pending". The "Submit for Approval" option is no longer in the menu. Two new options appear: "Approve" and "Reject".',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '5.2', 'Status & Workflow', 'Approve',
   'Approve a pending change event',
   'Checks that approving a pending change event updates its status and unlocks the Convert to Change Order action.',
   NULL,
   E'1. Open a change event with status Pending\n2. Click the three-dot menu\n3. Click Approve',
   'The status badge changes to "Approved". A new option "Convert to Change Order" appears in the action menu. The Approve/Reject options disappear.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '5.3', 'Status & Workflow', 'Reject',
   'Reject a pending change event',
   'Checks that rejecting a pending change event closes it, so it no longer moves through the approval process.',
   NULL,
   E'1. Open a change event with status Pending\n2. Click the three-dot menu\n3. Click Reject',
   'The status badge changes to "Closed". The Approve/Reject options disappear.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '5.4', 'Status & Workflow', 'Close',
   'Close a change event manually',
   'Checks that any non-closed change event can be manually closed via the action menu.',
   NULL,
   E'1. Open a change event with status Open\n2. Click the three-dot menu\n3. Click Close',
   'The status badge changes to "Closed". The Close option disappears from the menu.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '5.5', 'Status & Workflow', 'Convert to change order',
   'Convert an approved change event to a change order',
   'Checks the final step of the workflow — once a change event is approved, it can be converted to an official change order that updates the contract. A change order is the formal, signed agreement to change scope or cost.',
   NULL,
   E'1. Approve a change event (follow scenario 5.2 first)\n2. Click the three-dot menu\n3. Click Convert to Change Order\n4. Complete any fields in the dialog that appears\n5. Click Convert or Confirm\n6. Click the Prime Contract Change Orders tab',
   'The Prime Contract Change Orders tab shows the newly created change order linked to this change event. A success message was shown during conversion.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '5.6', 'Status & Workflow', 'Workflow gate',
   'Convert option is hidden until status is Approved',
   'Checks that the Convert to Change Order option is only visible when the record is actually approved — preventing premature conversion.',
   NULL,
   E'1. Open a change event with status Open\n2. Click the three-dot menu and review the options',
   'The "Convert to Change Order" option is NOT visible in the menu when status is Open or Pending.',
   'HIGH', 'scenario', '/67/change-events'),

  -- ── 6. Calculations ────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '6.1', 'Calculations', 'Cost totals',
   'Footer totals sum all visible cost ROMs',
   'Checks that the grand total row at the bottom of the table correctly adds up all the cost figures for the rows currently shown.',
   NULL,
   E'1. On the Change Events list, make sure at least 2 records are visible\n2. Look at the footer row at the bottom of the table',
   'A "Grand Totals" row shows the sum of Revenue (Prime PCO), Cost ROM, and Commitment columns. The numbers match what you would get adding up the individual rows.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '6.2', 'Calculations', 'Markup',
   'Project markup is applied to cost ROM',
   'Checks that project-level markup percentages (e.g. overhead, profit) are automatically added on top of the base cost when calculating totals.',
   NULL,
   E'1. Create a change event with a line item cost of $10,000\n2. View the Cost ROM value on the list for this record',
   'If the project has markup configured (e.g. 10%), the Cost ROM shown should be $11,000, not $10,000. The markup is added automatically.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '6.3', 'Calculations', 'Filter totals',
   'Totals update when a filter is applied',
   'Checks that the grand totals at the bottom of the list change when you filter the list, so the totals always match what is visible.',
   NULL,
   E'1. Note the grand total amounts with no filters applied\n2. Apply a Status filter: Open\n3. Look at the grand totals again',
   'The totals change to reflect only the filtered records. If you had 5 records totaling $50,000 and 3 are "Open" totaling $30,000, the filtered total shows $30,000.',
   'HIGH', 'scenario', '/67/change-events'),

  -- ── 7. Filters & Search ────────────────────────────────────────────────────
  ((SELECT id FROM suite), '7.1', 'Filters & Search', 'Search by number',
   'Search for a change event by its number',
   'Checks that typing a change event number in the search box filters the list to matching records.',
   NULL,
   E'1. On the Change Events page, find the search box in the toolbar\n2. Type the number of a known change event (e.g. 001)\n3. Wait a moment for results to update',
   'Only change events whose number contains "001" are shown. All other rows disappear.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '7.2', 'Filters & Search', 'Search by title',
   'Search for a change event by part of its title',
   'Checks that the search box also works on titles, not just numbers.',
   'Make sure at least one change event exists with a known title.',
   E'1. Type part of a known title in the search box\n2. Wait for the list to update',
   'Only change events whose title contains the typed text are shown.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '7.3', 'Filters & Search', 'Filter by status',
   'Filter the list to show only Open change events',
   'Checks that the status filter narrows the list correctly.',
   NULL,
   E'1. Click the Filters button in the toolbar\n2. Select Status: Open\n3. Apply the filter',
   'Only records with status "Open" are shown. Records with other statuses disappear.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '7.4', 'Filters & Search', 'Filter by scope',
   'Filter the list to show only Out of Scope events',
   'Checks that the scope filter works.',
   NULL,
   E'1. Click Filters\n2. Select Scope: Out of Scope\n3. Apply',
   'Only out-of-scope records are shown.',
   'MEDIUM', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '7.5', 'Filters & Search', 'Clear filters',
   'Clearing a filter restores the full list',
   'Checks that after applying a filter you can get back to seeing all records.',
   NULL,
   E'1. Apply any filter\n2. Click the X or Clear Filters button to remove the filter',
   'The full unfiltered list reappears.',
   'MEDIUM', 'scenario', '/67/change-events'),

  -- ── 8. Export & Reports ────────────────────────────────────────────────────
  ((SELECT id FROM suite), '8.1', 'Export & Reports', 'CSV list export',
   'Export the full list of change events as a spreadsheet',
   'Checks that clicking the export button downloads a CSV file that can be opened in Excel or Google Sheets.',
   NULL,
   E'1. On the Change Events page, click the export (download) icon in the toolbar\n2. Wait for the download to start',
   'A file named "change-events-export.csv" downloads. Opening it in a spreadsheet app shows columns: #, Title, Status, Scope, Type, Change Reason, Origin, Prime PCO, Cost ROM, Commitment, Created.',
   'MEDIUM', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '8.2', 'Export & Reports', 'CSV detail export',
   'Export a single change event as a CSV',
   'Checks that you can export the details of one change event as a CSV file from the detail page.',
   NULL,
   E'1. Open any change event\n2. Click the three-dot menu\n3. Click Export as CSV',
   'A CSV file downloads named like "change-event-001.csv". It contains field names and their values.',
   'LOW', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '8.3', 'Export & Reports', 'PDF export',
   'Export a single change event as a PDF',
   'Checks that a printable PDF version of the change event can be downloaded.',
   NULL,
   E'1. Open any change event\n2. Click the three-dot menu\n3. Click Export as PDF\n4. Wait for the download',
   'A PDF file downloads. It contains the change event details in a readable format.',
   'MEDIUM', 'scenario', '/67/change-events'),

  -- ── 9. Collaboration ───────────────────────────────────────────────────────
  ((SELECT id FROM suite), '9.1', 'Collaboration', 'Comment',
   'Add a comment to a change event',
   'Checks that team members can leave notes or questions on a change event for others to see.',
   NULL,
   E'1. Open any change event\n2. Click the Comments tab\n3. Type: This is a test comment\n4. Click the Send or Submit button',
   'The comment "This is a test comment" appears in the Comments tab with your name and the current date/time.',
   'MEDIUM', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '9.2', 'Collaboration', 'Email change event',
   'Send a change event by email',
   'Checks that you can email the change event details to someone directly from the app.',
   NULL,
   E'1. Open any change event\n2. Click the three-dot menu\n3. Click Email Change Event\n4. Fill in a recipient email address\n5. Click Send',
   'The email dialog closes after sending. A success message appears. No error is shown.',
   'MEDIUM', 'scenario', '/67/change-events'),

  -- ── 10. Attachments ────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '10.1', 'Attachments', 'Upload attachment',
   'Upload a document to a change event',
   'Checks that supporting files (photos, PDFs, specs) can be attached to a change event on the detail page.',
   NULL,
   E'1. Open any change event detail\n2. In the General tab, find the attachments area\n3. Click Upload or drag a file into the area\n4. Select any small file from your computer',
   'The file appears in the attachments list with its filename. No error message is shown.',
   'MEDIUM', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '10.2', 'Attachments', 'Delete attachment',
   'Remove an attachment from a change event',
   'Checks that attachments can be removed when no longer needed.',
   NULL,
   E'1. Open a change event that has at least one attachment\n2. Click the delete (trash) icon next to an attachment\n3. Confirm if prompted',
   'The attachment is removed from the list. It no longer appears after refreshing the page.',
   'MEDIUM', 'scenario', '/67/change-events'),

  -- ── 11. Integrations ───────────────────────────────────────────────────────
  ((SELECT id FROM suite), '11.1', 'Integrations', 'RFQ',
   'Send a Request for Quote (RFQ) from a change event',
   'Checks that you can request pricing from a vendor directly from a change event. An RFQ is a formal request asking a vendor how much something will cost.',
   NULL,
   E'1. On the Change Events list, check the checkbox on one change event to select it\n2. Click the Send RFQ button that appears\n3. Fill in the RFQ Title and Due Date fields\n4. Click Submit',
   'A success toast appears. The change event now appears in the RFQs tab. The "RFQ" column on the list shows the RFQ title for that record.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '11.2', 'Integrations', 'RFQ validation',
   'Sending an RFQ without selecting a record shows an error',
   'Checks that the RFQ button requires you to select a change event first.',
   NULL,
   E'1. Make sure no rows are checked/selected\n2. Try to click the Send RFQ button (if visible)',
   'An error message appears: "Select a change event before sending an RFQ." No RFQ dialog opens.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '11.3', 'Integrations', 'Related items',
   'Link a related item to a change event',
   'Checks that you can connect a change event to other records in the system (like an RFI or another document) to show they are related.',
   NULL,
   E'1. Open a change event detail\n2. Click the Related Items tab\n3. Click the Add or Link button\n4. Select a type (e.g. RFI)\n5. Select an existing item from the list\n6. Confirm',
   'The item appears in the Related Items tab with its type and title. No error is shown.',
   'MEDIUM', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '11.4', 'Integrations', 'Unlink related item',
   'Remove a linked related item',
   'Checks that a previously linked related item can be removed.',
   NULL,
   E'1. Open a change event with at least one related item in the Related Items tab\n2. Click the unlink or remove button next to the item\n3. Confirm if prompted',
   'The item is removed from the Related Items list.',
   'MEDIUM', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '11.5', 'Integrations', 'Prime Contract COs tab',
   'Prime Contract Change Orders tab shows linked COs',
   'Checks that after converting a change event to a change order, the link is visible in the Prime Contract Change Orders tab.',
   NULL,
   E'1. Convert an approved change event to a change order (see scenario 5.5)\n2. Open that change event\n3. Click the Prime Contract Change Orders tab',
   'The change order that was created appears in this tab with its number and title.',
   'HIGH', 'scenario', '/67/change-events'),

  -- ── 12. History ────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '12.1', 'History', 'Audit trail',
   'Change History tab records every status change',
   'Checks that every time a change event is updated, a log entry is created so you can see what changed, who changed it, and when.',
   NULL,
   E'1. Open a change event\n2. Click Submit for Approval to change its status\n3. Click the Change History tab',
   'A new entry appears in the Change History tab. It shows: the field that changed ("status"), the old value, the new value, the name of the person who made the change, and the date/time.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '12.2', 'History', 'Creation log',
   'Change History records when a record was created',
   'Checks that creating a change event automatically logs the creation event in the history.',
   NULL,
   E'1. Create a new change event\n2. Open it and click the Change History tab',
   'At least one history entry exists with change type "CREATE".',
   'MEDIUM', 'scenario', '/67/change-events'),

  -- ── 13. Edge Cases ─────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '13.1', 'Edge Cases', 'Empty state',
   'Empty state appears when no change events exist',
   'Checks that the page shows a helpful message rather than a blank screen when there are no change events yet.',
   NULL,
   E'1. If you are on a project with no change events, navigate to /67/change-events (or filter so no results show)\n2. Look at the main content area',
   'A message appears saying "No change events found" or similar. A button to "Add change event" is visible. No blank white space or error.',
   'MEDIUM', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '13.2', 'Edge Cases', 'Column visibility',
   'Hide and show table columns',
   'Checks that the column visibility control lets you customize which columns appear in the table, and that the preference is remembered during your session.',
   NULL,
   E'1. Click the column selector button in the toolbar\n2. Uncheck "Scope" to hide it\n3. Close the column selector',
   'The Scope column disappears from the table. The rest of the columns still show correctly.',
   'LOW', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '13.3', 'Edge Cases', 'Expand row',
   'Expand a row to see its line items without opening the detail page',
   'Checks that line items can be previewed directly in the list without navigating away.',
   NULL,
   E'1. Find a change event in the "Line Items" tab (it has at least one line item)\n2. Click the expand toggle (arrow or chevron) on the left of the row',
   'A sub-table appears below the row showing the line items: budget code, description, cost ROM, revenue ROM, vendor, and commitment columns.',
   'HIGH', 'scenario', '/67/change-events?tab=line_items')

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
 WHERE tool_name = 'change-events';
