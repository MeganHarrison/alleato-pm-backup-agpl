-- Seed: Budget — Smoke test suite
-- Generated: 2026-05-14
-- Supabase project: lgveqfnpkxvzbnnwuled

-- 1. Upsert suite
insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
values ('budget', 'smoke', 'Budget — Smoke', 0)
on conflict (tool_name, suite_type) do update set
  display_name      = excluded.display_name,
  last_generated_at = now()
returning id;

-- NOTE: Replace <SUITE_ID> with the id returned above before running steps 2–4.

-- 2. Wipe existing cases
-- delete from public.test_cases where suite_id = '<SUITE_ID>';

-- 3. Insert cases
-- insert into public.test_cases
--   (suite_id, test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, test_type, start_url)
-- values
--   ('<SUITE_ID>', '1.1', 'Navigation', 'Page load',
--    'Open the Budget page',
--    'Verifies the budget page renders without a JavaScript error or 500.',
--    'Log in as test1@mail.com.',
--    E'1. Navigate to /67/budget.\n2. Wait for the page to finish loading.',
--    'The page renders. The budget table is visible with column headers (Description, Original Budget Amount, Revised Budget, etc.) or an empty state is shown. No error banner appears.',
--    'HIGH', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.2', 'Navigation', 'Table columns',
--    'Budget table shows expected columns',
--    'Confirms the core financial columns are rendered and labelled correctly.',
--    'Budget page is open.',
--    E'1. Inspect the table header row.',
--    'Columns visible include at minimum: Description, Original Budget Amount, Budget Modifications, Approved COs, Revised Budget, and Projected Budget.',
--    'HIGH', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.3', 'Navigation', 'Grand totals row',
--    'Grand totals row is rendered at the bottom',
--    'Confirms the footer totals row is present so the user can see aggregate numbers.',
--    'Budget page has at least one line item.',
--    E'1. Scroll to the bottom of the budget table.\n2. Locate the "Grand Total" row.',
--    'A grand totals row is visible at the bottom of the table. Numeric values appear in the financial columns (not blank).',
--    'HIGH', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.4', 'Navigation', 'Tab switching — Budget Details',
--    'Switching to the Budget Details tab loads without error',
--    'Verifies the secondary Budget Details tab does not throw a 500.',
--    'Budget page is open.',
--    E'1. Click the "Budget Details" tab.\n2. Wait for the page to finish loading.',
--    'The Budget Details tab content renders. A table with budget-code-level rows is visible or an empty state is shown. No error banner appears.',
--    'HIGH', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.5', 'Navigation', 'Tab switching — Cost Codes',
--    'Switching to the Cost Codes tab loads without error',
--    'Checks that cost code assignment data loads correctly.',
--    'Budget page is open.',
--    E'1. Click the "Cost Codes" tab.\n2. Wait for the page to finish loading.',
--    'The Cost Codes tab renders without error. A list or table of cost codes is visible (or empty state).',
--    'HIGH', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.6', 'Navigation', 'Tab switching — Forecasting',
--    'Switching to the Forecasting tab loads without error',
--    'Verifies the forecasting view renders for at least one budget line.',
--    'Budget page is open and has line items.',
--    E'1. Click the "Forecasting" tab.\n2. Wait for the page to finish loading.',
--    'The Forecasting tab renders without error. Budget line items are listed with forecast method selectors or values visible.',
--    'HIGH', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.7', 'Navigation', 'Tab switching — Snapshots',
--    'Switching to the Snapshots tab loads without error',
--    'Checks that the snapshot history view opens cleanly.',
--    'Budget page is open.',
--    E'1. Click the "Snapshots" tab.\n2. Wait for the page to finish loading.',
--    'The Snapshots tab renders without error. A list of saved snapshots is visible or an empty state ("No snapshots yet") is shown.',
--    'MEDIUM', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.8', 'Navigation', 'Tab switching — Change History',
--    'Switching to the Change History tab loads without error',
--    'Confirms the audit trail tab loads.',
--    'Budget page is open.',
--    E'1. Click the "Change History" tab.\n2. Wait for the page to finish loading.',
--    'The Change History tab renders without error. A chronological list of budget changes is visible or an empty state is shown.',
--    'MEDIUM', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.9', 'Navigation', 'Quick filter — With Direct Costs',
--    'Applying the "With Direct Costs" quick filter narrows the list',
--    'Smoke-tests the most common quick filter so we know filtering is wired up.',
--    'Budget main tab is open with at least one line item.',
--    E'1. Click the "With Direct Costs" quick-filter chip.\n2. Wait for the table to re-render.',
--    'The table list changes (rows with direct cost values remain; rows without are hidden) OR a filtered empty state is shown. The chip appears selected/active.',
--    'MEDIUM', 'scenario', '/67/budget'),
--   ('<SUITE_ID>', '1.10', 'Navigation', 'Export button',
--    'Clicking Export initiates a file download',
--    'Verifies the Excel export endpoint is reachable and returns a file.',
--    'Budget main tab is open.',
--    E'1. Click the "Export" button in the page toolbar.\n2. Wait for the download to begin.',
--    'A .xlsx file download starts within 5 seconds. No error toast appears.',
--    'HIGH', 'scenario', '/67/budget');

-- 4. Update total_cases
-- update public.test_suites
--    set total_cases = (select count(*) from public.test_cases where suite_id = '<SUITE_ID>')
--  where id = '<SUITE_ID>';
