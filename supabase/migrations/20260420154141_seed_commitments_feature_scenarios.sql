-- Seed commitments FEATURE suite (26 consolidated cases).
-- Idempotent: re-running this file regenerates the suite + cases cleanly.

begin;
with s as (
  insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
  values ('commitments', 'feature', 'Commitments — Feature', 0)
  on conflict (tool_name, suite_type) do update set
    display_name      = excluded.display_name,
    last_generated_at = now()
  returning id
)
delete from public.test_cases where suite_id = (select id from s);
insert into public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url, tool_name, status)
select s.id, v.test_number, v.category, v.subcategory, v.test_name,
       v.context_note, v.setup_steps, v.steps, v.expected_result, v.priority,
       'scenario', v.start_url, 'commitments', 'pending'
from public.test_suites s
cross join (values

  -- 1. Navigation & layout
  ('1.1', 'Navigation', 'Tabs',
   'All commitment tabs switch without reload errors',
   'Covers Commitments, Subcontracts, Purchase Orders, Change Orders, Recycle Bin in one flow.',
   null,
   E'1. Open /67/commitments.\n2. Click each tab in order: Commitments, Subcontracts, Purchase Orders, Change Orders, Recycle Bin.\n3. After each click, wait for the page to settle.',
   'Each tab loads without a red error banner. The URL updates to the correct query or path for each tab. The active tab is visually highlighted.',
   'HIGH', '/67/commitments'),

  ('1.2', 'Navigation', 'Column visibility',
   'Column visibility toggles persist',
   'Verifies hiding a column via the toolbar sticks across a refresh.',
   null,
   E'1. Click the "Columns" button in the toolbar.\n2. Untick "Invoiced Amount".\n3. Close the menu.\n4. Refresh the page.',
   'Immediately after unticking, the "Invoiced Amount" column is removed from the table. After refresh, the column is still hidden.',
   'MEDIUM', '/67/commitments'),

  -- 2. Create
  ('2.1', 'Create', 'Subcontract happy path',
   'Create a subcontract with all required fields',
   'End-to-end create for the subcontract type. Records the new row in the list.',
   null,
   E'1. Click "Create" then "Subcontract".\n2. Fill Title with "SC Smoke 100".\n3. Pick a Contract Company from the dropdown.\n4. Set Status to "Draft".\n5. Enter Original Amount 100000.\n6. Click "Save" (or "Create").\n7. Wait for the page to stop loading.\n8. Navigate back to /67/commitments.',
   'The save succeeds (toast "Saved" or redirect to detail). The new row appears in the Commitments list with Title "SC Smoke 100", Type "Subcontract", Status "Draft", Original Amount $100,000.',
   'HIGH', '/67/commitments/new?type=subcontract'),

  ('2.2', 'Create', 'Purchase order happy path',
   'Create a purchase order with all required fields',
   'End-to-end create for the purchase order type.',
   null,
   E'1. Click "Create" then "Purchase Order".\n2. Fill Title with "PO Smoke 200".\n3. Pick a Contract Company.\n4. Set Status to "Draft".\n5. Enter Original Amount 25000.\n6. Click "Save".\n7. Navigate back to /67/commitments and switch to the "Purchase Orders" tab.',
   'The save succeeds. The new PO appears on the Purchase Orders tab with Title "PO Smoke 200", Original Amount $25,000.',
   'HIGH', '/67/commitments/new?type=purchase_order'),

  ('2.3', 'Create', 'Validation',
   'Create blocks on missing required fields and invalid amount',
   'One consolidated case covering the two most important validation paths.',
   null,
   E'1. Open Create → Subcontract.\n2. Leave Title empty and click "Save".\n3. Observe the error.\n4. Enter Title "Temp".\n5. Type -500 into Original Amount.\n6. Click "Save" again.',
   'Step 3 shows an inline validation error on the Title field and the page does NOT navigate away. Step 6 shows an error indicating the amount must be positive, and the save is blocked.',
   'HIGH', '/67/commitments/new?type=subcontract'),

  -- 3. Read / detail
  ('3.1', 'Read', 'Detail tabs',
   'Commitment detail page loads all tabs',
   'Verifies the detail view renders General plus the secondary tabs without error.',
   E'- At least one commitment exists.',
   E'1. Open /67/commitments and click the first row.\n2. Once the detail loads, click each tab: General, Schedule of Values, Change Management, Invoices, Payments Issued, Attachments, Change History, Emails.\n3. Wait for each tab to render.',
   'The detail page loads and every tab renders without a red error banner. The active tab is visually highlighted.',
   'HIGH', '/67/commitments'),

  ('3.2', 'Read', 'Financial totals parity',
   'Detail financial fields match the list row',
   'Cross-check that the financials shown on the row match the detail page.',
   E'- At least one commitment with a non-zero Original Amount exists.',
   E'1. On /67/commitments, note the Original Amount and Revised Contract Amount of the first row.\n2. Click the row.\n3. On the detail page, find the Original Amount and Revised Contract Amount fields.',
   'The Original Amount and Revised Contract Amount on the detail page match the values shown on the list row to the dollar.',
   'MEDIUM', '/67/commitments'),

  -- 4. Edit
  ('4.1', 'Edit', 'Full edit flow',
   'Edit title, status, and amount persists after refresh',
   'One consolidated edit case covering the most-edited fields and the persistence check.',
   E'- At least one commitment exists.',
   E'1. Open a commitment detail and click "Edit".\n2. Change Title to "<original> — edited".\n3. Change Status to "Out for Signature".\n4. Change Original Amount to 77777.\n5. Click "Save" and wait for the toast.\n6. Refresh the page.',
   'The save succeeds. After refresh, Title ends with "— edited", Status is "Out for Signature", Original Amount is $77,777. The commitment row on /67/commitments reflects these values too.',
   'HIGH', '/67/commitments'),

  -- 5. Delete
  ('5.1', 'Delete', 'Single',
   'Delete a commitment sends it to the recycle bin',
   'Single-row delete via row action. Verifies the recycle bin receives it.',
   E'- At least one commitment with no dependent invoices or change orders exists.',
   E'1. On /67/commitments, open the row action menu on a deletable commitment.\n2. Click "Delete".\n3. Confirm the "Delete Commitment" dialog.\n4. Wait for the toast.\n5. Click the "Recycle Bin" tab.',
   'The commitment no longer appears on the Commitments tab. The delete toast appears. The deleted commitment is listed on the Recycle Bin tab.',
   'HIGH', '/67/commitments'),

  ('5.2', 'Delete', 'Restore',
   'Restore a commitment from the recycle bin',
   'Verifies the reverse of 5.1.',
   E'- At least one commitment exists in the recycle bin (run 5.1 first).',
   E'1. Open /67/commitments/recycle-bin.\n2. Find the commitment deleted in 5.1.\n3. Click "Restore" on its row.\n4. Confirm.\n5. Navigate back to /67/commitments.',
   'The restore toast appears. The commitment no longer shows on the recycle bin and is back on the Commitments list.',
   'MEDIUM', '/67/commitments/recycle-bin'),

  ('5.3', 'Delete', 'Bulk',
   'Bulk delete via selection checkboxes',
   'Consolidates select-all, bulk action bar, and the bulk confirm dialog.',
   E'- At least three deletable commitments exist.',
   E'1. On /67/commitments, tick the checkboxes for three rows.\n2. Click the bulk "Delete" action in the toolbar.\n3. Confirm the "Delete N Commitments" dialog.\n4. Wait for the toast.',
   'All three rows are removed from the list. A toast reports "3 commitments deleted" (or the equivalent success count). The Recycle Bin tab now contains those three commitments.',
   'HIGH', '/67/commitments'),

  -- 6. Status workflow
  ('6.1', 'Status', 'Workflow',
   'Status transitions Draft → Out for Signature → Approved',
   'Consolidated status workflow case. Verifies transitions save and reflect in the list.',
   E'- A draft commitment exists.',
   E'1. Open a Draft commitment.\n2. Click Edit and change Status to "Out for Signature". Save.\n3. Edit again and change Status to "Approved". Save.\n4. Navigate to /67/commitments.',
   'Each save succeeds. On the list, the row shows Status "Approved" after step 4. No error banner appeared during any save.',
   'HIGH', '/67/commitments'),

  ('6.2', 'Status', 'Terminate',
   'Terminate sets status and prevents further CO creation',
   'Verifies the terminal state behaves like the dead-end it should.',
   E'- An Approved commitment exists.',
   E'1. Open an Approved commitment.\n2. Click Edit and set Status to "Terminated". Save.\n3. On the detail page, try to open "Change Management" and add a new change order.',
   'Status saves as "Terminated". The "New change order" button is disabled OR the system shows an error indicating COs cannot be created on a terminated commitment.',
   'MEDIUM', '/67/commitments'),

  -- 7. Change orders (nested)
  ('7.1', 'ChangeOrders', 'Add PCO',
   'Add a commitment change order (PCO)',
   'Creates a potential change order against a commitment.',
   E'- An Approved commitment exists.',
   E'1. Open a commitment detail and go to the "Change Management" tab.\n2. Click "New change order" (or "Create PCO").\n3. Fill Number "001", Title "Field condition change", Amount 5000, Status "Pending".\n4. Click Save.',
   'The PCO saves. A new row appears in the Change Management tab with #001, the title, $5,000, Status Pending.',
   'HIGH', '/67/commitments'),

  ('7.2', 'ChangeOrders', 'Expand row',
   'Expanding a commitment row reveals its change orders',
   'Verifies the inline sub-row shows the child COs.',
   E'- A commitment with at least one PCO exists (run 7.1 first).',
   E'1. On /67/commitments, click the expand chevron on the commitment that has a PCO.',
   'A sub-row expands inline showing a mini-table of change orders with #, Description, Status, Amount, Requested. The PCO from 7.1 is listed.',
   'MEDIUM', '/67/commitments'),

  ('7.3', 'ChangeOrders', 'Approve',
   'Approving a PCO updates revised contract amount',
   'Verifies calc flows from CO approval into the parent commitment totals.',
   E'- A commitment with a Pending PCO for $5,000 exists.',
   E'1. Open Change Management on the commitment.\n2. Open the Pending PCO and change Status to "Approved". Save.\n3. Navigate back to /67/commitments.\n4. Find the commitment row.',
   'The Approved Change Orders column on the row increases by $5,000. The Revised Contract Amount equals Original Amount + Approved Change Orders.',
   'HIGH', '/67/commitments'),

  ('7.4', 'ChangeOrders', 'Project-level aggregation',
   'Change Orders tab aggregates across all commitments',
   'Cross-check that the project-wide CO table shows COs from multiple commitments.',
   E'- At least two commitments with at least one CO each exist.',
   E'1. Open /67/commitments and click the "Change Orders" tab.',
   'The project-level Change Orders table lists change orders from multiple commitments. Each row includes a Commitment reference. Counts are consistent with what the individual commitments show on their Change Management tabs.',
   'MEDIUM', '/67/commitments?tab=change-orders'),

  -- 8. Schedule of Values
  ('8.1', 'SOV', 'Add line items',
   'Add SOV line items — total matches commitment amount',
   'Consolidates SOV create + total reconciliation.',
   E'- A commitment with Original Amount $100,000 exists.',
   E'1. Open the commitment and go to "Schedule of Values".\n2. Add two line items: "Mobilization $40,000" and "Foundations $60,000". Save.',
   'Both line items appear in the SOV table. A computed total of $100,000 is displayed and matches the commitment Original Amount. No "out of balance" warning appears.',
   'HIGH', '/67/commitments'),

  -- 9. Invoices & payments
  ('9.1', 'Invoices', 'Create',
   'Create an invoice against a commitment',
   'Nested invoice creation flow from the commitment detail.',
   E'- An Approved commitment exists.',
   E'1. Open the commitment and go to the "Invoices" tab.\n2. Click "New Invoice".\n3. Fill Number "INV-001", Amount 10000, Date (today). Save.',
   'The invoice is created and appears in the Invoices tab for that commitment. The commitment row on /67/commitments shows Invoiced Amount of $10,000.',
   'HIGH', '/67/commitments'),

  ('9.2', 'Invoices', 'Payment reduces balance',
   'Issuing a payment reduces Remaining Balance',
   'Verifies the financial calc when a payment is applied.',
   E'- A commitment with at least one open invoice exists.',
   E'1. Open the commitment detail and go to "Payments Issued".\n2. Record a payment of $10,000 against the open invoice. Save.\n3. Navigate to /67/commitments and find the commitment.',
   'The commitment row shows Payments Issued $10,000 and Remaining Balance decreased by $10,000 compared to before. No error banner.',
   'MEDIUM', '/67/commitments'),

  -- 10. Filters / search
  ('10.1', 'Filters', 'Combined filters',
   'Combined type + status + company filters apply together',
   'Consolidates multi-filter behavior into one case.',
   null,
   E'1. Open /67/commitments.\n2. Click the "Subcontracts" tab.\n3. Apply Status = "Approved".\n4. Apply Contract Company contains a known company name fragment.',
   'The URL includes type=subcontract and status=Approved. Every visible row matches all three filters. The filtered count in the toolbar reflects the narrower result.',
   'MEDIUM', '/67/commitments'),

  ('10.2', 'Filters', 'Clear filters',
   'Clearing filters resets the list',
   'Verifies the Clear action restores the full list.',
   null,
   E'1. With at least two filters applied (see 10.1), click "Clear" in the filter area.',
   'All filters are removed. The URL drops the type and status params. The full commitment list is shown.',
   'LOW', '/67/commitments'),

  -- 11. Permissions
  ('11.1', 'Permissions', 'Read-only',
   'Read-only user cannot create, edit, or delete',
   'Consolidated permission case. Verifies all mutation affordances are hidden.',
   E'- A second test user exists with contracts permission = read (not write).',
   E'1. Log in as the read-only user.\n2. Open /67/commitments.\n3. Inspect the toolbar and row action menus.\n4. Open a commitment detail.',
   'The "Create" button is hidden. Row action menus do NOT include Edit or Delete. On the detail page, the "Edit" button is hidden. The page otherwise renders normally.',
   'MEDIUM', '/67/commitments'),

  -- 12. Export & ERP sync
  ('12.1', 'Export', 'CSV',
   'Export produces a downloadable CSV',
   'Verifies the export dialog completes end-to-end.',
   null,
   E'1. On /67/commitments, click the Export icon in the toolbar.\n2. In the Export dialog, accept defaults and click "Export".\n3. Wait for the download.',
   'A CSV file is downloaded. Opening it shows a header row with at least Number, Title, Type, Status, Original Amount, and one row per commitment currently in the filtered list.',
   'MEDIUM', '/67/commitments'),

  ('12.2', 'Sync', 'Acumatica',
   'Acumatica sync button runs and reports result',
   'Smoke of the ERP sync control (not the full sync correctness).',
   null,
   E'1. On /67/commitments, click the circular refresh (sync) icon in the toolbar.\n2. Wait for the toast.',
   'The icon spins while syncing. A toast appears with "Commitments sync complete: X created, Y updated" (errors allowed and reported). The table refreshes.',
   'LOW', '/67/commitments'),

  -- 13. Edge
  ('13.1', 'Edge', 'Delete blocked',
   'Delete is blocked when dependent records exist',
   'Verifies FK protection surfaces a clear error rather than silently failing.',
   E'- A commitment with at least one paid invoice exists.',
   E'1. Open the row action menu on that commitment.\n2. Click Delete and confirm.',
   'The delete is rejected. A toast or inline error explains the delete is blocked because of dependent records (invoices or change orders). The commitment remains in the list.',
   'MEDIUM', '/67/commitments')

) as v(test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url)
where s.tool_name = 'commitments' and s.suite_type = 'feature';
update public.test_suites
   set total_cases = (select count(*) from public.test_cases where suite_id = test_suites.id)
 where tool_name = 'commitments' and suite_type = 'feature';
commit;
