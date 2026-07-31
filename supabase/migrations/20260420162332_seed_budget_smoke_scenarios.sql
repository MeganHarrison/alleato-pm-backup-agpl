-- Seed budget SMOKE suite (critical-path cases).
-- Idempotent: re-running regenerates the suite + cases cleanly.

begin;
with s as (
  insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
  values ('budget', 'smoke', 'Budget — Smoke', 0)
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
   'Budget page loads with table',
   'Checks the tool opens without a 500 and the data table renders.',
   null,
   E'1. Log in as test1@mail.com.\n2. Open project "Vermillion Rise Warehouse".\n3. Click "Budget" in the left sidebar.\n4. Wait for the page to stop loading.',
   'The Budget page loads. The table header shows columns including Cost Code, Description, Original Budget, Revised Budget, and Projected Costs. Rows are visible or an empty state is shown. No red error banner appears.',
   'HIGH', '/67/budget'),

  ('1.2', 'Navigation', 'Tabs',
   'Budget Details tab loads',
   'Verifies the Budget Details tab renders its table.',
   null,
   E'1. From the Budget page, click the "Budget Details" tab.\n2. Wait for the details table to finish loading.',
   'The URL includes ?tab=budget-details. A details table renders (or empty state). No error banner.',
   'HIGH', '/67/budget'),

  ('1.3', 'Navigation', 'Tabs',
   'Cost Codes tab loads',
   'Verifies the Cost Codes tab renders its editor.',
   null,
   E'1. Click the "Cost Codes" tab.\n2. Wait for the page to finish loading.',
   'The URL includes ?tab=cost-codes. A cost codes panel renders. No error banner.',
   'HIGH', '/67/budget?tab=cost-codes'),

  ('1.4', 'Navigation', 'Tabs',
   'Forecasting tab loads',
   'Verifies the Forecasting tab renders without error.',
   null,
   E'1. Click the "Forecasting" tab.\n2. Wait for the page to finish loading.',
   'The URL includes ?tab=forecasting. A forecasting panel renders. No error banner.',
   'HIGH', '/67/budget?tab=forecasting'),

  ('1.5', 'Navigation', 'Tabs',
   'Project Status Snapshots tab loads',
   'Verifies the Snapshots tab renders its list.',
   null,
   E'1. Click the "Project Status Snapshots" tab.\n2. Wait for the list to finish loading.',
   'The URL includes ?tab=snapshots. A snapshots list renders or an empty state appears. No error banner.',
   'MEDIUM', '/67/budget?tab=snapshots'),

  ('1.6', 'Navigation', 'Tabs',
   'Change History tab loads',
   'Verifies the Change History tab renders its table.',
   null,
   E'1. Click the "Change History" tab.\n2. Wait for the list to load.',
   'The URL includes ?tab=change-history. A change history list renders or an empty state appears. No error banner.',
   'MEDIUM', '/67/budget?tab=change-history'),

  ('1.7', 'Navigation', 'Tabs',
   'Settings tab loads',
   'Verifies the Settings tab renders the budget settings panel.',
   null,
   E'1. Click the "Settings" tab.\n2. Wait for the panel to load.',
   'The URL includes ?tab=settings. A Budget Settings panel with configuration fields renders. No error banner.',
   'MEDIUM', '/67/budget?tab=settings'),

  ('1.8', 'Create', 'Primary action',
   'Create opens the line item creator modal',
   'Verifies the primary Create button opens the line-item creator.',
   null,
   E'1. On the Budget tab, click the "Create" button in the page header.',
   'A modal titled "Add Budget Line Items" (or similar) opens with fields for budget code, description, quantity, UOM, unit cost, and amount.',
   'HIGH', '/67/budget'),

  ('1.9', 'Filters', 'Quick filters',
   'Quick filter narrows the budget list',
   'Smoke check that a quick filter changes the visible rows.',
   null,
   E'1. Open the "Filters" or "Quick Filter" control in the toolbar.\n2. Pick any filter other than "All Items".\n3. Wait for the table to refresh.',
   'A toast confirms the filter (e.g. "Filter applied: ..."). The table narrows to matching rows or shows the filtered empty state.',
   'MEDIUM', '/67/budget'),

  ('1.10', 'Filters', 'Grouping',
   'Group-by control reorders rows',
   'Smoke check that changing the grouping reorganizes the table.',
   null,
   E'1. Open the grouping selector in the toolbar.\n2. Pick a different grouping (e.g. "Cost Code Tier 1").\n3. Wait for the table to refresh.',
   'The table re-renders with group headers/sections matching the chosen grouping, or row ordering visibly changes.',
   'MEDIUM', '/67/budget'),

  ('1.11', 'Display', 'Grand totals',
   'Totals row shows currency values',
   'Verifies the grand totals footer renders formatted currency.',
   null,
   E'1. Scroll to the footer of the budget table.\n2. Inspect the Totals row.',
   'A totals row renders with "$" currency values for at least Original Budget, Revised Budget, and Projected Costs.',
   'HIGH', '/67/budget'),

  ('1.12', 'Navigation', 'Row action',
   'Clicking a budget amount opens a detail modal',
   'Verifies the list → detail modal navigation works.',
   E'- At least one budget line item exists.',
   E'1. Click a value in the "Approved COs" or "Committed Costs" column on any row.\n2. Wait for the modal to open.',
   'A modal opens showing the underlying records for that column and that line item (or an empty state). No error banner.',
   'MEDIUM', '/67/budget'),

  ('1.13', 'Actions', 'Export',
   'Export menu is reachable',
   'Smoke check that the export action is exposed and triggers a download.',
   null,
   E'1. Open the header actions menu.\n2. Click "Export" and choose CSV (or Excel).',
   'A toast shows "Preparing ... export". A download for a file named like budget-export.csv (or .xlsx) starts, and a success toast appears.',
   'MEDIUM', '/67/budget'),

  ('1.14', 'Lock', 'Lock status',
   'Lock/Unlock control is present',
   'Verifies the lock action is exposed in the header.',
   null,
   E'1. Open the header actions menu on the Budget tab.',
   'Either "Lock Budget" (if unlocked) or "Unlock Budget" (if locked) is visible in the menu. The page header shows current lock status.',
   'MEDIUM', '/67/budget')
) as v(test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url)
where s.tool_name = 'budget' and s.suite_type = 'smoke';
update public.test_suites
   set total_cases = (select count(*) from public.test_cases where suite_id = test_suites.id)
 where tool_name = 'budget' and suite_type = 'smoke';
commit;
