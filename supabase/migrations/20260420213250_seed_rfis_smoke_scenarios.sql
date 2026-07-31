-- Seed rfis SMOKE suite (10 critical-path cases).
-- Idempotent: re-running this file regenerates the suite + cases cleanly.

begin;
with s as (
  insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
  values ('rfis', 'smoke', 'RFIs — Smoke', 0)
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
   'RFIs page loads with table',
   'Checks the tool opens without a 500 and the data table renders.',
   null::text,
   E'1. Log in as test1@mail.com.\n2. Open project "Vermillion Rise Warehouse".\n3. Click "RFIs" in the left sidebar.\n4. Wait for the page to stop loading.',
   'The RFIs page loads. The table header shows columns including #, Subject, Status, Assignees, Due Date, Ball In Court, and RFI Manager. Either rows are visible or the "No RFIs found" empty state is shown. No red error banner appears.',
   'HIGH', '/67/rfis'),

  ('1.2', 'Create', 'Primary action',
   'Create RFI button opens the new RFI form',
   'Verifies the primary create action navigates to the new RFI page.',
   null,
   E'1. Click the "Create RFI" button in the top-right of the RFIs page.\n2. Wait for the page to stop loading.',
   'The URL becomes /67/rfis/new. A form titled "New RFI" renders with a Subject field, Question textarea, Due Date, RFI Manager, Assignees input, and sections for Assignment and Additional Details.',
   'HIGH', '/67/rfis'),

  ('1.3', 'Navigation', 'Row click',
   'Clicking a row opens the RFI detail',
   'Verifies the list → detail navigation works.',
   E'- At least one RFI exists in the list.',
   E'1. Click the first row in the RFIs table.\n2. Wait for the detail page to load.',
   'The URL becomes /67/rfis/<id>. The detail page shows the RFI number, subject, status badge, and a Responses section. Header actions (Edit, Delete, Create Change Event) are visible.',
   'HIGH', '/67/rfis'),

  ('1.4', 'Filters', 'Search',
   'Search input filters the list',
   'Smoke check that typing in the search box narrows the table.',
   null,
   E'1. Type a known subject fragment or RFI number into the search box at the top of the table.\n2. Wait one second for the debounce.',
   'The table either narrows to matching rows or shows the filtered empty state "Try adjusting your search or filters".',
   'HIGH', '/67/rfis'),

  ('1.5', 'Filters', 'Status filter',
   'Status filter narrows the list',
   'Verifies a status filter can be applied from the toolbar.',
   null,
   E'1. Open the "Filters" menu in the table toolbar.\n2. Pick Status = "Open".\n3. Apply the filter.',
   'The URL includes status=open. Every visible row shows Status = "Open" (or the filtered empty state appears).',
   'HIGH', '/67/rfis'),

  ('1.6', 'Filters', 'Column visibility',
   'Column visibility toggle hides a column',
   'Smoke check that the column visibility menu removes a column from the table.',
   null,
   E'1. Open the "Columns" menu in the table toolbar.\n2. Uncheck "Due Date".',
   'The "Due Date" column disappears from the table header and all rows. The column is still listed (unchecked) in the menu.',
   'MEDIUM', '/67/rfis'),

  ('1.7', 'Navigation', 'View switch',
   'Card view renders',
   'Smoke check that the card view option renders without error.',
   null,
   E'1. In the table toolbar, switch the view mode to "Card".\n2. Wait for the layout to update.',
   'The list re-renders as cards (one card per RFI showing number, subject, status). The URL includes view=card. No error banner appears.',
   'MEDIUM', '/67/rfis'),

  ('1.8', 'Navigation', 'View switch',
   'List view renders',
   'Smoke check that the list view option renders without error.',
   null,
   E'1. In the table toolbar, switch the view mode to "List".\n2. Wait for the layout to update.',
   'The RFIs re-render as a condensed list. The URL includes view=list. No error banner appears.',
   'MEDIUM', '/67/rfis'),

  ('1.9', 'Display', 'Empty state',
   'Filtered empty state renders',
   'Verifies the empty-state message appears when filters match nothing.',
   null,
   E'1. Type "zzzzzzzz-no-match" into the search box.\n2. Wait one second.',
   'The table shows the filtered empty state with the message "Try adjusting your search or filters" (or the default "No RFIs found" empty state if no RFIs exist).',
   'MEDIUM', '/67/rfis'),

  ('1.10', 'Navigation', 'Edit mode',
   'Edit button switches detail into edit mode',
   'Smoke check that the Edit action on the detail page enters edit mode.',
   E'- At least one RFI exists.',
   E'1. Open any RFI detail page.\n2. Click the three-dot menu (or Edit button) in the header and choose Edit.\n3. Wait for the form to load.',
   'The URL becomes /67/rfis/<id>?mode=edit. The detail page shows editable form controls (Subject, Question, Due Date, etc.) with Save and Cancel buttons in an EditModeActions bar.',
   'HIGH', '/67/rfis')
) as v(test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url)
where s.tool_name = 'rfis' and s.suite_type = 'smoke';
update public.test_suites
   set total_cases = (select count(*) from public.test_cases where suite_id = test_suites.id)
 where tool_name = 'rfis' and suite_type = 'smoke';
commit;
