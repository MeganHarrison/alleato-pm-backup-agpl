-- ============================================================================
-- Seed: Meetings Test Scenarios
-- Generated: 2026-04-08
-- Suite: meetings
-- Type: scenario (plain-English guided tests for non-technical testers)
-- Runner: http://localhost:3000/testing
-- 13 scenarios across 9 categories
-- ============================================================================

-- Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('meetings', 'Meetings', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Insert all scenarios
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'meetings')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

  -- ── 1. Navigation ──────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the Meetings page',
   'Checks that the Meetings list page loads without errors and shows existing meeting records. A meeting record is a log of a real project meeting — who attended, what was discussed, and what decisions were made.',
   NULL,
   E'1. Make sure you are logged in as test1@mail.com\n2. Go to: http://localhost:3000/767/meetings\n3. Wait for the page to stop loading',
   'The page loads fully. A table of meetings is visible with columns for Title, Date, Project, Description, Participants, and Links. No error messages appear. The page title says "Meetings".',
   'HIGH', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '1.2', 'Navigation', 'Detail view',
   'Open a meeting detail page',
   'Checks that clicking a meeting record opens a detail page with all the meeting information — summary, action items, decisions, transcript, and more.',
   'The Meetings list must have at least one existing record.',
   E'1. Open the Meetings page at /767/meetings\n2. Click the title of any meeting in the list\n3. Wait for the page to finish loading',
   'The meeting detail page opens. The meeting title is shown at the top. Sections visible include: Summary, Action Items, Decisions, Risks, and Transcript (or similar). No error messages appear.',
   'HIGH', 'scenario', '/767/meetings'),

  -- ── 2. Create ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '2.1', 'Create', 'Basic creation',
   'Create a new meeting with required fields only',
   'Checks that a user can log a new meeting with just a title and it appears in the list.',
   NULL,
   E'1. On the Meetings page, click the "New Meeting" or "Add Meeting" button (top right)\n2. In the Title field, type: Weekly Coordination Meeting\n3. Click the Save or Create button\n4. Wait for the page to stop loading',
   'A success message appears. The new meeting "Weekly Coordination Meeting" appears in the list. No error messages are shown.',
   'HIGH', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '2.2', 'Create', 'All fields',
   'Create a meeting with all fields filled in',
   'Checks that optional fields — date, duration, participants, category, description — all save correctly.',
   NULL,
   E'1. Click "New Meeting"\n2. In the Title field, type: Full Fields Meeting Test\n3. In the Date field, enter: 2026-04-08\n4. In the Duration field, type: 60\n5. In the Participants field, type: Alice Smith, Bob Jones\n6. In the Category field, type: Project\n7. In the Description field, type: This is a test meeting with all fields filled in\n8. Click Save\n9. Find "Full Fields Meeting Test" in the list and click it to open',
   'The detail page shows all saved values: date 2026-04-08, duration 60 minutes, participants Alice Smith and Bob Jones, category Project, and the description. No fields are blank.',
   'MEDIUM', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '2.3', 'Create', 'Validation',
   'Try to create a meeting without a title',
   'Checks that the form prevents saving when the required Title field is left empty.',
   NULL,
   E'1. Click "New Meeting"\n2. Leave the Title field completely empty\n3. Click the Save or Create button',
   'An error message appears near the Title field (e.g. "Title is required"). The record is NOT created. The form stays open.',
   'HIGH', 'scenario', '/767/meetings'),

  -- ── 3. Edit ────────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '3.1', 'Edit', 'Edit title inline',
   'Edit the title of a meeting directly in the table',
   'Checks that hovering over the title cell and clicking the pencil icon lets you edit the title inline without leaving the list page.',
   'The Meetings list must have at least one existing record.',
   E'1. On the Meetings page, hover your mouse over the title of any meeting in the table\n2. A pencil icon appears — click it\n3. Clear the text and type: Updated Meeting Title\n4. Press Enter or click outside the field to save',
   'The title in the table updates to "Updated Meeting Title" immediately. A success notification briefly appears. No page reload is required.',
   'HIGH', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '3.2', 'Edit', 'Edit date inline',
   'Edit the date of a meeting directly in the table',
   'Checks that clicking the date cell opens a date picker and the new date is saved.',
   'The Meetings list must have at least one existing record.',
   E'1. On the Meetings page, click the date cell of any meeting row\n2. A date input appears — change the date to: 2026-04-08\n3. Press Enter or click outside to save',
   'The date in the table updates to show April 8, 2026. A success notification briefly appears.',
   'HIGH', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '3.3', 'Edit', 'Cancel edit',
   'Pressing Escape cancels an inline edit',
   'Checks that pressing the Escape key while editing a cell discards the change.',
   'The Meetings list must have at least one existing record.',
   E'1. Click the pencil icon on any meeting title to start editing\n2. Type some random text: DO NOT SAVE THIS\n3. Press the Escape key',
   'The cell stops editing and shows the original title. "DO NOT SAVE THIS" does not appear anywhere.',
   'MEDIUM', 'scenario', '/767/meetings'),

  -- ── 4. Delete ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '4.1', 'Delete', 'Delete from row actions',
   'Delete a meeting using the row action menu',
   'Checks that a meeting record can be deleted from the list and disappears afterwards.',
   'Create a meeting named "Delete Me Meeting" before running this scenario.',
   E'1. On the Meetings page, hover over the row for "Delete Me Meeting"\n2. Click the three-dot action menu that appears on the right side of the row\n3. Click "Delete"\n4. Confirm the deletion in the dialog that appears\n5. Wait for the page to stop loading',
   'The record "Delete Me Meeting" is no longer visible in the list. A success message (toast) briefly appears.',
   'HIGH', 'scenario', '/767/meetings'),

  -- ── 5. Filters & Search ────────────────────────────────────────────────────
  ((SELECT id FROM suite), '5.1', 'Filters & Search', 'Search by title',
   'Search for a meeting by its title',
   'Checks that the search box filters the list to only show meetings whose title or participants match the typed text.',
   'The Meetings list must have at least two records with different titles.',
   E'1. On the Meetings page, find the search box in the toolbar (usually shows a magnifying glass or says "Search...")\n2. Type part of a known meeting title, e.g.: Weekly\n3. Wait for the list to filter',
   'The list narrows to show only records whose title or participants contain "Weekly". Records with unrelated titles are hidden. Clearing the search box brings all records back.',
   'HIGH', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '5.2', 'Filters & Search', 'Filter by year',
   'Filter meetings to a specific year',
   'Checks that the Year filter shows only meetings that happened in the chosen year.',
   'At least one meeting must exist with a date set.',
   E'1. Click the Filters button in the toolbar\n2. Find the Year filter\n3. Select the year 2026\n4. Apply or close the filter panel',
   'Only meetings with dates in 2026 appear in the list. Meetings from other years are hidden.',
   'MEDIUM', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '5.3', 'Filters & Search', 'Filter by category',
   'Filter meetings by category',
   'Checks that the Category filter narrows the list to meetings tagged with the chosen category.',
   'At least one meeting must have a Category set.',
   E'1. Click the Filters button\n2. Find the Category filter\n3. Select a category that at least one meeting has (e.g. "Project")\n4. Apply or close the filter panel',
   'Only meetings tagged with the selected category appear. All other meetings are hidden.',
   'MEDIUM', 'scenario', '/767/meetings'),

  -- ── 6. Column Visibility ───────────────────────────────────────────────────
  ((SELECT id FROM suite), '6.1', 'Column Visibility', 'Hide and show columns',
   'Toggle column visibility using the column selector',
   'Checks that clicking the column visibility control lets you hide a column and that it disappears from the table.',
   NULL,
   E'1. On the Meetings page, find the column selector button in the toolbar (looks like columns or an eye icon)\n2. Click it to open the column list\n3. Uncheck "Description" to hide it\n4. Close the selector',
   'The Description column disappears from the table. All other columns still appear correctly. No error messages appear.',
   'LOW', 'scenario', '/767/meetings'),

  -- ── 7. Export ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '7.1', 'Export', 'Export meetings as CSV',
   'Download the meetings list as a spreadsheet',
   'Checks that clicking the export icon downloads a CSV file that can be opened in Excel or Google Sheets.',
   NULL,
   E'1. On the Meetings page, find the export (download) icon in the toolbar\n2. Click it and wait for the download to start',
   'A CSV file downloads. Opening it shows columns for Title, Date, Project, Description, Participants, and other visible columns. Each row matches a meeting in the list.',
   'MEDIUM', 'scenario', '/767/meetings'),

  -- ── 8. Detail Page ─────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '8.1', 'Detail Page', 'Action items visible',
   'Meeting detail page shows action items extracted from the transcript',
   'Checks that when a meeting has a transcript, the action items (tasks someone committed to doing) are displayed on the detail page.',
   'A meeting must exist that was imported with a transcript (source type: Fireflies or uploaded file).',
   E'1. Open the Meetings page\n2. Click on any meeting that has a transcript (look for the transcript icon in the Links column)\n3. On the detail page, look for the "Action Items" or "Tasks" section',
   'The Action Items section shows at least one task extracted from the meeting. Each task has a description. No error messages appear.',
   'HIGH', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '8.2', 'Detail Page', 'Decisions visible',
   'Meeting detail page shows key decisions from the transcript',
   'Checks that decisions captured from the meeting transcript appear on the detail page.',
   'A meeting must exist that was imported with a transcript.',
   E'1. Open any meeting that has a transcript\n2. Find the "Decisions" section on the detail page',
   'The Decisions section shows at least one decision extracted from the meeting. Each decision has a description. No error message appears.',
   'HIGH', 'scenario', '/767/meetings'),

  ((SELECT id FROM suite), '8.3', 'Detail Page', 'Related meetings sidebar',
   'Detail page shows links to other recent meetings for the same project',
   'Checks that a list of related meetings from the same project is shown on the detail page, making it easy to navigate between meetings.',
   'At least two meetings must exist for project 767.',
   E'1. Open any meeting detail page\n2. Look for a "Related Meetings" or "Recent Meetings" panel (usually on the right side or bottom)\n3. Click one of the related meeting links',
   'A list of other meetings for the same project is shown. Clicking a related meeting link navigates to that meeting\'s detail page.',
   'MEDIUM', 'scenario', '/767/meetings'),

  -- ── 9. Edge Cases ──────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '9.1', 'Edge Cases', 'Empty state',
   'Meetings page shows a helpful message when no meetings exist',
   'Checks that a useful empty state — not a blank screen — is shown when there are no meetings on a project.',
   NULL,
   E'1. Navigate to the Meetings page for a project that has no meetings, or apply a search that matches nothing\n2. Look at the main content area',
   'A message appears such as "No meetings found" or similar. A button to create a new meeting may also appear. No blank white space or error message is shown.',
   'MEDIUM', 'scenario', '/767/meetings')

ON CONFLICT (suite_id, test_number) DO UPDATE SET
  test_name       = EXCLUDED.test_name,
  context_note    = EXCLUDED.context_note,
  setup_steps     = EXCLUDED.setup_steps,
  steps           = EXCLUDED.steps,
  expected_result = EXCLUDED.expected_result,
  priority        = EXCLUDED.priority,
  test_type       = EXCLUDED.test_type,
  start_url       = EXCLUDED.start_url,
  category        = EXCLUDED.category,
  subcategory     = EXCLUDED.subcategory,
  updated_at      = now();

-- Update suite total_cases (scenario type only)
UPDATE public.test_suites
   SET total_cases = (
     SELECT count(*) FROM public.test_cases
     WHERE suite_id = test_suites.id AND test_type = 'scenario'
   )
 WHERE tool_name = 'meetings';;
