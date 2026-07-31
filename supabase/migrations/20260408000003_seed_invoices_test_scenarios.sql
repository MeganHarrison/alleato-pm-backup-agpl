-- Seed Invoicing test scenarios
-- Generated: 2026-04-08
-- Suite: invoices / Invoicing

INSERT INTO test_suites (tool_name, display_name, source_doc_count, total_cases, last_generated_at)
VALUES ('invoices', 'Invoicing', 3, 0, NOW())
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = NOW();
DO $$
DECLARE
  v_suite_id uuid;
BEGIN
  SELECT id INTO v_suite_id FROM test_suites WHERE tool_name = 'invoices';

  INSERT INTO test_cases (suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps)
  VALUES
  (
    v_suite_id,
    '1.1',
    'Navigation',
    'List Page',
    'Open the Invoices page',
    '1. Make sure you are logged in as test1@mail.com
2. Click "Invoices" in the left sidebar of the project
3. Wait for the page to stop loading',
    'The page loads fully. A table of owner invoices is visible with columns for Invoice #, Status, Billing Period, Gross Amount, Net Amount, and Paid Amount. No error messages appear.',
    'HIGH',
    'scenario',
    '/767/invoices',
    'Invoicing tracks how much has been billed to the client and paid over time. Each invoice represents a billing period.',
    NULL
  ),
  (
    v_suite_id,
    '1.2',
    'Navigation',
    'Tabs',
    'Switch between Owner, Subcontractor, and Billing Periods tabs',
    '1. Open the Invoices page at /767/invoices
2. Click the "Subcontractor" tab near the top of the table
3. Wait for the tab to load
4. Click the "Billing Periods" tab
5. Wait for the tab to load
6. Click "Owner" to return to the default tab',
    'Each tab loads without error and shows a different data set. Owner tab shows invoices. Subcontractor tab shows commitment records. Billing Periods tab shows billing cycle rows.',
    'HIGH',
    'scenario',
    '/767/invoices',
    NULL,
    NULL
  ),
  (
    v_suite_id,
    '1.3',
    'Navigation',
    'Detail Page',
    'Open an invoice detail page',
    '1. Open the Invoices page
2. Click on the Invoice # of any existing invoice in the list
3. Wait for the page to finish loading',
    'The invoice detail page opens showing the invoice number, status, billing period dates, and line item breakdown. No error messages appear.',
    'HIGH',
    'scenario',
    '/767/invoices',
    NULL,
    'The Owner Invoices list must have at least one existing record.'
  ),
  (
    v_suite_id,
    '2.1',
    'Create',
    'New Invoice',
    'Create a new owner invoice',
    '1. Open the Invoices page
2. Click the "New Invoice" button (top right)
3. In the Invoice Number field, type: Invoice #001
4. Select a contract from the Contract dropdown (pick any option shown)
5. Set the Invoice Date to today''s date
6. Click Save (or Create)
7. Wait for the page to stop loading',
    'The new invoice appears in the Owner tab list with the number "Invoice #001" and a status of "Draft". A success message (toast) briefly appears.',
    'HIGH',
    'scenario',
    '/767/invoices',
    'Think of an invoice like a bill you send to your client at the end of a month, saying "here is how much work we completed and how much you owe us."',
    NULL
  ),
  (
    v_suite_id,
    '2.2',
    'Create',
    'Validation',
    'Try to create an invoice without selecting a contract',
    '1. Open the Invoices page
2. Click the "New Invoice" button
3. Type Invoice #VALIDATION-TEST in the Invoice Number field
4. Leave the Contract dropdown unselected
5. Click Save (or Create)',
    'An error message appears near the Contract field (e.g. "Contract is required"). The invoice is NOT created. The form stays open.',
    'HIGH',
    'scenario',
    '/767/invoices',
    NULL,
    NULL
  ),
  (
    v_suite_id,
    '2.3',
    'Create',
    'Billing Period',
    'Create a new billing period',
    '1. Open the Invoices page
2. Click the "Billing Periods" tab
3. Click the "Create Billing Period" button (top right)
4. In the Start Date field, enter 2026-05-01
5. In the End Date field, enter 2026-05-31
6. In the Billing Date field, enter 2026-06-01
7. Click Create
8. Wait for the dialog to close',
    'A new billing period row appears in the Billing Periods table showing the dates 05/01/2026 – 05/31/2026 and a status of "Draft". No error message appears.',
    'HIGH',
    'scenario',
    '/767/invoices?tab=billing-periods',
    'A billing period is a time window (like a month) that groups invoices together. For example, "May 2026" could be one billing period.',
    'The project must have a prime contract. If "No prime contract found" error appears, first create a prime contract for project 767.'
  ),
  (
    v_suite_id,
    '3.1',
    'Edit',
    'Invoice Fields',
    'Edit an existing invoice',
    '1. Open the Invoices page
2. Click on any existing invoice to open its detail page
3. Click the Edit button (or find an editable field)
4. Change the invoice number to Invoice #001-EDITED
5. Click Save
6. Wait for the page to stop loading',
    'The detail page now shows the updated invoice number "Invoice #001-EDITED". A success message briefly appears. The old number is no longer shown.',
    'HIGH',
    'scenario',
    '/767/invoices',
    NULL,
    'There must be at least one existing invoice in the Owner tab list.'
  ),
  (
    v_suite_id,
    '3.2',
    'Edit',
    'Persistence',
    'Edits persist after page refresh',
    '1. Complete scenario 3.1 (edit an invoice and save it)
2. After saving, stay on the invoice detail page
3. Press Ctrl+R (or Cmd+R on Mac) to refresh the browser
4. Wait for the page to reload',
    'The updated invoice number "Invoice #001-EDITED" is still shown after the refresh. No data reverted to the original value.',
    'HIGH',
    'scenario',
    '/767/invoices',
    NULL,
    'Complete scenario 3.1 first.'
  ),
  (
    v_suite_id,
    '4.1',
    'Status',
    'Workflow',
    'Move an invoice from Draft to Submitted',
    '1. Open the Invoices page
2. Click on any invoice with status Draft
3. Find the Status field or a Submit button
4. Change the status to Submitted (or click Submit)
5. Save and wait for the page to stop loading',
    'The status badge on the invoice now shows "Submitted". No error message appears.',
    'HIGH',
    'scenario',
    '/767/invoices',
    'Submitting an invoice means you have officially sent it to your client for review. Before submitting, it is just a draft that only you can see.',
    'There must be at least one invoice with status Draft.'
  ),
  (
    v_suite_id,
    '4.2',
    'Status',
    'Workflow',
    'Approve a submitted invoice',
    '1. Open the Invoices page
2. Click on any invoice with status Submitted
3. Change the status to Approved (or click Approve)
4. Save and wait for the page to stop loading',
    'The status badge on the invoice now shows "Approved". No error message appears.',
    'HIGH',
    'scenario',
    '/767/invoices',
    'Approving an invoice means the client has agreed to pay it. After approval, the invoice is ready to be paid.',
    'There must be at least one invoice with status Submitted. Complete scenario 4.1 first if needed.'
  ),
  (
    v_suite_id,
    '4.3',
    'Status',
    'Workflow',
    'Mark an approved invoice as Paid',
    '1. Open the Invoices page
2. Click on any invoice with status Approved
3. Change the status to Paid (or click Mark as Paid)
4. Save and wait for the page to stop loading',
    'The status badge on the invoice now shows "Paid". The Paid Amount column in the list updates to reflect the payment. No error message appears.',
    'MEDIUM',
    'scenario',
    '/767/invoices',
    'Marking an invoice as Paid means the client has actually sent the money. This is the final step in the invoice lifecycle.',
    'There must be at least one invoice with status Approved. Complete scenario 4.2 first if needed.'
  ),
  (
    v_suite_id,
    '5.1',
    'Amounts',
    'Calculations',
    'Verify gross amount and net amount are visible on the list',
    '1. Open the Invoices page (Owner tab)
2. Look at the table columns
3. Find an invoice with a non-zero Gross Amount
4. Compare the Gross Amount and Net Amount columns for that row',
    'The Gross Amount and Net Amount columns are visible. The Net Amount is less than or equal to the Gross Amount. Dollar amounts are formatted correctly (e.g. $12,500.00).',
    'MEDIUM',
    'scenario',
    '/767/invoices',
    'Gross Amount = full amount billed. Net Amount = what the client actually owes after deducting any retention (a small percentage held back until all work is confirmed complete).',
    'There must be at least one invoice with a Gross Amount greater than $0.'
  ),
  (
    v_suite_id,
    '6.1',
    'Filter / Search',
    'Search',
    'Search for an invoice by invoice number',
    '1. Open the Invoices page
2. Click the search box (shows a magnifying glass icon or says "Search owner invoices...")
3. Type part of a known invoice number, e.g. INV or Invoice #001
4. Wait for the list to filter',
    'The list narrows to show only invoices whose number contains the search text. Invoices with unrelated numbers are hidden. Clearing the search box brings all invoices back.',
    'MEDIUM',
    'scenario',
    '/767/invoices',
    NULL,
    'The Owner Invoices list must have at least two invoices with different numbers.'
  ),
  (
    v_suite_id,
    '6.2',
    'Filter / Search',
    'Status Filter',
    'Filter invoices by status',
    '1. Open the Invoices page
2. Click the Filters button in the toolbar (usually shows a funnel icon)
3. Select "Draft" from the Status filter dropdown
4. Wait for the list to update',
    'The list shows only invoices with a "Draft" status badge. Invoices with other statuses (Submitted, Approved, Paid) are hidden. Removing the filter brings all invoices back.',
    'MEDIUM',
    'scenario',
    '/767/invoices',
    NULL,
    'The Owner Invoices list must have invoices with at least two different statuses.'
  )
  ON CONFLICT DO NOTHING;

  UPDATE test_suites
  SET total_cases = (SELECT COUNT(*) FROM test_cases WHERE suite_id = v_suite_id)
  WHERE id = v_suite_id;
END $$;
