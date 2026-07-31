-- Seed: change-events feature suite
-- Generated: 2026-05-14
-- Re-runnable: upserts suite, wipes existing cases, re-inserts.

do $$
declare
  v_suite_id uuid;
begin

  insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
  values ('change-events', 'feature', 'Change Events — Feature', 0)
  on conflict (tool_name, suite_type) do update set
    display_name      = excluded.display_name,
    last_generated_at = now()
  returning id into v_suite_id;

  delete from public.test_cases where suite_id = v_suite_id;

  insert into public.test_cases
    (suite_id, test_number, category, subcategory, test_name,
     context_note, setup_steps, steps, expected_result, priority,
     test_type, start_url)
  values
    -- CREATE
    (v_suite_id, '1.1', 'Create', 'Happy path',
     'Create a change event with all required fields filled',
     'Verifies the core create flow saves a new record and auto-generates a number.',
     'Logged in as test1@mail.com.',
     E'1. Navigate to /67/change-events.\n2. Click "Create".\n3. Type "Electrical Panel Upgrade" in the Title field.\n4. Select Type = "Owner Change".\n5. Select Scope = "In Scope".\n6. Select Origin = "Internal".\n7. Select Status = "Open".\n8. Click "Save".\n9. Wait for the page to stop loading.',
     'The new change event is saved and its detail page opens. An auto-generated number (e.g., "001") is shown. After navigating back to the list, the new event appears with status "Open".',
     'HIGH', 'scenario', '/67/change-events/new'),

    (v_suite_id, '1.2', 'Create', 'All optional fields',
     'Create a change event with all optional fields filled',
     'Ensures every field on the form is persisted correctly.',
     'Logged in as test1@mail.com.',
     E'1. Navigate to /67/change-events/new.\n2. Fill in Title = "Roof Drain Reroute".\n3. Select Type = "Design Change", Scope = "TBD", Status = "Pending Approval", Origin = "RFI", Reason = "Design Development".\n4. Type a description in the Description field.\n5. Click "Save".',
     'The record is saved. The detail page shows all values correctly. After clicking Edit, all dropdowns pre-fill with the saved values.',
     'HIGH', 'scenario', '/67/change-events/new'),

    (v_suite_id, '1.3', 'Create', 'Required field validation',
     'Submitting without Title shows a validation error',
     'Confirms the form blocks saves when Title (required) is missing.',
     'Logged in as test1@mail.com.',
     E'1. Navigate to /67/change-events/new.\n2. Select Type = "Allowance" and Scope = "TBD" but leave Title blank.\n3. Click "Save".',
     'The form does not navigate away. A validation error message appears near the Title field. No new change event is created.',
     'HIGH', 'scenario', '/67/change-events/new'),

    (v_suite_id, '1.4', 'Create', 'Auto-number increment',
     'Each new change event receives the next sequential number',
     'Validates that number generation increments correctly and never duplicates.',
     'Logged in as test1@mail.com. Note the highest existing CE number.',
     E'1. Navigate to /67/change-events/new.\n2. Fill in Title = "Number Sequence Test", Type = "TBD", Scope = "TBD".\n3. Click "Save".\n4. Note the number assigned to the new record.',
     'The new record is assigned the next sequential 3-digit padded number (e.g., if the last was "003", the new one is "004"). Numbers do not skip or duplicate.',
     'HIGH', 'scenario', '/67/change-events/new'),

    -- READ / DETAIL
    (v_suite_id, '2.1', 'Read', 'Detail page fields',
     'Change event detail page shows all header fields',
     'Confirms the detail view displays every field saved during creation.',
     'Logged in as test1@mail.com. A change event with all fields filled exists.',
     E'1. Navigate to /67/change-events.\n2. Click on any change event row.\n3. Wait for the detail page to load.',
     'The detail page shows: Number, Title, Status, Type, Scope, Origin, Change Reason, Description, and the line items section. No blank fields where values should appear.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '2.2', 'Read', 'Line items expand',
     'Expanding a row in the list view shows line items inline',
     'Confirms the inline row expansion feature works for quick cost review.',
     'Logged in as test1@mail.com. A change event with at least one line item exists.',
     E'1. Navigate to /67/change-events.\n2. Locate a row on the "Line Items" tab.\n3. Click the expand chevron on that row.',
     'The row expands below the main row and shows a sub-table of line items with columns for Description, Budget Code, Revenue ROM, and Cost ROM.',
     'MEDIUM', 'scenario', '/67/change-events?tab=line_items'),

    (v_suite_id, '2.3', 'Read', 'Grand totals footer',
     'Grand totals row shows correct sums for Revenue ROM, Cost ROM, and Commitment',
     'Ensures financial totals stay accurate as the list filters.',
     'Logged in as test1@mail.com. Multiple change events with line items exist.',
     E'1. Navigate to /67/change-events.\n2. Wait for the table to load.\n3. Scroll to the bottom of the table.',
     'A "Grand Totals" row is pinned at the bottom. It shows the sum of Revenue (Prime PCO), Cost ROM, and Commitment columns. Values update when a status filter is applied.',
     'HIGH', 'scenario', '/67/change-events'),

    -- EDIT
    (v_suite_id, '3.1', 'Edit', 'Edit all header fields',
     'Edit an existing change event and save all changed fields',
     'Validates the edit flow persists all updated values.',
     'Logged in as test1@mail.com. A change event exists for project 67.',
     E'1. Navigate to /67/change-events.\n2. Click the row actions menu (⋯) for any change event and select "Edit".\n3. Change Title to "Updated Title - Roof Drain v2".\n4. Change Type to "Scope Gap".\n5. Change Scope to "Out of Scope".\n6. Click "Save".',
     'The record is saved. The detail page shows the updated title, type, and scope. After returning to the list, the row reflects the changes.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '3.2', 'Edit', 'Edit reopens with correct values',
     'Opening Edit pre-fills all dropdowns with current saved values',
     'Guards against the FK/dropdown mismatch pattern where saved values disappear on edit.',
     'Logged in as test1@mail.com. A change event with Type, Scope, Status, Origin, and Reason all set exists.',
     E'1. Navigate to /67/change-events.\n2. Open the row actions menu (⋯) for a change event with all fields set.\n3. Select "Edit".\n4. Inspect every dropdown without changing anything.',
     'Every dropdown (Type, Scope, Status, Origin, Reason) shows the previously saved value. No dropdown reads "Select..." instead of the saved value.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '3.3', 'Edit', 'Add line item',
     'Add a line item to an existing change event from the detail page',
     'Line items drive financial calculations — adding one must update totals.',
     'Logged in as test1@mail.com. A change event without line items exists.',
     E'1. Navigate to the detail page of a change event with no line items.\n2. Click "Add Line Item" (or the equivalent add button in the Line Items section).\n3. Enter Description = "Electrical conduit reroute".\n4. Enter Cost ROM = 5000.\n5. Save the line item.',
     'The line item appears in the line items table. The Cost ROM total on the change event updates to reflect the new value. The event appears in the "Line Items" tab.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '3.4', 'Edit', 'Edit line item',
     'Edit an existing line item and confirm totals recalculate',
     'Ensures inline line item edits propagate to the change event financial totals.',
     'Logged in as test1@mail.com. A change event with at least one line item exists.',
     E'1. Navigate to the detail page of a change event with a line item.\n2. Click the edit control on the line item row.\n3. Change Cost ROM from its current value to 12500.\n4. Save the change.',
     'The line item row shows 12500. The change event Cost ROM total updates accordingly.',
     'HIGH', 'scenario', '/67/change-events'),

    -- DELETE / RECYCLE BIN
    (v_suite_id, '4.1', 'Delete', 'Soft delete via row action',
     'Delete a change event via the row actions menu — moves it to Recycle Bin',
     'Confirms soft-delete works and the record is recoverable.',
     'Logged in as test1@mail.com. A change event exists that is safe to delete.',
     E'1. Navigate to /67/change-events.\n2. Click the row actions menu (⋯) for a change event.\n3. Select "Delete".\n4. Confirm the deletion in the dialog by clicking "Delete".\n5. Wait for the page to refresh.',
     'The change event disappears from the main list. A success toast "Change event moved to recycle bin" appears. Navigating to the "Recycle Bin" tab shows the deleted event.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '4.2', 'Delete', 'Bulk delete',
     'Select multiple change events and bulk delete them',
     'Validates the bulk-delete flow for batch clean-up operations.',
     'Logged in as test1@mail.com. At least two change events exist that are safe to delete.',
     E'1. Navigate to /67/change-events.\n2. Select the checkboxes for at least two change events.\n3. Click "Delete Selected" in the selection bar or toolbar.\n4. Confirm the dialog.\n5. Wait for the list to refresh.',
     'Both selected change events are removed from the main list. A success toast reports how many were moved to the recycle bin. Both appear in the Recycle Bin tab.',
     'HIGH', 'scenario', '/67/change-events'),

    -- STATUS TRANSITIONS
    (v_suite_id, '5.1', 'Status', 'Open to Pending Approval',
     'Change status from Open to Pending Approval',
     'Status transitions drive the approval workflow — this is the most common first transition.',
     'Logged in as test1@mail.com. A change event with status "Open" exists.',
     E'1. Navigate to the detail page of an "Open" change event.\n2. Click "Edit" (or the status dropdown).\n3. Change Status to "Pending Approval".\n4. Click "Save".',
     'The status badge on the detail page updates to "Pending Approval". The list view also shows the updated status.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '5.2', 'Status', 'Pending Approval to Approved',
     'Change status from Pending Approval to Approved',
     'Approval is required before a change event can be converted to a PCO.',
     'Logged in as test1@mail.com. A change event with status "Pending Approval" exists.',
     E'1. Open the edit view of a "Pending Approval" change event.\n2. Change Status to "Approved".\n3. Click "Save".',
     'Status updates to "Approved". The history log (if visible) records the transition.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '5.3', 'Status', 'Approved to Rejected',
     'Change status from Approved to Rejected',
     'Rejection path must be testable to ensure approvals can be revoked.',
     'Logged in as test1@mail.com. A change event with status "Approved" exists.',
     E'1. Open the edit view of an "Approved" change event.\n2. Change Status to "Rejected".\n3. Click "Save".',
     'Status updates to "Rejected". The status badge reflects the change in both the detail and list views.',
     'HIGH', 'scenario', '/67/change-events'),

    -- WORKFLOW
    (v_suite_id, '6.1', 'Workflow', 'Add to Prime PCO',
     'Add a change event to a Prime Contract PCO via "Add to" workflow',
     'This is the primary revenue conversion path — change event → PCO → prime contract.',
     'Logged in as test1@mail.com. An "Approved" change event and a prime contract exist for project 67.',
     E'1. Navigate to the detail page of an "Approved" change event.\n2. Click "Add to" or the equivalent workflow button.\n3. Select "Prime Contract Change Orders".\n4. Choose an existing prime contract.\n5. Confirm.',
     'The change event is linked to the prime contract PCO. The "Prime PCO" column on the list view shows the PCO number. The "sent_to_prime_pco" indicator is set.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '6.2', 'Workflow', 'Send RFQ',
     'Send a Request for Quote from a change event',
     'RFQs are how owners solicit subcontractor pricing — core workflow of the tool.',
     'Logged in as test1@mail.com. A change event exists for project 67.',
     E'1. Navigate to /67/change-events.\n2. Select the checkbox for one change event.\n3. Click "Send RFQ" in the selection bar.\n4. Fill in Title = "RFQ for Roof Drain".\n5. Set a due date.\n6. Click "Send".',
     'The RFQ is created. A success toast "RFQ sent successfully" appears. The change event now appears on the "RFQs" tab.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '6.3', 'Workflow', 'Add to Budget Change',
     'Add a change event to a budget change via the selection bar',
     'Budget integration is how cost impact flows to the budget module.',
     'Logged in as test1@mail.com. A change event exists for project 67.',
     E'1. Navigate to /67/change-events.\n2. Select the checkbox for one change event.\n3. Click "Add to Budget Change" in the selection bar.\n4. Follow the dialog prompts to link to an existing budget change or create a new one.\n5. Confirm.',
     'The dialog closes with a success message. The change event is linked to the budget change.',
     'MEDIUM', 'scenario', '/67/change-events'),

    -- FILTERS
    (v_suite_id, '7.1', 'Filters', 'Scope filter',
     'Scope filter shows only matching records',
     'Confirms the Scope filter works so users can isolate in-scope vs. out-of-scope items.',
     'Logged in as test1@mail.com. Change events with different scope values exist.',
     E'1. Navigate to /67/change-events.\n2. Open the filter panel.\n3. Set Scope = "Out of Scope".\n4. Apply and wait for the list to update.',
     'Only rows with scope "Out of Scope" appear. The count in the toolbar reflects the filtered total.',
     'MEDIUM', 'scenario', '/67/change-events'),

    (v_suite_id, '7.2', 'Filters', 'Conversion state filter',
     'Conversion State filter (Unlinked / Partially Linked / Fully Linked) narrows the list',
     'Validates the derived filter that checks PCO and commitment link status.',
     'Logged in as test1@mail.com. Change events with varying link states exist.',
     E'1. Navigate to /67/change-events.\n2. Open filters and set Conversion State = "Unlinked".\n3. Apply and wait.',
     'Only change events with no prime PCO and no commitment link are shown.',
     'MEDIUM', 'scenario', '/67/change-events'),

    (v_suite_id, '7.3', 'Filters', 'Clear filters',
     'Clearing all filters restores the full list',
     'Ensures users can exit a filtered state and see all records again.',
     'Logged in as test1@mail.com. An active filter is applied.',
     E'1. Navigate to /67/change-events.\n2. Apply Status = "Approved" filter.\n3. Click "Clear Filters" (or the X on the active filter chip).\n4. Wait for the list to update.',
     'All change events are shown again (the pre-filter total is restored). No filter indicators remain active.',
     'MEDIUM', 'scenario', '/67/change-events'),

    (v_suite_id, '7.4', 'Filters', 'Column sort',
     'Clicking a column header sorts the list',
     'Confirms the client-side sort works so users can order by number, status, etc.',
     'Logged in as test1@mail.com. Multiple change events exist.',
     E'1. Navigate to /67/change-events.\n2. Click the "Status" column header once.\n3. Then click it again.',
     'First click: rows sort ascending by status. Second click: rows sort descending by status. The column header shows a sort indicator arrow.',
     'MEDIUM', 'scenario', '/67/change-events'),

    -- EXPORT
    (v_suite_id, '8.1', 'Filters', 'CSV export',
     'Clicking the export button downloads a CSV file',
     'Export is used for budget review and reporting — it must produce a valid file.',
     'Logged in as test1@mail.com. At least one change event exists.',
     E'1. Navigate to /67/change-events.\n2. Click the export icon in the toolbar.\n3. Check the browser downloads.',
     'A file named "change-events-export.csv" is downloaded. The file contains a header row and at least one data row with columns: #, Title, Status, Scope, Type, Change Reason, Origin, Prime PCO, Cost ROM, Commitment, Created.',
     'MEDIUM', 'scenario', '/67/change-events'),

    -- VIEW MODES
    (v_suite_id, '9.1', 'Read', 'Card view',
     'Switching to card view renders change event cards',
     'Validates the card view mode so users can switch from tabular to a visual layout.',
     'Logged in as test1@mail.com. At least one change event exists.',
     E'1. Navigate to /67/change-events.\n2. Click the card view toggle in the toolbar.',
     'The list switches to a card grid. Each card shows the change event number, title, status, and scope. No layout errors.',
     'LOW', 'scenario', '/67/change-events'),

    (v_suite_id, '9.2', 'Read', 'List view',
     'Switching to list view renders compact rows',
     'Validates the third view mode (list) renders without breaking.',
     'Logged in as test1@mail.com. At least one change event exists.',
     E'1. Navigate to /67/change-events.\n2. Click the list view toggle in the toolbar.',
     'The layout switches to a condensed list of rows. Each row shows the event number, title, and status.',
     'LOW', 'scenario', '/67/change-events'),

    -- COLUMN VISIBILITY
    (v_suite_id, '9.3', 'Filters', 'Column visibility toggle',
     'Hiding a column via the column visibility panel removes it from the table',
     'Ensures column management works so users can customize their view.',
     'Logged in as test1@mail.com.',
     E'1. Navigate to /67/change-events.\n2. Click the column visibility icon in the toolbar.\n3. Toggle off the "Change Reason" column.\n4. Close the panel.',
     'The "Change Reason" column is no longer visible in the table. Other columns are unchanged. Refreshing the page should remember the preference.',
     'LOW', 'scenario', '/67/change-events'),

    -- PERMISSIONS
    (v_suite_id, '10.1', 'Permissions', 'Read-only user',
     'A user without write permission cannot see the Create button',
     'Confirms the PermissionGate hides the Create button for read-only roles.',
     'A second user account with read-only permission on change_orders module is configured.',
     E'1. Log in as the read-only user.\n2. Navigate to /67/change-events.',
     'The "Create" button is not visible. The list renders correctly. Row actions do not include "Edit" or "Delete".',
     'MEDIUM', 'scenario', '/67/change-events'),

    -- EDGE CASES
    (v_suite_id, '11.1', 'Edge', 'Title max length',
     'Title exceeding 255 characters shows a validation error',
     'Validates the max-length constraint to prevent DB truncation errors.',
     'Logged in as test1@mail.com.',
     E'1. Navigate to /67/change-events/new.\n2. Paste a string of 260 characters into the Title field.\n3. Select Type = "TBD", Scope = "TBD".\n4. Click "Save".',
     'The form shows a validation error: "Title must be less than 255 characters". The record is not saved.',
     'LOW', 'scenario', '/67/change-events/new'),

    (v_suite_id, '11.2', 'Edge', 'Recycle bin restore',
     'A deleted change event can be restored from the Recycle Bin',
     'Soft-delete is only useful if restoration works — this validates the undo path.',
     'Logged in as test1@mail.com. At least one change event is in the Recycle Bin.',
     E'1. Navigate to /67/change-events?tab=recycle_bin.\n2. Locate a deleted change event.\n3. Click the restore action for that event (row menu or restore button).\n4. Switch to the "All" tab.',
     'The restored change event reappears on the "All" tab. It is no longer in the Recycle Bin.',
     'MEDIUM', 'scenario', '/67/change-events?tab=recycle_bin'),

    (v_suite_id, '11.3', 'Edge', 'No line items empty state on Line Items tab',
     'The Line Items tab shows an empty state when all change events have no line items',
     'Confirms the empty state renders correctly for filtered tabs.',
     'Logged in as test1@mail.com. All change events for project 67 have no line items.',
     E'1. Navigate to /67/change-events.\n2. Click the "Line Items" tab.',
     'The table body is empty and an appropriate empty state message is shown (not a blank white area or loading spinner). No JavaScript error in the console.',
     'LOW', 'scenario', '/67/change-events?tab=line_items'),

    (v_suite_id, '11.4', 'Edge', 'Multiple RFQs per change event',
     'Sending a second RFQ to a change event that already has one does not break the RFQ tab count',
     'Guards against double-counting in the RFQ tab summary.',
     'Logged in as test1@mail.com. A change event with one existing RFQ exists.',
     E'1. Navigate to /67/change-events.\n2. Select the change event that already has an RFQ.\n3. Click "Send RFQ" and submit a second RFQ.\n4. Check the RFQ tab count.',
     'The RFQs tab count still shows 1 (not 2) for this change event — each CE is counted once regardless of how many RFQs it has.',
     'MEDIUM', 'scenario', '/67/change-events');

  update public.test_suites
     set total_cases = (select count(*) from public.test_cases where suite_id = v_suite_id)
   where id = v_suite_id;

end $$;
