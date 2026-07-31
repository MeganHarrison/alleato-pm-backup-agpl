-- Seed prime-contracts FEATURE suite (28 consolidated cases).
-- Idempotent: re-running this file regenerates the suite + cases cleanly.

begin;
insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
values ('prime-contracts', 'feature', 'Prime Contracts — Feature', 0)
on conflict (tool_name, suite_type) do update set
  display_name = excluded.display_name,
  last_generated_at = now();
delete from public.test_cases
 where suite_id = (select id from public.test_suites
                     where tool_name = 'prime-contracts' and suite_type = 'feature');
insert into public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
select s.id, v.test_number, v.category, v.subcategory, v.test_name,
       v.context_note, v.setup_steps, v.steps, v.expected_result, v.priority,
       'scenario', v.start_url
from public.test_suites s
cross join (values
  ('1.1', 'Create', 'Happy path',
   'Create a prime contract with all fields',
   'Covers the full create flow including SOV line items so the new contract persists with the correct totals.',
   null::text,
   E'1. Click "Create" on the Prime Contracts page.\n2. Fill Number = "PC-TEST-001", Title = "Test Prime Contract".\n3. Pick any Owner/Client from the dropdown.\n4. Leave Status = Draft.\n5. Add one SOV line: Description = "Mobilization", Amount = 10000.\n6. Click Save.\n7. Wait for the redirect.',
   'After save, the URL becomes /67/prime-contracts/<new-id>. The detail page shows PC-TEST-001, Test Prime Contract, status badge "Draft", Original Contract Value = $10,000.00. Navigating back to the list shows the new row.',
   'HIGH', '/67/prime-contracts'),

  ('1.2', 'Create', 'Validation',
   'Create form blocks submit without required fields',
   'Verifies the form rejects a submit that is missing Number or Title.',
   null,
   E'1. Click "Create".\n2. Leave Number and Title blank.\n3. Click Save.',
   'The form does not submit. Inline validation errors appear under Number and Title ("Required" or similar). The URL stays on /new.',
   'HIGH', '/67/prime-contracts'),

  ('1.3', 'Create', 'SOV totals',
   'Multiple SOV lines sum into the original contract value',
   'Checks that the SOV total rolls up into both original_contract_value and revised_contract_value on create.',
   null,
   E'1. Click "Create".\n2. Fill Number = "PC-TEST-002", Title = "SOV Sum".\n3. Add SOV line 1: Description = "Foundation", Amount = 25000.\n4. Add SOV line 2: Description = "Framing", Amount = 50000.\n5. Save.',
   'Detail page shows Original Contract Value = $75,000.00. The SOV tab lists both line items with the correct amounts.',
   'HIGH', '/67/prime-contracts'),

  ('2.1', 'Edit', 'Row actions',
   'Edit from row action menu opens edit mode',
   'Row-level three-dot menu → Edit jumps into the detail page with the edit query flag set.',
   E'- At least one prime contract exists.',
   E'1. Click the three-dot menu on the first row.\n2. Choose "Edit".',
   'The URL becomes /67/prime-contracts/<id>?edit=1. The detail renders ContractForm with editable fields pre-filled and Save/Cancel buttons visible.',
   'HIGH', '/67/prime-contracts'),

  ('2.2', 'Edit', 'Update + persist',
   'Editing the title saves and persists after refresh',
   'Verifies inline edits are written through and survive a reload.',
   E'- Prime contract PC-TEST-001 exists.',
   E'1. Open PC-TEST-001.\n2. Enter edit mode via the three-dot menu → Edit.\n3. Change Title to "Test Prime Contract (edited)".\n4. Click Save.\n5. Wait for the page to stop loading.\n6. Hard refresh the browser.',
   'After save the toast "Prime contract updated" (or equivalent) shows. The page exits edit mode. After refresh, the Title still reads "Test Prime Contract (edited)".',
   'HIGH', '/67/prime-contracts'),

  ('2.3', 'Edit', 'SOV inline edit',
   'SOV tab supports adding a new line item',
   'Checks the SOV inline editor can append a new line that contributes to the contract value.',
   E'- A prime contract with at least one SOV line exists.',
   E'1. Open the contract detail.\n2. Click the SOV tab.\n3. Click "Edit SOV".\n4. Click "Add Line".\n5. Fill Description = "Closeout", Amount = 5000.\n6. Click Save.',
   'The SOV table shows the new row. The Original Contract Value on the overview increases by 5,000. Refreshing the page preserves the new line.',
   'HIGH', '/67/prime-contracts'),

  ('3.1', 'Delete', 'Row action',
   'Delete from row menu prompts for confirmation and removes the contract',
   'Happy-path delete with confirmation dialog.',
   E'- A disposable prime contract exists with no line items, invoices, or change orders.',
   E'1. Click the three-dot menu on that contract row.\n2. Click "Delete".\n3. In the confirmation dialog, click "Delete Contract".\n4. Wait for the toast.',
   'A success toast "Contract ... deleted successfully" appears. The row disappears from the table.',
   'HIGH', '/67/prime-contracts'),

  ('3.2', 'Delete', 'Blocked by children',
   'Delete is blocked when the contract has change orders or line items',
   'Verifies the API surface rejects deletion of a contract that still has children, and the UI surfaces the error.',
   E'- A prime contract with at least one SOV line or change order exists.',
   E'1. Click the three-dot menu on that contract row.\n2. Click "Delete".\n3. Confirm.',
   'An error toast appears ("Failed to delete contract: ..."). The contract remains in the list.',
   'MEDIUM', '/67/prime-contracts'),

  ('3.3', 'Delete', 'Bulk delete',
   'Bulk delete removes all selected contracts',
   'Checks multi-select + bulk delete path.',
   E'- Two or more disposable prime contracts exist.',
   E'1. Tick the checkboxes for two rows.\n2. Click the "Delete Selected" (bulk delete) action in the toolbar.\n3. Confirm in the dialog.',
   'A success toast reports the deleted count ("2 contracts deleted"). Both rows disappear from the table. The selection counter resets.',
   'MEDIUM', '/67/prime-contracts'),

  ('4.1', 'Status', 'Draft → Out for Signature',
   'Change status from Draft to Out for Signature',
   'Verifies status transitions persist and update the status badge.',
   E'- A prime contract with status = Draft exists.',
   E'1. Open the contract detail.\n2. Enter edit mode.\n3. Change Status to "Out for Signature".\n4. Save.',
   'The status badge updates to "Out for Signature". Returning to the list shows the updated status. Filtering the list by Status = Out for Signature includes this contract.',
   'HIGH', '/67/prime-contracts'),

  ('4.2', 'Status', 'Approve + execute',
   'Mark a contract as Approved and Executed',
   'Covers the approval + executed transition together.',
   E'- A prime contract with status = Out for Signature exists.',
   E'1. Open the contract detail.\n2. Enter edit mode.\n3. Set Status = "Approved".\n4. Tick Executed.\n5. Save.',
   'The status badge shows "Approved". The Executed column on the list shows Yes for this contract. Refresh preserves both values.',
   'HIGH', '/67/prime-contracts'),

  ('4.3', 'Status', 'Terminate',
   'Terminate a contract',
   'Checks the Terminated status renders correctly across views.',
   E'- An approved prime contract exists.',
   E'1. Open the contract detail.\n2. Enter edit mode.\n3. Set Status = "Terminated".\n4. Save.',
   'The status badge reads "Terminated". The list row shows the same status.',
   'MEDIUM', '/67/prime-contracts'),

  ('5.1', 'Filters', 'Combined filter + search',
   'Applying a status filter together with a search narrows results correctly',
   'Verifies filters and search stack (intersection).',
   null,
   E'1. Set Status filter = "Draft".\n2. Type a known contract number fragment into search.\n3. Wait one second.',
   'The visible rows match both conditions: Status = Draft AND title/number contains the fragment. Clearing either widens the results.',
   'MEDIUM', '/67/prime-contracts'),

  ('5.2', 'Filters', 'Client filter',
   'Owner/Client filter narrows by company',
   'Checks the dynamic client_name filter loaded from current rows.',
   E'- At least two contracts with different Owner/Client values exist.',
   E'1. Open the Filters menu.\n2. Pick an Owner/Client value from the dropdown.\n3. Apply.',
   'The URL includes client_name=<value>. Only rows with that Owner/Client remain visible.',
   'MEDIUM', '/67/prime-contracts'),

  ('5.3', 'Filters', 'Clear filters',
   'Clear filters resets table to all rows',
   'Verifies the clear filters action removes URL params and reloads the full list.',
   E'- At least one filter is currently applied.',
   E'1. Click "Clear filters" in the toolbar or filters menu.',
   'All filter chips clear. The URL drops status/executed/client_name params. The full list (or the original empty state) is restored.',
   'MEDIUM', '/67/prime-contracts'),

  ('6.1', 'Sort', 'Column sort',
   'Sorting by Original Contract Amount reorders rows',
   'Checks descending + ascending sort on a numeric column.',
   null,
   E'1. Click the "Original Contract Amount" header.\n2. Confirm the order.\n3. Click the same header again.',
   'After the first click, rows sort ascending by amount (with nulls handled). After the second, they sort descending. The URL reflects sort=original_contract_value and sort_dir.',
   'MEDIUM', '/67/prime-contracts'),

  ('7.1', 'Views', 'View switch',
   'Card and list view render without error',
   'Smoke-level for feature: each view mode loads and shows contract cards/list items.',
   null,
   E'1. Switch the view to "Card".\n2. Switch to "List".\n3. Switch back to "Table".',
   'Each view mode renders without a red error banner. Card view shows one card per contract. List view shows a condensed one-line per contract with an expand chevron.',
   'LOW', '/67/prime-contracts'),

  ('8.1', 'Export', 'CSV export',
   'Export button downloads a CSV containing visible columns',
   'Verifies the CSV download path works and matches visible columns.',
   E'- At least one contract is in the filtered list.',
   E'1. Click the Export icon in the toolbar.\n2. Allow the download.\n3. Open the CSV.',
   'A file named "prime-contracts-*.csv" downloads. The header row matches the currently visible columns. Each data row corresponds to a visible contract.',
   'LOW', '/67/prime-contracts'),

  ('9.1', 'Detail tabs', 'General tab',
   'General tab shows overview details',
   'Verifies the General (overview) tab renders contract summary + key fields.',
   E'- At least one contract exists.',
   E'1. Open any contract.\n2. Confirm the General tab is active.',
   'The General tab shows the contract title, status, executed flag, dates, description, and financial totals. No red error banner.',
   'MEDIUM', '/67/prime-contracts'),

  ('9.2', 'Detail tabs', 'SOV tab',
   'SOV tab lists line items',
   'Checks SOV tab renders all line items with correct amounts.',
   E'- A contract with SOV line items exists.',
   E'1. Open the contract.\n2. Click the SOV tab.',
   'The SOV tab shows one row per line item with Description, Budget Code (if set), Quantity, Unit Cost, Amount, and a total row. Each amount is currency-formatted.',
   'MEDIUM', '/67/prime-contracts'),

  ('9.3', 'Detail tabs', 'Change Orders tab',
   'Change Orders tab lists PCCOs',
   'Verifies the Change Orders tab loads and either lists PCCOs or shows an empty state.',
   E'- At least one contract exists.',
   E'1. Open the contract detail.\n2. Click the Change Orders tab.',
   'The tab renders without error. Either a table of Change Orders (Number, Title, Status, Amount) is shown, or an empty state indicates there are none.',
   'MEDIUM', '/67/prime-contracts'),

  ('9.4', 'Detail tabs', 'Invoices tab',
   'Invoices tab lists pay apps / invoices',
   'Smoke-style check for the Invoices tab.',
   null,
   E'1. Open any contract.\n2. Click the "Invoices" tab.',
   'The Invoices tab renders without error. Either an Invoices/Payment Applications table appears, or an empty state with a "New Invoice"/"Create Payment Application" CTA.',
   'MEDIUM', '/67/prime-contracts'),

  ('9.5', 'Detail tabs', 'Payments Received tab',
   'Payments Received tab renders',
   'Checks the payments-received tab loads its data without error.',
   null,
   E'1. Open any contract.\n2. Click "Payments Received".',
   'The Payments Received tab renders without error. Either a table of payments (Amount, Date) is shown, or the empty state.',
   'MEDIUM', '/67/prime-contracts'),

  ('9.6', 'Detail tabs', 'Change History tab',
   'Change History tab shows audit events',
   'Verifies the built-in audit timeline renders created/executed/updated events.',
   null,
   E'1. Open any contract.\n2. Click "Change History".',
   'The tab shows a timeline with at least a "Prime contract created" event. If the contract has been executed or updated, those events also appear with timestamps.',
   'MEDIUM', '/67/prime-contracts'),

  ('10.1', 'Configure', 'Settings toggles persist',
   'Advanced settings page saves permission toggles',
   'Covers the tool-level configure page writes/reads.',
   null,
   E'1. Click the gear icon on the list page to open Configure.\n2. Toggle "Allow Standard users to create PCCOs".\n3. Save.\n4. Refresh.',
   'The toggle state persists after refresh. A success toast confirms the update.',
   'MEDIUM', '/67/prime-contracts'),

  ('11.1', 'Permissions', 'Read-only user',
   'Read-only user sees no Create/Edit/Delete actions',
   'Placeholder scenario — verifies permission gating, even if only test1 exists today.',
   E'- A read-only project member account is available (or stub this with the permissions toggle).',
   E'1. Log in as a read-only user.\n2. Open Prime Contracts.',
   'The "Create" button is hidden or disabled. Row action menus do not show Edit or Delete. Opening a contract does not expose the Edit/Delete menu items.',
   'MEDIUM', '/67/prime-contracts'),

  ('12.1', 'Edge cases', 'Duplicate contract number',
   'Attempting to save a second contract with an existing number shows an error',
   'Verifies uniqueness is enforced.',
   E'- A contract with number "PC-TEST-001" already exists.',
   E'1. Click Create.\n2. Set Number = "PC-TEST-001" and Title = "Dupe".\n3. Save.',
   'Submit fails with an inline or toast error mentioning the duplicate number. No new contract appears in the list.',
   'MEDIUM', '/67/prime-contracts'),

  ('12.2', 'Edge cases', 'Very large SOV',
   'Very large SOV totals display correctly',
   'Sanity check for formatting on big numbers.',
   null,
   E'1. Create a contract with one SOV line at Amount = 123456789.',
   'The detail page shows Original Contract Value = $123,456,789.00. The list row shows the same amount in the Original Contract Amount column with correct comma formatting.',
   'LOW', '/67/prime-contracts')
) as v(test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url)
where s.tool_name = 'prime-contracts' and s.suite_type = 'feature';
update public.test_suites
   set total_cases = (select count(*) from public.test_cases where suite_id = test_suites.id)
 where tool_name = 'prime-contracts' and suite_type = 'feature';
commit;
