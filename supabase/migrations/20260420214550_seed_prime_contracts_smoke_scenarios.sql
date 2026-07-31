-- Seed prime-contracts SMOKE suite (10 critical-path cases).
-- Idempotent: re-running this file regenerates the suite + cases cleanly.

begin;
insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
values ('prime-contracts', 'smoke', 'Prime Contracts — Smoke', 0)
on conflict (tool_name, suite_type) do update set
  display_name = excluded.display_name,
  last_generated_at = now();
delete from public.test_cases
 where suite_id = (select id from public.test_suites
                     where tool_name = 'prime-contracts' and suite_type = 'smoke');
insert into public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
select s.id, v.test_number, v.category, v.subcategory, v.test_name,
       v.context_note, v.setup_steps, v.steps, v.expected_result, v.priority,
       'scenario', v.start_url
from public.test_suites s
cross join (values
  ('1.1', 'Navigation', 'Page load',
   'Prime Contracts page loads with table',
   'Checks the tool opens without a 500 and the data table renders.',
   null::text,
   E'1. Log in as test1@mail.com.\n2. Open project "Vermillion Rise Warehouse".\n3. Click "Prime Contracts" in the left sidebar.\n4. Wait for the page to stop loading.',
   'The Prime Contracts page loads. The table header shows columns including Number, Owner/Client, Title, ERP Status, Status, Executed, and several amount columns (Original Contract Amount, Revised Contract Amount, etc.). Rows or the "No contracts found" empty state render. No red error banner.',
   'HIGH', '/67/prime-contracts'),

  ('1.2', 'Create', 'Primary action',
   'Create button opens the new contract form',
   'Verifies the primary create action navigates to the new contract page.',
   null,
   E'1. Click the "Create" button in the top-right of the Prime Contracts page.\n2. Wait for the page to stop loading.',
   'The URL becomes /67/prime-contracts/new. A form titled "New Prime Contract" renders with fields for Number, Title, Owner/Client, Status, and a Schedule of Values section.',
   'HIGH', '/67/prime-contracts'),

  ('1.3', 'Navigation', 'Configure',
   'Settings icon opens the configure page',
   'Smoke check that the gear icon next to Create opens the tool configuration page.',
   null,
   E'1. Click the gear/Settings icon next to the "Create" button.\n2. Wait for the page to stop loading.',
   'The URL becomes /67/prime-contracts/configure. A configuration page renders (tier count, permission toggles, SOV settings).',
   'MEDIUM', '/67/prime-contracts'),

  ('1.4', 'Navigation', 'Row click',
   'Clicking a row opens the contract detail',
   'Verifies the list → detail navigation works.',
   E'- At least one prime contract exists in the list.',
   E'1. Click the first row in the Prime Contracts table.\n2. Wait for the detail page to load.',
   'The URL becomes /67/prime-contracts/<id>. The detail page shows the contract number, title, status badge, and the tab strip including General, SOV, Change Orders, Commitments, Invoices, Payments Received, Related Items, Emails, Change History, Financial Markup, and Advanced Settings.',
   'HIGH', '/67/prime-contracts'),

  ('1.5', 'Filters', 'Search',
   'Search input filters the list',
   'Smoke check that typing in the search box narrows the table.',
   null,
   E'1. Type a known contract number or title fragment into the search box at the top of the table.\n2. Wait one second for the debounce.',
   'The table either narrows to matching rows or shows the filtered empty state "Try adjusting your search or filters".',
   'HIGH', '/67/prime-contracts'),

  ('1.6', 'Filters', 'Status filter',
   'Status filter narrows the list',
   'Verifies a status filter can be applied from the toolbar.',
   null,
   E'1. Open the "Filters" menu in the table toolbar.\n2. Pick Status = "Draft".\n3. Apply the filter.',
   'The URL includes status=draft. Every visible row shows Status = "Draft" (or the filtered empty state appears).',
   'HIGH', '/67/prime-contracts'),

  ('1.7', 'Filters', 'Executed filter',
   'Executed filter narrows the list',
   'Smoke check that the Executed yes/no filter works.',
   null,
   E'1. Open the "Filters" menu in the toolbar.\n2. Pick Executed = "Yes".\n3. Apply the filter.',
   'Only rows with an executed contract appear (or the filtered empty state).',
   'MEDIUM', '/67/prime-contracts'),

  ('1.8', 'Filters', 'Column visibility',
   'Column visibility toggle hides a column',
   'Smoke check that the column visibility menu removes a column from the table.',
   null,
   E'1. Open the "Columns" menu in the table toolbar.\n2. Uncheck "Executed".',
   'The "Executed" column disappears from the table header and all rows. The column is still listed (unchecked) in the menu.',
   'MEDIUM', '/67/prime-contracts'),

  ('1.9', 'Display', 'Expand row',
   'Expand chevron reveals change orders + PCOs',
   'Smoke check that the expand arrow on each row loads sub-rows for PCCOs and PCOs.',
   E'- At least one prime contract exists.',
   E'1. Click the chevron on the first row.\n2. Wait for the sub-row to finish loading.',
   'An expanded row appears beneath the contract. It shows either "No change orders or potential change orders", or Change Orders and/or Potential Change Orders tables listing Number, Title, Status, Amount.',
   'MEDIUM', '/67/prime-contracts'),

  ('1.10', 'Display', 'Empty state',
   'Filtered empty state renders',
   'Verifies the empty-state message appears when filters match nothing.',
   null,
   E'1. Type "zzzzzzzz-no-match" into the search box.\n2. Wait one second.',
   'The table shows the filtered empty state with the message "Try adjusting your search or filters" (or the default "No contracts found" empty state if no contracts exist).',
   'MEDIUM', '/67/prime-contracts')
) as v(test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url)
where s.tool_name = 'prime-contracts' and s.suite_type = 'smoke';
update public.test_suites
   set total_cases = (select count(*) from public.test_cases where suite_id = test_suites.id)
 where tool_name = 'prime-contracts' and suite_type = 'smoke';
commit;
