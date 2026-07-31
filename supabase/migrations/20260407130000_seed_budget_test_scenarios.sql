-- Seed Budget tool test suite + 10 manual-tester scenarios.
-- Reuses tables from 20260406000002_test_tracking.sql.

INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('budget', 'Budget', 10)
ON CONFLICT (tool_name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      last_generated_at = now();
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority)
VALUES
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Open',
   'Open the Budget page for a project',
   E'1. Open project "Vermillion Rise Warehouse"\n2. Click "Budget" in the left sidebar',
   'Budget table loads with line items and totals visible. No console errors. No spinner stuck on screen.',
   'HIGH'),

  ((SELECT id FROM suite), '1.2', 'Read', 'Totals',
   'Budget summary totals match the line items',
   E'1. Open Budget page\n2. Note the "Original Budget" total at the top\n3. Manually add the Original Budget column from the table rows',
   'The summary total equals the sum of the visible rows (allowing for rounding to whole dollars).',
   'HIGH'),

  ((SELECT id FROM suite), '2.1', 'Create', 'New line item',
   'Create a new budget line item',
   E'1. Click "New Line Item" (or equivalent button)\n2. Fill: Cost Code = pick any, Description = "Test line", Original Budget = 1000\n3. Click Save',
   'New row appears in the table. Original Budget total at the top increases by $1,000. No error toast.',
   'HIGH'),

  ((SELECT id FROM suite), '2.2', 'Create', 'Validation',
   'Required fields block save',
   E'1. Click "New Line Item"\n2. Leave Cost Code empty\n3. Click Save',
   'Form shows a validation error on Cost Code. Save does not happen. No row is added.',
   'MEDIUM'),

  ((SELECT id FROM suite), '3.1', 'Edit', 'Inline edit',
   'Edit a budget line item and verify it persists',
   E'1. Click an existing line item to open / edit\n2. Change Original Budget to a new value\n3. Save\n4. Refresh the page',
   'After refresh, the new value is still showing. Totals at top reflect the change.',
   'HIGH'),

  ((SELECT id FROM suite), '3.2', 'Edit', 'Cancel',
   'Cancel an edit discards changes',
   E'1. Open a line item for edit\n2. Change a value\n3. Click Cancel (or close the dialog)\n4. Refresh',
   'The original value is still in place. Nothing was saved.',
   'MEDIUM'),

  ((SELECT id FROM suite), '4.1', 'Delete', 'Single row',
   'Delete a budget line item',
   E'1. Select the row created in test 2.1\n2. Click Delete (or row action menu → Delete)\n3. Confirm',
   'Row disappears from the table. Original Budget total decreases by $1,000. Refresh confirms it stays deleted.',
   'HIGH'),

  ((SELECT id FROM suite), '5.1', 'Forecast', 'Edit forecast',
   'Edit the forecast-to-complete value on a line item',
   E'1. Find a line item with a forecast column\n2. Edit Forecast to Complete\n3. Save',
   'Forecast value updates. Variance / projected total recalculates. Refresh persists the change.',
   'HIGH'),

  ((SELECT id FROM suite), '6.1', 'Filters', 'Search',
   'Search filters the budget table',
   E'1. Type a known cost code or description in the toolbar search\n2. Observe the table',
   'Only matching rows are visible. Clearing the search restores all rows.',
   'MEDIUM'),

  ((SELECT id FROM suite), '7.1', 'Export', 'CSV / Excel',
   'Export the budget to a file',
   E'1. Click the export icon in the toolbar\n2. Choose CSV or Excel\n3. Open the downloaded file',
   'File downloads. It contains the same rows shown in the table with matching totals.',
   'LOW')
ON CONFLICT (suite_id, test_number) DO UPDATE
  SET test_name       = EXCLUDED.test_name,
      steps           = EXCLUDED.steps,
      expected_result = EXCLUDED.expected_result,
      priority        = EXCLUDED.priority,
      category        = EXCLUDED.category,
      subcategory     = EXCLUDED.subcategory,
      updated_at      = now();
UPDATE public.test_suites
   SET total_cases = (SELECT count(*) FROM public.test_cases WHERE suite_id = test_suites.id)
 WHERE tool_name = 'budget';
