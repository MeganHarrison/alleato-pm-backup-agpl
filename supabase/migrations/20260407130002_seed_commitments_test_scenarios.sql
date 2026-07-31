-- Migration: Seed Commitments test scenarios
-- Generated: 2026-04-07
-- Tool: commitments
-- Type: scenario (plain-English guided tests for non-technical testers)

-- Upsert the test suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('commitments', 'Commitments', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Seed all scenario test cases
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'commitments')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES
  -- Navigation
  ((SELECT id FROM suite), 'S1.1', 'Navigation', 'Page load',
   'Open the Commitments page',
   'A commitment is a contract with a subcontractor or vendor — for example, an agreement to pay a roofing company $50,000 to complete the roof. This test checks the page loads without errors.',
   'Make sure you are logged in as test1@mail.com.',
   E'1. Click "Commitments" in the left sidebar under project "Vermillion Rise Warehouse"\n2. Wait for the page to stop loading',
   'The Commitments page loads. A table is visible with columns including Number, Contract Company, Title, and Status. No error messages appear.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S1.2', 'Navigation', 'Tab filter',
   'Switch to the Subcontracts tab',
   'Checks that clicking the Subcontracts tab filters the list to show only subcontract-type commitments.',
   'Be on the Commitments page at /67/commitments.',
   E'1. Click the "Subcontracts" tab near the top of the page\n2. Wait for the page to stop loading',
   'Only subcontract-type commitments appear. The Subcontracts tab is highlighted as active.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S1.3', 'Navigation', 'Tab filter',
   'Switch to the Purchase Orders tab',
   'Checks that clicking the Purchase Orders tab filters to show only purchase order commitments.',
   'Be on the Commitments page.',
   E'1. Click the "Purchase Orders" tab near the top of the page\n2. Wait for the page to stop loading',
   'Only purchase order commitments appear. The Purchase Orders tab is highlighted.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S1.4', 'Navigation', 'Recycle bin',
   'Open the Recycle Bin tab',
   'Checks that deleted commitments are moved to the Recycle Bin rather than permanently erased.',
   'Be on the Commitments page.',
   E'1. Click the "Recycle Bin" tab\n2. Wait for the page to stop loading',
   'The Recycle Bin tab loads. Either a list of deleted commitments is shown, or an empty state message says there are no deleted commitments.',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- Create Subcontract
  ((SELECT id FROM suite), 'S2.1', 'Create', 'Create Subcontract',
   'Create a new Subcontract',
   'A commitment is a contract with a subcontractor or vendor. A Subcontract is used when hiring a company to perform labor on the project (like plumbing or electrical work). This test checks the full creation flow.',
   'Be on the Commitments page. There must be at least one vendor in the project directory.',
   E'1. Click the blue "Create" button in the top right\n2. Select "Subcontract" from the dropdown\n3. Wait for the form to load\n4. Type SC-TEST-001 in the "Contract Number" field\n5. Type Test Subcontract in the "Title" field\n6. Select any company from the "Contract Company" dropdown\n7. Click the Create button at the bottom\n8. Wait for the page to stop loading',
   'You are redirected to the Commitments list. A new row appears with Number SC-TEST-001, Title "Test Subcontract", and Status "Draft".',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S2.2', 'Create', 'Create Subcontract',
   'Create a Subcontract with all optional fields filled in',
   'Checks that every optional field on the subcontract form saves correctly — dates, retention percentage, accounting method, and scope notes.',
   'Be on the Commitments page.',
   E'1. Click "Create" then "Subcontract"\n2. Fill in Contract Number: SC-FULL-001\n3. Fill in Title: Full Fields Subcontract\n4. Select a Contract Company\n5. Fill in Description: Test description\n6. Set Start Date to today''s date\n7. Set Estimated Completion to one month from today\n8. Set Contract Date to today\n9. Set Retention to 10\n10. Select "Amount Based" for Accounting Method\n11. Click Create',
   'The subcontract is created. Opening the detail page shows all fields saved correctly including dates, retention at 10%, and Accounting Method as Amount Based.',
   'MEDIUM', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S2.3', 'Create', 'Validation',
   'Subcontract form blocks submission when Title is missing',
   'Checks that you cannot accidentally save a subcontract without a title, which would make it impossible to identify later.',
   'Be on the new subcontract form.',
   E'1. Click "Create" then "Subcontract"\n2. Fill in Contract Number: SC-NOVAL-001\n3. Leave the Title field completely blank\n4. Select a Contract Company\n5. Click Create',
   'A red validation error appears near the Title field. The form does not submit and you stay on the form page.',
   'HIGH', 'scenario', '/67/commitments/new?type=subcontract'),

  ((SELECT id FROM suite), 'S2.4', 'Create', 'Validation',
   'Subcontract form cancel returns to list',
   'Checks that clicking Cancel discards all entered data and returns to the commitments list without saving anything.',
   'Be on the new subcontract form.',
   E'1. Click "Create" then "Subcontract"\n2. Type SC-CANCEL-001 in Contract Number\n3. Type Should Not Save in Title\n4. Click the Cancel button (or click the back arrow)',
   'You are returned to the Commitments list. No new entry for "Should Not Save" appears in the list.',
   'HIGH', 'scenario', '/67/commitments/new?type=subcontract'),

  -- Create Purchase Order
  ((SELECT id FROM suite), 'S3.1', 'Create', 'Create Purchase Order',
   'Create a new Purchase Order',
   'A Purchase Order (PO) is a commitment to pay a supplier for materials or equipment — for example, ordering lumber or steel. This test checks the PO creation flow works correctly.',
   'Be on the Commitments page.',
   E'1. Click "Create" then "Purchase Order"\n2. Type PO-TEST-001 in the "Contract Number" field\n3. Type Test Purchase Order in the "Title" field\n4. Select a Contract Company\n5. Click Create\n6. Wait for the page to stop loading',
   'You are redirected to the Commitments list. A new row appears with Number PO-TEST-001 and Status "Draft".',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S3.2', 'Create', 'Validation',
   'Purchase Order form blocks submission when Title is missing',
   'Checks the form validates required fields for POs the same way it does for subcontracts.',
   'Be on the new purchase order form.',
   E'1. Click "Create" then "Purchase Order"\n2. Fill in Contract Number: PO-NOVAL-001\n3. Leave the Title field blank\n4. Click Create',
   'A validation error appears near the Title field. The form does not submit.',
   'HIGH', 'scenario', '/67/commitments/new?type=purchase_order'),

  -- Edit
  ((SELECT id FROM suite), 'S4.1', 'Edit', 'Edit Commitment',
   'Edit a commitment to change the title',
   'Checks that editing a commitment saves the changes and they are visible after refreshing the page.',
   'There must be at least one commitment in the list. Open the detail page for any commitment.',
   E'1. Open any commitment from the list\n2. Click the pencil (Edit) icon in the top right of the page\n3. Clear the Title field and type Updated Title Test\n4. Click Save\n5. Press Ctrl+R (Cmd+R on Mac) to refresh the page',
   'After refreshing, the title shows "Updated Title Test". The page heading reflects the new title.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S4.2', 'Edit', 'Edit Commitment',
   'Edit a commitment to change the status',
   'Checks that the status of a commitment can be changed and the colored status badge updates correctly.',
   'Open any Draft commitment on its detail page.',
   E'1. Click the pencil (Edit) icon\n2. Find the Status dropdown\n3. Select "Approved"\n4. Click Save\n5. Wait for the page to reload',
   'The status badge changes from "Draft" to "Approved". The list view also shows the updated status.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S4.3', 'Edit', 'Edit Commitment',
   'Cancel editing does not save changes',
   'Checks that clicking Cancel on the edit form discards all unsaved changes and returns to the original values.',
   'Open any commitment on its detail page.',
   E'1. Click the pencil (Edit) icon\n2. Change the Title to DO NOT SAVE\n3. Click Cancel',
   'You are returned to the detail view. The title still shows the original value, not "DO NOT SAVE".',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S4.4', 'Edit', 'Edit Commitment',
   'Edit the retention percentage',
   'The retention percentage is the amount withheld from each payment until the work is complete. This test checks it saves correctly.',
   'Open any commitment edit form.',
   E'1. Click Edit on any commitment\n2. Find the "Retention %" field\n3. Clear the field and type 5\n4. Click Save',
   'The Contract Settings section on the detail page shows Retention at 5%.',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- Delete
  ((SELECT id FROM suite), 'S5.1', 'Delete', 'Delete Commitment',
   'Delete a single commitment using the row action menu',
   'Checks that clicking delete from the list removes the commitment (or moves it to the recycle bin for later recovery).',
   'There must be at least one commitment you are okay deleting. Be on the Commitments list.',
   E'1. Hover over any commitment row\n2. Click the three-dot action menu icon on the right side of the row\n3. Click "Delete"\n4. Read the confirmation dialog and click the Delete button to confirm',
   'The commitment disappears from the list. A success message (toast notification) briefly appears at the bottom of the screen.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S5.2', 'Delete', 'Delete Commitment',
   'Cancel delete keeps the commitment',
   'Checks the Cancel button on the delete confirmation dialog works — clicking Cancel should not delete anything.',
   'Be on the Commitments list.',
   E'1. Hover over any commitment row\n2. Click the action menu then "Delete"\n3. When the confirmation dialog appears, click Cancel',
   'The dialog closes. The commitment is still visible in the list.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S5.3', 'Delete', 'Bulk Delete',
   'Bulk delete multiple commitments',
   'Checks that you can select multiple commitments at once and delete them all together in one action.',
   'There must be at least 2 commitments in the list that you are okay deleting.',
   E'1. Click the checkbox on the left of at least 2 commitment rows\n2. Look for a "Delete" button that appears in the toolbar at the top\n3. Click it\n4. Confirm the deletion in the dialog that appears',
   'All selected commitments are removed from the list. A success toast shows how many were deleted.',
   'HIGH', 'scenario', '/67/commitments'),

  -- Schedule of Values
  ((SELECT id FROM suite), 'S6.1', 'Schedule of Values', 'SOV',
   'Add a line item to the Schedule of Values',
   'The Schedule of Values (SOV) is a breakdown of what work is included in the contract and how much each part costs. For example: Framing = $10,000, Plumbing = $5,000. This test checks you can add a line item.',
   'Open any commitment that is in Draft status. You should be on the commitment detail page.',
   E'1. Click the "SC SOV" or "PO SOV" tab (depending on whether it is a subcontract or purchase order)\n2. Click the "Add Line Item" button (or a plus button)\n3. Type Framing in the Description field\n4. Type 10000 in the Amount field\n5. Click Save',
   'A new line item appears in the SOV table with description "Framing" and amount $10,000. The SOV Total increases by $10,000.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S6.2', 'Schedule of Values', 'SOV',
   'Edit an existing SOV line item',
   'Checks that you can change the amount on an existing SOV line item and the total automatically updates.',
   'Open a commitment that has at least one SOV line item.',
   E'1. Click the SOV tab\n2. Click the Edit button or click on the amount of an existing line item\n3. Change the amount to 20000\n4. Click Save',
   'The line item amount shows $20,000 and the SOV Total updates to reflect the new amount.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S6.3', 'Schedule of Values', 'SOV',
   'Delete a SOV line item',
   'Checks that you can remove an unwanted line item from the Schedule of Values.',
   'Open a commitment with at least one SOV line item.',
   E'1. Click the SOV tab\n2. Click the delete button (trash icon) next to a line item\n3. Confirm if a confirmation prompt appears',
   'The line item is removed from the table. The SOV Total decreases by that item''s amount.',
   'HIGH', 'scenario', '/67/commitments'),

  -- Subcontractor SOV
  ((SELECT id FROM suite), 'S7.1', 'Subcontractor SOV', 'SSOV',
   'Subcontractor SOV tab only appears on Subcontracts',
   'The Subcontractor SOV is a detailed cost breakdown submitted by the subcontractor. It only exists on Subcontracts, not Purchase Orders. This test checks the tab visibility rule works.',
   'Have at least one Subcontract and one Purchase Order in the list.',
   E'1. Open a Subcontract detail page\n2. Look at the row of tabs and find "Subcontractor SOV"\n3. Go back to the list\n4. Open a Purchase Order detail page\n5. Look at the row of tabs',
   'The Subcontract detail has a "Subcontractor SOV" tab. The Purchase Order detail does NOT have this tab.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S7.2', 'Subcontractor SOV', 'SSOV',
   'Submit a Subcontractor SOV',
   'Checks that the subcontractor SOV can be submitted once all amounts are fully allocated. The Submit button is disabled until the "Remaining to Allocate" field shows $0.00.',
   'Open a Subcontract that has SOV line items. Click the Subcontractor SOV tab.',
   E'1. On the Subcontractor SOV tab, add line item rows\n2. Make sure the Remaining to Allocate field shows $0.00 (all amounts are fully broken down)\n3. Click the Submit button',
   'The SSOV status changes to "Under Review". The Submit button becomes greyed out (inactive).',
   'HIGH', 'scenario', '/67/commitments'),

  -- Change Orders
  ((SELECT id FROM suite), 'S8.1', 'Change Orders', 'CCO Tab',
   'View Change Orders linked to a commitment',
   'Checks that the Change Orders tab loads and shows any change orders that modify this contract.',
   'Open any commitment detail page.',
   E'1. Click the "Change Orders" tab on the commitment detail page\n2. Wait for the tab to load',
   'The Change Orders tab shows either a list of change orders or an empty state message saying there are none yet. No error appears.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S8.2', 'Change Orders', 'Create CCO',
   'Create a Change Event from a commitment',
   'A change order is an official modification to a contract amount or scope. This test checks the "Create Change Event" action is accessible from the commitment detail.',
   'Open a commitment detail page.',
   E'1. Click the "Create" button in the top right\n2. Select "Change Event" from the dropdown',
   'Either you are navigated to a change event creation form, or a guidance message appears. No error toast appears.',
   'HIGH', 'scenario', '/67/commitments'),

  -- Invoices
  ((SELECT id FROM suite), 'S9.1', 'Invoices', 'Invoice Tab',
   'View Invoices tab on a commitment',
   'Checks that the Invoices tab loads and shows any invoices submitted against this contract.',
   'Open any commitment detail page.',
   E'1. Click the "Invoices" tab\n2. Wait for the tab to load',
   'The Invoices tab loads. Either a list of invoices is shown or an empty state message. No error appears.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S9.2', 'Invoices', 'Create Invoice',
   'Create an invoice from a commitment',
   'Checks that clicking Create > Invoice takes you to the invoice creation form with the commitment pre-linked.',
   'Open any commitment detail page.',
   E'1. Click the "Create" button in the top right\n2. Select "Invoice" from the dropdown\n3. Wait for the page to load',
   'You are taken to an invoice creation form. The form is pre-filled with the commitment''s information.',
   'HIGH', 'scenario', '/67/commitments'),

  -- Payments
  ((SELECT id FROM suite), 'S10.1', 'Payments Issued', 'Payments Tab',
   'View Payments Issued tab on a commitment',
   'Checks that the Payments Issued tab loads and shows payments recorded against this contract.',
   'Open any commitment detail page.',
   E'1. Click the "Payments Issued" tab\n2. Wait for the tab to load',
   'The Payments Issued tab loads. Either payments are listed or an empty state message appears. No error.',
   'HIGH', 'scenario', '/67/commitments'),

  -- Financial KPIs
  ((SELECT id FROM suite), 'S11.1', 'Financial KPIs', 'KPI Strip',
   'KPI strip shows 5 financial summary blocks',
   'The 5 summary blocks at the top of the commitment detail give a quick financial snapshot. This test checks all 5 appear and show dollar values.',
   'Open any commitment detail page.',
   E'1. Look at the top area of the commitment detail page, just below the title and description\n2. Count the colored summary blocks',
   'Exactly 5 summary blocks are visible: "Original Contract", "Approved COs", "Revised Contract", "Billed to Date", and "Balance to Finish". Each shows a dollar amount.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S11.2', 'Financial KPIs', 'KPI Strip',
   'Revised Contract equals Original plus Approved COs',
   'Checks that the financial math is correct: Revised Contract Amount should always equal Original Amount plus all Approved Change Orders.',
   'Open a commitment that has at least one approved change order.',
   E'1. Note the "Original Contract" dollar amount in the top summary strip\n2. Note the "Approved COs" dollar amount\n3. Add those two numbers together in your head (or on paper)\n4. Compare your total to the "Revised Contract" amount shown',
   'The "Revised Contract" amount exactly equals Original Contract plus Approved COs. The math is correct.',
   'HIGH', 'scenario', '/67/commitments'),

  -- Search & Filter
  ((SELECT id FROM suite), 'S12.1', 'Search & Filter', 'Search',
   'Search for a commitment by contract number',
   'Checks that typing in the search box filters the list to show only commitments matching what you typed.',
   'Be on the Commitments list. There must be at least one commitment.',
   E'1. Click the search box labeled "Search commitments..."\n2. Type the contract number of a commitment you know exists\n3. Wait for the list to update (it may update as you type)',
   'Only commitments matching the contract number are shown. The list shrinks to the matching result(s).',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S12.2', 'Search & Filter', 'Filter',
   'Filter by commitment status',
   'Checks that applying a status filter shows only commitments with that specific status.',
   'Be on the Commitments list with at least one commitment in Draft status.',
   E'1. Click the "Filters" button in the toolbar\n2. Find the Status filter option\n3. Select "Draft"\n4. Apply the filter',
   'Only commitments with status "Draft" appear in the list. Commitments with other statuses are hidden.',
   'MEDIUM', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), 'S12.3', 'Search & Filter', 'Sort',
   'Sort list by Original Contract Amount',
   'Checks that clicking a column header sorts the list by that column value.',
   'Be on the Commitments list with at least 2 commitments that have different contract amounts.',
   E'1. Click the "Original Contract Amount" column header\n2. Click it a second time to reverse the sort direction',
   'First click: commitments sort from lowest to highest amount. Second click: they sort from highest to lowest.',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- Export
  ((SELECT id FROM suite), 'S13.1', 'Export', 'Export',
   'Export the commitments list',
   'Checks that the export function lets you download commitment data as a file you can open in Excel or similar.',
   'Be on the Commitments list.',
   E'1. Look for an Export button or download icon in the toolbar at the top of the table\n2. Click it\n3. If a dialog appears, select a format (such as CSV or Excel) and click Export or Download',
   'A file downloads to your computer containing the commitment data. The file opens without errors and contains the commitment rows.',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- ERP Sync
  ((SELECT id FROM suite), 'S14.1', 'ERP Integration', 'Sync',
   'Sync commitments from Acumatica',
   'Commitments can be imported automatically from the accounting system (Acumatica). This test checks the sync button runs and shows a result message.',
   'Be on the Commitments list.',
   E'1. Look for a circular refresh/sync icon in the toolbar\n2. Hover over it to see the tooltip — it should say "Sync commitments from Acumatica"\n3. Click the icon\n4. Wait for it to finish (the icon will spin and then stop)',
   'A success message appears at the bottom of the screen showing how many commitments were created or updated. The icon stops spinning.',
   'HIGH', 'scenario', '/67/commitments'),

  -- Emails
  ((SELECT id FROM suite), 'S15.1', 'Collaboration', 'Email',
   'Email a commitment document to someone',
   'Checks that you can send the commitment document as an email directly from the detail page — useful for sending contract details to a subcontractor.',
   'Open any commitment detail page.',
   E'1. Click the envelope (mail) icon in the top right header area of the commitment detail\n2. Wait for the email dialog to open',
   'The email dialog opens without errors. It shows fields for recipient, subject, and message. No error toast appears.',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- Attachments
  ((SELECT id FROM suite), 'S16.1', 'Collaboration', 'Attachments',
   'Attachments tab shows uploaded files',
   'Checks that files attached to a commitment (like signed contracts or photos) appear in the Attachments tab.',
   'Open any commitment detail page.',
   E'1. Click the "Attachments" tab\n2. Wait for the tab to load',
   'The Attachments tab loads. Either a list of attached files is shown or an empty state message. No error appears.',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- Change History
  ((SELECT id FROM suite), 'S17.1', 'Change History', 'Audit',
   'Change History tab records field changes',
   'Checks that any edits made to a commitment are automatically logged — showing who changed what, when, and what the old and new values were.',
   'Open any commitment that has been edited at least once.',
   E'1. Click the "Change History" tab\n2. Wait for the tab to load',
   'A list of changes is shown. Each entry shows the field that changed, the old value, the new value, the user who made the change, and the date and time.',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- Privacy
  ((SELECT id FROM suite), 'S18.1', 'Privacy', 'Privacy Settings',
   'Mark a commitment as Private',
   'A private commitment is only visible to users with Admin access. This test checks the private setting saves correctly.',
   'Open any commitment edit form.',
   E'1. Click Edit on any commitment\n2. Find the "Private" checkbox or toggle\n3. Turn it on (check the box or flip the toggle to the on position)\n4. Click Save',
   'The detail page shows "Private" in the Privacy section. The Visibility field reads "Private".',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- Configure
  ((SELECT id FROM suite), 'S19.1', 'Settings & Config', 'Configure',
   'Configure page loads for the Commitments tool',
   'Checks that the Settings/Configure page for the Commitments tool loads without errors.',
   'Be logged in to the app.',
   E'1. Navigate to /67/commitments/configure (type this into the browser address bar)',
   'The configure page loads. Tool-level settings for the Commitments tool are visible. No error message appears.',
   'LOW', 'scenario', '/67/commitments/configure'),

  -- Column Visibility
  ((SELECT id FROM suite), 'S20.1', 'Views & Navigation', 'Column Visibility',
   'Hide a column from the commitments table',
   'Checks that you can hide columns you do not need to make the table less cluttered and easier to read.',
   'Be on the Commitments list.',
   E'1. Look for a "Columns" button or icon in the toolbar (it may show a table/column icon)\n2. Click it to open the column visibility menu\n3. Uncheck one column (for example, "ERP Status")\n4. Close the menu by clicking elsewhere',
   'The unchecked column disappears from the table. The remaining columns still show correct data.',
   'LOW', 'scenario', '/67/commitments')

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
-- Update suite total_cases count
UPDATE public.test_suites
   SET total_cases = (
     SELECT count(*) FROM public.test_cases
     WHERE suite_id = (SELECT id FROM public.test_suites WHERE tool_name = 'commitments')
       AND test_type = 'scenario'
   )
 WHERE tool_name = 'commitments';
