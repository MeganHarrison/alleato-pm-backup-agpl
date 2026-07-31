-- ============================================================================
-- Seed: Schedule Test Scenarios
-- Generated: 2026-04-08
-- Suite: schedule
-- Type: scenario (plain-English guided tests for non-technical testers)
-- Runner: http://localhost:3000/testing
-- 13 scenarios across 7 categories
-- ============================================================================

-- Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('schedule', 'Schedule', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Insert all scenarios
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'schedule')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

  -- ── 1. Navigation ──────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the Schedule page',
   'Checks that the Schedule page loads without errors and shows the task list. A schedule is a list of work tasks with start and end dates, arranged to show what needs to happen and when.',
   NULL,
   E'1. Make sure you are logged in as test1@mail.com\n2. In the left sidebar, click "Schedule" under project "Alleato AI"\n3. Wait for the page to stop loading',
   'The page loads fully. A list of tasks is visible, or an empty state message appears. The page title says "Schedule". No error messages appear.',
   'HIGH', 'scenario', '/767/schedule'),

  ((SELECT id FROM suite), '1.2', 'Navigation', 'View switching',
   'Switch between all five view modes',
   'Checks that the five views — Gantt, Table, Board, Timeline, Calendar — each load without errors. Each view shows the same tasks in a different layout.',
   NULL,
   E'1. Open the Schedule page at /767/schedule\n2. Click the "Table" tab at the top\n3. Wait for the view to load\n4. Click the "Board" tab\n5. Wait for the view to load\n6. Click the "Timeline" tab\n7. Wait for the view to load\n8. Click the "Calendar" tab\n9. Wait for the view to load\n10. Click the "Gantt" tab to return to the default',
   'Each view loads without errors. Tasks appear in all views. The active tab is visually highlighted. No error messages appear in any view.',
   'HIGH', 'scenario', '/767/schedule'),

  -- ── 2. Create ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '2.1', 'Create', 'Basic task creation',
   'Create a new task with a name and dates',
   'Checks that a user can create a new schedule task — a unit of work with a start date and end date — and that it appears in the task list after saving.',
   NULL,
   E'1. Open the Schedule page\n2. Click the "Add Task" button (top right)\n3. In the Name field, type: Install Drywall\n4. In the Start Date field, type or select: 2026-05-01\n5. In the Finish Date field, type or select: 2026-05-15\n6. Click the Save button\n7. Wait for the page to stop loading',
   'The task "Install Drywall" appears in the list. Its start date shows 2026-05-01 and finish date shows 2026-05-15. A success message (toast) briefly appears. No error messages are shown.',
   'HIGH', 'scenario', '/767/schedule'),

  ((SELECT id FROM suite), '2.2', 'Create', 'Validation',
   'Try to create a task without a name',
   'Checks that the form prevents saving when the required Name field is left blank, so unnamed tasks cannot be accidentally created.',
   NULL,
   E'1. Open the Schedule page\n2. Click "Add Task"\n3. Leave the Name field completely blank\n4. Click the Save button',
   'An error message appears near the Name field saying the name is required. The task is NOT created. The form stays open.',
   'HIGH', 'scenario', '/767/schedule'),

  ((SELECT id FROM suite), '2.3', 'Create', 'Milestone',
   'Create a milestone',
   'Checks that a milestone — a zero-duration target date (like "Foundation complete by June 1") — can be created and is visually distinct from regular tasks.',
   NULL,
   E'1. Open the Schedule page\n2. Click "Add Task"\n3. In the Name field, type: Foundation Complete\n4. Check the "Milestone" checkbox or toggle (if visible in the form)\n5. Set Date to: 2026-06-01\n6. Click Save',
   'The milestone "Foundation Complete" appears in the task list. It is visually different from regular tasks (e.g. a diamond icon, or labeled as milestone). No error appears.',
   'MEDIUM', 'scenario', '/767/schedule'),

  -- ── 3. Edit ────────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '3.1', 'Edit', 'Edit task dates',
   'Change a task start and finish date',
   'Checks that editing a task and changing its dates saves correctly and the new dates appear after refreshing.',
   'There must be at least one task in the schedule.',
   E'1. Open the Schedule page\n2. Click on any task name to open the edit modal\n3. Change the Start Date to: 2026-06-10\n4. Change the Finish Date to: 2026-06-20\n5. Click Save\n6. Press Ctrl+R (or Cmd+R on Mac) to refresh the page',
   'After refreshing, the task shows Start Date 2026-06-10 and Finish Date 2026-06-20. The updated dates are persisted — they do not revert to the old values.',
   'HIGH', 'scenario', '/767/schedule'),

  ((SELECT id FROM suite), '3.2', 'Edit', 'Edit task name',
   'Rename an existing task',
   'Checks that a task name can be updated and the new name appears everywhere in the schedule.',
   'There must be at least one task in the schedule.',
   E'1. Open the Schedule page\n2. Click on any task to open its edit modal\n3. Clear the Name field and type: Renamed Task Test\n4. Click Save',
   'The task list shows "Renamed Task Test" in place of the old name. A success toast appears. The old name is no longer visible.',
   'HIGH', 'scenario', '/767/schedule'),

  ((SELECT id FROM suite), '3.3', 'Edit', 'Status update',
   'Change a task status to In Progress',
   'Checks that a task status can be updated. Status tracks whether a task has not started yet, is currently being worked on, or is finished.',
   'There must be at least one task with status Not Started.',
   E'1. Open the Schedule page\n2. Click on a task with status "Not Started"\n3. In the edit modal, find the Status dropdown and select "In Progress"\n4. Click Save',
   'The task now shows status "In Progress" in the list. If there is a Board view, the task card has moved to the "In Progress" column.',
   'HIGH', 'scenario', '/767/schedule'),

  -- ── 4. Delete ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '4.1', 'Delete', 'Single task delete',
   'Delete a task and confirm it is removed',
   'Checks that a task can be permanently deleted and disappears from the schedule.',
   'Create a task named "Delete Me Task" before running this test.',
   E'1. Open the Schedule page\n2. Find the task named "Delete Me Task" in the list\n3. Right-click the task row (or click the three-dot context menu on the row)\n4. Click "Delete"\n5. Confirm the deletion if a dialog appears\n6. Wait for the page to update',
   'The task "Delete Me Task" is no longer visible in any view. A success toast briefly appears. No error messages are shown.',
   'HIGH', 'scenario', '/767/schedule'),

  ((SELECT id FROM suite), '4.2', 'Delete', 'Bulk delete',
   'Select multiple tasks and delete them all at once',
   'Checks that the bulk delete feature works — useful when you need to remove several tasks in one action.',
   'Create at least two tasks named "Bulk Delete A" and "Bulk Delete B" before running this test.',
   E'1. Open the Schedule page\n2. Check the checkbox on the row for "Bulk Delete A"\n3. Check the checkbox on the row for "Bulk Delete B"\n4. A bulk action bar should appear — click "Delete"\n5. Confirm the deletion',
   'Both tasks disappear from the list. The success message mentions 2 tasks deleted. No error messages appear.',
   'HIGH', 'scenario', '/767/schedule'),

  -- ── 5. Hierarchy ───────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '5.1', 'Hierarchy', 'Sub-task (indent)',
   'Create a sub-task under a parent task',
   'Checks that tasks can be nested — for example, "Frame Walls" and "Hang Drywall" could be sub-tasks under a parent task called "Framing Phase". Nesting helps organize work into phases.',
   'There must be at least one parent task in the schedule.',
   E'1. Open the Schedule page (Gantt or Table view)\n2. Right-click on any task to open the context menu\n3. Click "Add Sub-task" or "Indent"\n4. If a sub-task is added, click on it and name it: Sub-Task Test\n5. Click Save',
   'The new task "Sub-Task Test" appears indented below the parent task in the list. The parent task shows an expand/collapse arrow.',
   'MEDIUM', 'scenario', '/767/schedule'),

  -- ── 6. Filters & Search ────────────────────────────────────────────────────
  ((SELECT id FROM suite), '6.1', 'Filters & Search', 'Search by name',
   'Search for a task by its name',
   'Checks that the search box filters the task list to show only matching tasks.',
   'There must be at least two tasks with different names in the schedule.',
   E'1. Open the Schedule page\n2. Click the search box in the toolbar (shows a magnifying glass icon or "Search tasks...")\n3. Type: Install\n4. Wait for the list to filter',
   'Only tasks whose name contains "Install" are shown. Tasks with unrelated names disappear. Clearing the search box brings all tasks back.',
   'HIGH', 'scenario', '/767/schedule'),

  ((SELECT id FROM suite), '6.2', 'Filters & Search', 'Filter by status',
   'Filter the task list to show only In Progress tasks',
   'Checks that the status filter narrows the list to tasks in a specific stage of work.',
   'There must be at least one task with status "In Progress" and one with a different status.',
   E'1. Open the Schedule page\n2. Click the Filters button in the toolbar\n3. Find the Status filter and select "In Progress"\n4. Apply the filter',
   'Only tasks with status "In Progress" are shown. Tasks with other statuses are hidden. Clearing the filter brings all tasks back.',
   'MEDIUM', 'scenario', '/767/schedule')

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
 WHERE tool_name = 'schedule';
