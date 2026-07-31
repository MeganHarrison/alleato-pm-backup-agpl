-- Seed: Daily Log test scenarios
-- Generated: 2026-04-08
-- Suite ID: f1fd4938-d73d-4042-95dc-14eb983b0e7f

-- Upsert the test suite
INSERT INTO test_suites (id, tool_name, display_name, total_cases, created_at, last_generated_at)
VALUES (
  'f1fd4938-d73d-4042-95dc-14eb983b0e7f',
  'daily-log',
  'Daily Log',
  0,
  now(),
  now()
)
ON CONFLICT (tool_name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      last_generated_at = now();
-- Insert test cases
INSERT INTO test_cases (id, suite_id, test_number, category, test_name, steps, expected_result, priority, start_url, context_note, setup_steps)
VALUES
  -- 1. Navigation
  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '1.1', 'Navigation', 'Open the Daily Log page',
   '1. Make sure you are logged in as test1@mail.com\n2. Click "Daily Log" in the left sidebar of the project\n3. Wait for the page to stop loading',
   'The page loads fully. A table of daily log entries is visible with columns for Date, Weather, and Created By. No error messages appear.',
   'HIGH', '/767/daily-log', NULL, NULL),

  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '1.2', 'Navigation', 'Open a daily log detail page',
   '1. Open the Daily Log page\n2. Click on the date of any log entry in the list\n3. Wait for the page to finish loading',
   'The detail page opens showing the log entry data. No error messages appear.',
   'HIGH', '/767/daily-log', NULL, 'The Daily Log list must have at least one existing entry.'),

  -- 2. Create
  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '2.1', 'Create', 'Create a new log entry for today',
   '1. Open the Daily Log page\n2. Click the "New Log Entry" button (top right)\n3. In the Date field, enter: 2026-04-08\n4. In the Weather field, type: Sunny, 68°F, light breeze\n5. Click Create (or Save)\n6. Wait for the page to stop loading',
   'The new log entry appears in the list with the date "Apr 8, 2026". No error messages are shown.',
   'HIGH', '/767/daily-log', NULL, NULL),

  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '2.2', 'Create', 'Try to create a log entry without a date',
   '1. Open the Daily Log page\n2. Click the "New Log Entry" button\n3. Leave the Date field completely empty\n4. Click Create (or Save)',
   'An error message appears near the Date field (e.g. "Date is required"). The record is NOT created. The form stays open.',
   'HIGH', '/767/daily-log', NULL, NULL),

  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '2.3', 'Create', 'Create a log entry with notes',
   '1. Open the Daily Log page\n2. Click the "New Log Entry" button\n3. Enter date: 2026-04-08\n4. In the Weather field, type: Overcast, 55°F\n5. In the Notes/Description field, type: Concrete poured for foundation\n6. Click Create and wait for the page to stop loading',
   'The new log entry appears in the list for Apr 8, 2026. No error message appears.',
   'MEDIUM', '/767/daily-log', NULL, NULL),

  -- 3. Edit
  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '3.1', 'Edit', 'Edit the weather on an existing log entry',
   '1. Open the Daily Log page\n2. Click on any log entry to open it\n3. Click the Edit button\n4. Clear the Weather field and type: Partly cloudy, 72°F\n5. Click Save\n6. Wait for the page to stop loading',
   'The log entry now shows the updated weather "Partly cloudy, 72°F". A success message (toast) briefly appears.',
   'HIGH', '/767/daily-log', NULL, 'There must be at least one existing daily log entry.'),

  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '3.2', 'Edit', 'Edited changes persist after page refresh',
   '1. After saving an edit (complete scenario 3.1 first), stay on the detail page\n2. Press Ctrl+R (or Cmd+R on Mac) to refresh the page\n3. Wait for the page to load',
   'The updated weather and any other changes are still shown after the refresh. No data reverted to old values.',
   'HIGH', '/767/daily-log', NULL, 'Complete scenario 3.1 first.'),

  -- 4. Manpower
  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '4.1', 'Manpower', 'Add a manpower entry (worker count) to a log',
   '1. Open any daily log detail page\n2. Find the Manpower section (workers on site)\n3. Click Add Manpower (or the + button)\n4. In the Trade field, type: Concrete\n5. In the Workers field, type: 8\n6. In the Hours Worked field, type: 9\n7. Click Save',
   'A new manpower row appears showing Trade = Concrete, Workers = 8, Hours = 9. No error message appears.',
   'HIGH', '/767/daily-log',
   'Manpower = the number of workers from a specific trade on site that day. A trade is a type of construction worker, e.g. Electrician, Plumber, Carpenter.',
   'There must be at least one existing daily log entry.'),

  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '4.2', 'Manpower', 'Try to add manpower without a worker count',
   '1. Open any daily log detail page\n2. Click Add Manpower\n3. Fill in the Trade field: Electrician\n4. Leave the Workers Count field empty\n5. Click Save',
   'An error message appears (e.g. "Workers count is required"). The manpower entry is NOT saved.',
   'MEDIUM', '/767/daily-log', NULL, 'There must be at least one existing daily log entry.'),

  -- 5. Equipment
  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '5.1', 'Equipment', 'Add equipment used on site',
   '1. Open any daily log detail page\n2. Find the Equipment section\n3. Click Add Equipment (or the + button)\n4. In the Equipment Name field, type: Excavator CAT 320\n5. In the Hours Operated field, type: 7\n6. Click Save',
   'A new equipment row appears showing Equipment = Excavator CAT 320, Hours Operated = 7. No error message appears.',
   'HIGH', '/767/daily-log',
   'Equipment = large machinery used on the construction site that day, such as cranes, excavators, or forklifts.',
   'There must be at least one existing daily log entry.'),

  -- 6. Notes
  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '6.1', 'Notes', 'Add a work note to a log entry',
   '1. Open any daily log detail page\n2. Find the Notes section\n3. Click Add Note (or the + button)\n4. In the Category field, select or type: Work Performed\n5. In the Description field, type: Concrete poured for foundation\n6. Click Save',
   'The note "Concrete poured for foundation" appears in the notes list under category "Work Performed". No error message appears.',
   'HIGH', '/767/daily-log', NULL, 'There must be at least one existing daily log entry.'),

  -- 7. Delete
  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '7.1', 'Delete', 'Delete a daily log entry',
   '1. Open the Daily Log page\n2. Find a log entry you created for testing (e.g. the one from scenario 2.1)\n3. Click the three-dot menu (or right-click) on that row\n4. Click Delete\n5. Confirm the deletion in the dialog that appears\n6. Wait for the page to stop loading',
   'The deleted log entry is no longer visible in the list. A success message (toast) briefly appears.',
   'HIGH', '/767/daily-log', NULL, 'Create a log entry for testing purposes before running this scenario.'),

  -- 8. Filter / Search / Sort
  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '8.1', 'Filter / Search', 'Search for a log entry by date',
   '1. Open the Daily Log page\n2. Click the search box (shows a magnifying glass icon or says "Search by date or author...")\n3. Type: 2026-04-08\n4. Wait for the list to filter',
   'The list narrows to show only entries matching the date "2026-04-08". Unrelated entries are no longer visible. Clearing the search box brings all records back.',
   'MEDIUM', '/767/daily-log', NULL, 'The Daily Log list must have at least two entries with different dates.'),

  (gen_random_uuid(), 'f1fd4938-d73d-4042-95dc-14eb983b0e7f', '8.2', 'Filter / Search', 'Sort log entries by date (oldest first)',
   '1. Open the Daily Log page\n2. Click the "Date" column header once to sort ascending (oldest first)\n3. Observe the order of entries in the list',
   'Log entries are reordered so the oldest date appears at the top and the newest date appears at the bottom.',
   'MEDIUM', '/767/daily-log', NULL, 'The Daily Log list must have at least two entries with different dates.')

ON CONFLICT DO NOTHING;
-- Update total_cases count
UPDATE test_suites
SET total_cases = (SELECT COUNT(*) FROM test_cases WHERE suite_id = 'f1fd4938-d73d-4042-95dc-14eb983b0e7f')
WHERE id = 'f1fd4938-d73d-4042-95dc-14eb983b0e7f';
