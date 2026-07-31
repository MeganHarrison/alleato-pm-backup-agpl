-- Seed budget FEATURE suite (consolidated CRUD + workflow cases).
-- Idempotent: re-running regenerates the suite + cases cleanly.

begin;
with s as (
  insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
  values ('budget', 'feature', 'Budget — Feature', 0)
  on conflict (tool_name, suite_type) do update set
    display_name      = excluded.display_name,
    last_generated_at = now()
  returning id
)
delete from public.test_cases where suite_id = (select id from s);
insert into public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
select s.id, v.test_number, v.category, v.subcategory, v.test_name,
       v.context_note, v.setup_steps, v.steps, v.expected_result, v.priority,
       'scenario', v.start_url
from public.test_suites s
cross join (values
  -- 1. Navigation
  ('1.1', 'Navigation', 'Tabs',
   'All seven budget tabs load without error',
   'Verifies every tab in the budget page renders its own content.',
   null,
   E'1. Open the Budget page.\n2. In order, click each tab: Budget, Budget Details, Cost Codes, Forecasting, Project Status Snapshots, Change History, Settings.\n3. Wait for each tab to finish loading before clicking the next.',
   'Each tab updates the URL (?tab=...) and shows its own distinct content. No error banner appears on any tab.',
   'HIGH', '/67/budget'),

  -- 2. Create (line items)
  ('2.1', 'Create', 'Happy path',
   'Create a budget line item via the creator modal',
   'Verifies a new line item can be added with a budget code, description, and amount.',
   E'- Budget is unlocked.\n- At least one budget code exists for the project.',
   E'1. Click "Create" in the header.\n2. In the modal, pick a budget code from the dropdown.\n3. Type "Smoke test line" in the Description field.\n4. Type 1000 in the Amount field.\n5. Click "Add Line Item" (or the submit button).\n6. Wait for the modal to close and the table to refresh.',
   'A success toast confirms creation. The new line appears in the budget table with Description = "Smoke test line" and Original Budget = $1,000.00.',
   'HIGH', '/67/budget'),

  ('2.2', 'Create', 'Validation',
   'Submitting the creator with no budget code shows an error',
   'Verifies the form enforces the required budget code.',
   null,
   E'1. Click "Create".\n2. Leave the Budget Code empty.\n3. Type "Missing code test" in Description and 500 in Amount.\n4. Click submit.',
   'An error toast or inline message states a budget code is required. No new row is added to the table.',
   'HIGH', '/67/budget'),

  ('2.3', 'Create', 'Multiple lines',
   'Create multiple line items in one batch',
   'Verifies the creator can submit more than one row in a single save.',
   null,
   E'1. Click "Create".\n2. Fill out row 1 with a budget code, description "Batch 1", amount 100.\n3. Add a second row with a budget code, description "Batch 2", amount 200.\n4. Click submit.',
   'A success toast reads "Created 2 budget line items". Both rows appear in the table with the correct amounts.',
   'MEDIUM', '/67/budget'),

  -- 3. Edit
  ('3.1', 'Edit', 'Happy path',
   'Edit the original budget of an existing line',
   'Verifies the edit modal updates quantity, UOM, unit cost, and original budget.',
   E'- Budget is unlocked.\n- At least one line item exists that the test user created (to avoid modification constraints).',
   E'1. In the budget table, open the row action menu on a test line.\n2. Click "Edit".\n3. In the modal, change Quantity to 10, UOM to "EA", Unit Cost to 50.\n4. Click Save.\n5. Wait for the modal to close.',
   'A success toast reads "Line item updated successfully". The row shows Quantity 10, Unit Cost $50.00, Original Budget $500.00. After page refresh, the values persist.',
   'HIGH', '/67/budget'),

  -- 4. Delete
  ('4.1', 'Delete', 'Zero-budget line',
   'Delete a line item with zero original budget',
   'Verifies a line with no original budget can be deleted.',
   E'- Create a line item with Original Budget = 0 for this test.',
   E'1. Open the row action menu on the zero-budget line.\n2. Click Delete.\n3. Confirm in the dialog.',
   'A success toast reads "Line item deleted". The row disappears from the table.',
   'HIGH', '/67/budget'),

  ('4.2', 'Delete', 'Blocked by funded line',
   'Deleting a funded line is blocked with a clear reason',
   'Verifies the guardrail: lines with a non-zero original budget cannot be deleted directly.',
   E'- At least one line item has a non-zero Original Budget.',
   E'1. Open the row action menu on a funded line.\n2. Click Delete.',
   'An error toast explains the delete is blocked because the line has an original budget, and suggests using a budget modification. The row is still present.',
   'HIGH', '/67/budget'),

  ('4.3', 'Delete', 'Bulk delete',
   'Bulk delete removes multiple selected lines',
   'Verifies the bulk selection bar and bulk delete flow.',
   E'- Create 3 zero-budget test lines to delete.',
   E'1. Check the row selection checkboxes for the 3 test lines.\n2. In the blue selection bar, click "Delete Selected".\n3. Confirm in the dialog.',
   'A success toast reads "3 line item(s) deleted successfully". All 3 rows disappear from the table.',
   'MEDIUM', '/67/budget'),

  -- 5. Lock / Unlock
  ('5.1', 'Lock', 'Lock budget',
   'Lock the budget and verify write actions are blocked',
   'Verifies locking disables create / edit / delete / import / modification actions.',
   null,
   E'1. Open the header actions menu.\n2. Click "Lock Budget".\n3. Wait for confirmation.\n4. Click "Create".\n5. Click any row action "Edit" or "Delete".',
   'A success toast confirms the budget is locked. The page header shows a locked indicator with a timestamp. Clicking Create shows "Budget is locked. Unlock to add new line items." Clicking Edit or Delete shows similar "Budget is locked" error toasts.',
   'HIGH', '/67/budget'),

  ('5.2', 'Lock', 'Unlock budget',
   'Unlock the budget and verify writes are re-enabled',
   'Verifies unlocking restores create / edit / delete.',
   E'- Budget is currently locked.',
   E'1. Open the header actions menu.\n2. Click "Unlock Budget".\n3. Complete the unlock dialog (if prompted for a reason).\n4. Click "Create" after unlocking.',
   'The lock indicator disappears. Clicking Create now opens the line-item creator modal normally.',
   'HIGH', '/67/budget'),

  -- 6. Modifications
  ('6.1', 'Modification', 'Create modification',
   'Create a budget modification',
   'Verifies the Budget Modification modal flow.',
   E'- Budget is unlocked.',
   E'1. Click "Modification" (or "Budget Modification") in the header menu.\n2. Pick a line item and enter an adjustment amount.\n3. Add a reason.\n4. Submit.',
   'A success toast confirms the modification. The target line shows the modification amount in the Budget Modifications column and a revised budget that reflects it.',
   'HIGH', '/67/budget'),

  -- 7. Forecasting
  ('7.1', 'Forecast', 'Manual forecast to complete',
   'Set a manual Forecast-to-Complete amount on a line',
   'Verifies a manual forecast saves and appears on the row.',
   null,
   E'1. In a row, click the value in the "Forecast to Complete" column.\n2. In the modal, pick forecast method = manual.\n3. Enter amount 750.\n4. Add a note "Manual FTC test" and save.',
   'A success toast reads "Forecast saved successfully". The row shows Forecast to Complete = $750.00 and the Estimated Cost at Completion updates accordingly.',
   'HIGH', '/67/budget'),

  -- 8. Detail modals (column drill-ins)
  ('8.1', 'Drill-in', 'Detail modals',
   'Each amount column opens its detail modal',
   'Verifies drill-in modals for the key financial columns.',
   E'- At least one line item exists with non-zero activity.',
   E'1. On a single row, click the value in each of these columns in order: Budget Modifications, Approved COs, Job-to-Date Cost Detail, Direct Costs, Pending Changes, Committed Costs, Pending Cost Changes, Forecast to Complete.\n2. Close each modal before opening the next.',
   'Each click opens its matching modal with a title referencing the column and the line item. Each modal either lists related records or shows an empty state. No modal throws a console error.',
   'MEDIUM', '/67/budget'),

  -- 9. Snapshots
  ('9.1', 'Snapshots', 'Create snapshot',
   'Create a project status snapshot',
   'Verifies the snapshot create action saves and redirects.',
   null,
   E'1. From any budget tab, trigger "Create Snapshot" from the header menu.\n2. Wait for the toast.',
   'A loading toast appears, then a success toast reads "Snapshot created successfully". The page shifts to the Snapshots tab and the new snapshot appears at the top of the list.',
   'MEDIUM', '/67/budget'),

  -- 10. Cost codes tab
  ('10.1', 'Cost Codes', 'Tab works',
   'Cost Codes tab lists project cost codes',
   'Verifies the Cost Codes tab loads configured codes.',
   null,
   E'1. Click the Cost Codes tab.\n2. Wait for the table to load.',
   'A list of cost codes renders with code + description (or an empty state if none configured). No error banner.',
   'MEDIUM', '/67/budget?tab=cost-codes'),

  -- 11. Views
  ('11.1', 'Views', 'Configure views',
   'Open Budget Views modal and save a new view',
   'Verifies the financial views configuration modal works.',
   null,
   E'1. From the header actions, click "Configure Budget Views".\n2. In the modal, fill the view name "Test View" and adjust any columns.\n3. Save.',
   'A success confirmation appears; the modal closes. If the tool renders a view switcher, the new "Test View" is selectable.',
   'LOW', '/67/budget'),

  -- 12. Import / Export
  ('12.1', 'Import', 'Open importer',
   'Import modal opens and rejects invalid file',
   'Verifies the Import Budget modal exists and surfaces validation errors.',
   null,
   E'1. From the header actions, click "Import".\n2. In the modal, try to upload a small invalid file (e.g. a .txt file).',
   'The import modal opens. Submitting an invalid file triggers a validation error describing the expected format. No rows are created.',
   'MEDIUM', '/67/budget'),

  ('12.2', 'Export', 'CSV export downloads',
   'Export CSV downloads a file',
   'Verifies the CSV export action completes end-to-end.',
   null,
   E'1. From the header actions, trigger Export → CSV.\n2. Wait for the toast chain to finish.',
   'A success toast reads "Export completed successfully!" with file details. A file named budget-export.csv is downloaded in the browser.',
   'MEDIUM', '/67/budget'),

  ('12.3', 'Export', 'Excel export downloads',
   'Export Excel downloads a file',
   'Verifies the Excel export action completes.',
   null,
   E'1. From the header actions, trigger Export → Excel.\n2. Wait for the toast chain to finish.',
   'A success toast confirms the export. A file named budget-export.xlsx is downloaded.',
   'LOW', '/67/budget'),

  -- 13. Filters / grouping
  ('13.1', 'Filters', 'Quick filter persists',
   'Quick filter persists across reloads',
   'Verifies the saved preference applies to the next visit.',
   null,
   E'1. Pick a quick filter other than "All Items".\n2. Refresh the page.',
   'After reload, the same quick filter is still applied and the table reflects the filtered state without manual reselection.',
   'LOW', '/67/budget'),

  ('13.2', 'Filters', 'Grouping',
   'Grouping changes the table structure',
   'Verifies grouping options reorganize the table.',
   null,
   E'1. Change the grouping to "Cost Code Tier 1".\n2. Change the grouping to another option (e.g. Cost Type).',
   'Each grouping change re-renders the table with different group headers or ordering. No error banner.',
   'LOW', '/67/budget'),

  -- 14. Change history
  ('14.1', 'Change History', 'List renders',
   'Change history shows recent edits',
   'Verifies recent budget edits appear in the change history tab.',
   E'- Make at least one line-item edit before running this test.',
   E'1. Click the Change History tab.\n2. Scan the list.',
   'The latest edit appears at the top with fields changed, old value, new value, user, and timestamp. No error banner.',
   'MEDIUM', '/67/budget?tab=change-history'),

  -- 15. Settings
  ('15.1', 'Settings', 'Save settings',
   'Budget settings panel saves a preference',
   'Verifies at least one budget setting can be toggled and persisted.',
   null,
   E'1. Click the Settings tab.\n2. Toggle one setting (e.g. a budget view default) and save.\n3. Refresh the page.\n4. Return to Settings.',
   'A success toast confirms save. The toggled value is still set after refresh.',
   'LOW', '/67/budget?tab=settings'),

  -- 16. Permissions
  ('16.1', 'Permissions', 'Read-only user',
   'Read-only user cannot create, edit, or delete',
   'Verifies permission gating hides admin actions.',
   E'- Log in as a user with read-only access to the budget.',
   E'1. Navigate to /67/budget.\n2. Inspect the header and row actions.',
   'The "Create" button, "Modification" action, row Edit/Delete menu items, and bulk-delete bar are hidden or disabled. The user can still view rows and column totals.',
   'MEDIUM', '/67/budget'),

  -- 17. Edge cases
  ('17.1', 'Edge', 'Empty state',
   'Unknown filter yields empty-state UI',
   'Verifies the filtered empty state.',
   null,
   E'1. In the search/filter, apply a filter that matches no lines (e.g. search for "zzzz-nomatch").',
   'The table shows an empty-state message like "No matching budget lines" or similar. No error banner. Removing the filter restores the rows.',
   'LOW', '/67/budget')
) as v(test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url)
where s.tool_name = 'budget' and s.suite_type = 'feature';
update public.test_suites
   set total_cases = (select count(*) from public.test_cases where suite_id = test_suites.id)
 where tool_name = 'budget' and suite_type = 'feature';
commit;
