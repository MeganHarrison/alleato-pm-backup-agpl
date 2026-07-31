-- Seed commitments SMOKE suite (10 critical-path cases).
-- Idempotent: re-running this file regenerates the suite + cases cleanly.

begin;
with s as (
  insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
  values ('commitments', 'smoke', 'Commitments — Smoke', 0)
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
  ('1.1', 'Navigation', 'Page load',
   'Commitments page loads with table',
   'Checks the tool opens without a 500 and the data table renders.',
   null,
   E'1. Log in as test1@mail.com.\n2. Open project "Vermillion Rise Warehouse".\n3. Click "Commitments" in the left sidebar.\n4. Wait for the page to stop loading.',
   'The Commitments page loads. The table header shows columns including Number, Title, Type, Status, and Original Amount. Either rows are visible or the "No commitments found" empty state is shown. No red error banner appears.',
   'HIGH', '/67/commitments'),

  ('1.2', 'Navigation', 'Tabs',
   'Subcontracts tab filters the list',
   'Verifies the Subcontracts tab applies a type=subcontract filter.',
   null,
   E'1. From the Commitments page, click the "Subcontracts" tab.\n2. Wait for the table to refresh.',
   'The URL includes ?type=subcontract. Every visible row shows Type = "Subcontract" (or an empty state appears).',
   'HIGH', '/67/commitments'),

  ('1.3', 'Navigation', 'Tabs',
   'Purchase Orders tab filters the list',
   'Verifies the Purchase Orders tab applies a type=purchase_order filter.',
   null,
   E'1. From the Commitments page, click the "Purchase Orders" tab.\n2. Wait for the table to refresh.',
   'The URL includes ?type=purchase_order. Every visible row shows Type = "Purchase Order" (or an empty state appears).',
   'HIGH', '/67/commitments'),

  ('1.4', 'Navigation', 'Tabs',
   'Change Orders tab renders project-level COs',
   'Verifies the Change Orders tab loads the aggregated CO table.',
   null,
   E'1. From the Commitments page, click the "Change Orders" tab.\n2. Wait for the panel to load.',
   'A change orders table appears with columns #, Description, Status, Commitment, Amount, Requested, OR the empty state "No change orders for this project" renders. No error banner.',
   'HIGH', '/67/commitments?tab=change-orders'),

  ('1.5', 'Create', 'Primary action',
   'Create dropdown offers Subcontract and Purchase Order',
   'Verifies the primary Create button exposes both commitment types.',
   null,
   E'1. Click the "Create" button in the top right of the Commitments page.\n2. Observe the dropdown.',
   'A dropdown menu opens with two items: "Subcontract" and "Purchase Order".',
   'HIGH', '/67/commitments'),

  ('1.6', 'Filters', 'Search',
   'Search input filters the list',
   'Smoke check that typing in the search box narrows the table.',
   null,
   E'1. Type a known commitment number or title fragment into the search box (e.g. "SC" or "PO").\n2. Wait one second for the debounce.',
   'The table either narrows to matching rows or shows the filtered empty state "Try adjusting your search or filters".',
   'HIGH', '/67/commitments'),

  ('1.7', 'Filters', 'Status filter',
   'Status filter narrows the list',
   'Verifies a status filter can be applied from the toolbar.',
   null,
   E'1. Open the "Filters" menu in the table toolbar.\n2. Pick Status = "Draft".\n3. Apply the filter.',
   'The URL includes status=Draft. Every visible row shows Status = "Draft" (or an empty state).',
   'MEDIUM', '/67/commitments'),

  ('1.8', 'Navigation', 'Recycle bin',
   'Recycle Bin tab loads',
   'Smoke check that the recycle bin route renders.',
   null,
   E'1. From the Commitments page, click the "Recycle Bin" tab.\n2. Wait for the page to load.',
   'A page with heading or label "Recycle Bin" renders. Either deleted commitments are listed or an empty state appears. No error banner.',
   'MEDIUM', '/67/commitments/recycle-bin'),

  ('1.9', 'Navigation', 'Row click',
   'Clicking a row opens the commitment detail',
   'Verifies the list → detail navigation works.',
   E'- At least one commitment exists in the list.',
   E'1. Click the first row in the Commitments table.\n2. Wait for the detail page to load.',
   'The URL becomes /67/commitments/<id>. The detail page shows the commitment number and title, and a tab bar with General, Schedule of Values, Change Management, Invoices, etc.',
   'HIGH', '/67/commitments'),

  ('1.10', 'Display', 'Footer totals',
   'Totals row renders currency values',
   'Verifies the financial totals footer is calculated and formatted.',
   null,
   E'1. From the Commitments page, scroll to the footer of the table.\n2. Inspect the "Totals" row.',
   'A footer labeled "Totals" renders currency values (with "$" prefix and thousands separators) for at least Original Amount, Approved Change Orders, and Revised Contract Amount.',
   'MEDIUM', '/67/commitments')
) as v(test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url)
where s.tool_name = 'commitments' and s.suite_type = 'smoke';
update public.test_suites
   set total_cases = (select count(*) from public.test_cases where suite_id = test_suites.id)
 where tool_name = 'commitments' and suite_type = 'smoke';
commit;
