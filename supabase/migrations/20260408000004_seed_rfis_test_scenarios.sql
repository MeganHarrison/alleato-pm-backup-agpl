-- Migration: Seed RFIs test scenarios
-- Generated: 2026-04-08
-- Tool: rfis / RFIs

-- Upsert the test suite
INSERT INTO test_suites (id, tool_name, display_name, source_doc_count, total_cases, created_at, last_generated_at)
VALUES (
  gen_random_uuid(),
  'rfis',
  'RFIs',
  3,
  0,
  now(),
  now()
)
ON CONFLICT (tool_name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      last_generated_at = now();
-- Remove existing cases for a clean re-seed
DELETE FROM test_cases
WHERE suite_id = (SELECT id FROM test_suites WHERE tool_name = 'rfis');
-- Insert scenarios
INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
SELECT
  gen_random_uuid(),
  s.id,
  v.test_number,
  v.category,
  v.subcategory,
  v.test_name,
  v.steps,
  v.expected_result,
  v.priority,
  'scenario',
  '/767/rfis',
  v.context_note,
  v.setup_steps,
  now(),
  now()
FROM test_suites s,
(VALUES

  -- 1. Navigation
  ('1.1', 'Navigation', NULL,
   'Open the RFIs page',
   E'1. Make sure you are logged in as test1@mail.com\n2. Navigate to http://localhost:3000/767/rfis\n3. Wait for the page to stop loading',
   'The page loads fully. A table of RFIs is visible with columns for Number, Status, Subject, Assignees, RFI Manager, Ball In Court, and Due Date. No error messages appear.',
   'HIGH',
   'Checks that the RFIs list page loads without errors and shows existing records.',
   NULL),

  ('1.2', 'Navigation', NULL,
   'Open an RFI detail page',
   E'1. Open the RFIs page at /767/rfis\n2. Click on the Subject of any RFI in the list\n3. Wait for the page to finish loading',
   'The detail page opens. The RFI number and subject appear at the top. Sections visible include: Question, General Information sidebar, Responses, and Actions. No error messages appear.',
   'HIGH',
   'Checks that clicking a record opens the detail page with all sections visible.',
   'The RFIs list must have at least one existing record.'),

  -- 2. Create
  ('2.1', 'Create', NULL,
   'Create a new RFI with required fields only',
   E'1. Open the RFIs page at /767/rfis\n2. Click the **Create RFI** button (top right)\n3. In the **Subject** field, type: **What is the ceiling height in Room 101?**\n4. Click **Create** (or Save)\n5. Wait for the page to stop loading',
   'The new RFI appears in the list with the subject "What is the ceiling height in Room 101?". It is automatically assigned an RFI number (e.g. #1, #2). No error messages appear.',
   'HIGH',
   'Checks that a user can create an RFI with only the subject filled in.',
   NULL),

  ('2.2', 'Create', NULL,
   'Try to create an RFI without a subject',
   E'1. Open the RFIs page at /767/rfis\n2. Click the **Create RFI** button\n3. Leave the **Subject** field completely empty\n4. Click **Create** (or Save)',
   'An error message appears near the Subject field (e.g. "Subject is required"). The record is NOT created. The form stays open.',
   'HIGH',
   'Checks that the form prevents saving when the required Subject field is empty.',
   NULL),

  ('2.3', 'Create', NULL,
   'Create an RFI with all optional fields filled',
   E'1. Open the RFIs page at /767/rfis\n2. Click **Create RFI**\n3. In **Subject**, type: **Confirm footing depth at column B-4**\n4. In **Question**, type: **Drawings show 36" depth but geotech report says 42". Which takes precedence?**\n5. Set **Due Date** to a date one week from today\n6. In **RFI Manager**, type: **John Smith**\n7. In **Assignees**, type: **Jane Doe**\n8. In **Location**, type: **Level 1 - Column B-4**\n9. Click **Create** and wait for the page to stop loading\n10. Find the new RFI in the list and click it to open',
   'The detail page shows all entered values: subject, question, due date, RFI manager, assignees, and location. All fields saved correctly.',
   'MEDIUM',
   'Checks that all optional fields on the create form can be set and are saved correctly.',
   NULL),

  ('2.4', 'Create', NULL,
   'Verify RFI number auto-increments',
   E'1. Open the RFIs page at /767/rfis and note the highest RFI number shown in the list\n2. Click **Create RFI**\n3. Type any subject, e.g. **Auto-number test**\n4. Click **Create** and wait for the page to stop loading',
   'The new RFI is assigned the next sequential number (one higher than the previous highest). For example, if the list showed #5 as the highest, the new RFI is #6.',
   'HIGH',
   'Checks that RFIs are automatically numbered in sequence.',
   NULL),

  -- 3. Edit
  ('3.1', 'Edit', NULL,
   'Edit the subject of an existing RFI',
   E'1. Open the RFIs page at /767/rfis\n2. Click on any RFI to open its detail page\n3. Click the **Edit** button\n4. Clear the **Subject** field and type: **Updated Subject Test**\n5. Click **Save Changes**\n6. Wait for the page to stop loading',
   'The detail page now shows the subject "Updated Subject Test". A success message (toast) briefly appears. The old subject is no longer visible.',
   'HIGH',
   'Checks that users can edit an RFI and the updated value is saved.',
   'There must be at least one existing RFI.'),

  ('3.2', 'Edit', NULL,
   'Edits persist after page refresh',
   E'1. Complete scenario 3.1 (edit a subject and save it)\n2. After saving, stay on the detail page\n3. Press **Ctrl+R** (or Cmd+R on Mac) to refresh the page\n4. Wait for the page to load',
   'The updated subject and any other saved changes are still shown after the refresh. No data reverted to the old values.',
   'HIGH',
   'Checks that saved edits are stored in the database, not just shown temporarily.',
   'Complete scenario 3.1 first.'),

  ('3.3', 'Edit', NULL,
   'Cancel discards changes',
   E'1. Open any RFI detail page\n2. Click the **Edit** button\n3. Change the Subject to **DO NOT SAVE THIS**\n4. Click **Cancel** (instead of Save Changes)',
   'The form closes and the original subject is still shown. "DO NOT SAVE THIS" does not appear anywhere on the page.',
   'MEDIUM',
   'Checks that unsaved edits are discarded when the user cancels the form.',
   'There must be at least one existing RFI.'),

  -- 4. Status Workflow
  ('4.1', 'Status', NULL,
   'Open an RFI (move from Draft to Open)',
   E'1. Create a new RFI (it will be in Draft status by default)\n2. Open that RFI''s detail page\n3. In the **Actions** section, click **Open RFI**\n4. Wait for the page to stop loading',
   'The status badge at the top of the page changes from "Draft" to "Open". The "Open RFI" button is no longer visible. A "Close RFI" button appears instead.',
   'HIGH',
   'Checks that an RFI can be moved from Draft to Open status.',
   'Create a new RFI first so it starts in Draft status.'),

  ('4.2', 'Status', NULL,
   'Close an open RFI',
   E'1. Open an RFI that has status **Open**\n2. In the **Actions** section, click **Close RFI**\n3. Wait for the page to stop loading',
   'The status badge changes to "Closed". The "Close RFI" button is replaced by a "Reopen RFI" button.',
   'HIGH',
   'Checks that an open RFI can be closed once a response has been provided.',
   'There must be at least one RFI with status Open.'),

  ('4.3', 'Status', NULL,
   'Reopen a closed RFI',
   E'1. Open an RFI that has status **Closed**\n2. In the **Actions** section, click **Reopen RFI**\n3. Wait for the page to stop loading',
   'The status badge changes back to "Open". The "Close RFI" button reappears.',
   'MEDIUM',
   'Checks that a closed RFI can be reopened if the answer was insufficient.',
   'There must be at least one RFI with status Closed. Complete scenario 4.2 first if needed.'),

  -- 5. Due Date
  ('5.1', 'Due Dates', NULL,
   'Set a due date on an RFI',
   E'1. Open any RFI detail page\n2. Click **Edit**\n3. In the **Due Date** field, type or select a date two weeks from today (e.g. 2026-04-22)\n4. Click **Save Changes**\n5. Wait for the page to stop loading',
   'The General Information sidebar shows the due date you entered (e.g. "Apr 22, 2026"). No error message appears.',
   'MEDIUM',
   'Checks that a due date can be set on an RFI and is displayed correctly.',
   'There must be at least one existing RFI.'),

  -- 6. Filter / Search
  ('6.1', 'Filter / Search', NULL,
   'Search for an RFI by subject',
   E'1. Open the RFIs page at /767/rfis\n2. Click the search box (shows "Search RFIs..." placeholder)\n3. Type part of a known RFI subject, e.g. **ceiling height**\n4. Wait for the list to filter',
   'The list narrows to show only RFIs whose subject contains "ceiling height". RFIs with unrelated subjects are no longer visible. Clearing the search box brings all records back.',
   'MEDIUM',
   'Checks that the search box filters the list to matching records.',
   'The RFIs list must have at least two records with different subjects.'),

  ('6.2', 'Filter / Search', NULL,
   'Filter RFIs by status',
   E'1. Open the RFIs page at /767/rfis\n2. Click the **Filters** button in the toolbar\n3. In the **Status** filter dropdown, select **Open**\n4. Wait for the list to update',
   'The list shows only RFIs with status "Open". RFIs with status Draft or Closed are hidden. Clearing the filter restores all records.',
   'MEDIUM',
   'Checks that the Status filter correctly limits the displayed records.',
   'The RFIs list must have records with at least two different statuses.'),

  -- 7. Delete
  ('7.1', 'Delete', NULL,
   'Delete an RFI',
   E'1. Create an RFI named **Delete Me RFI Test** (or identify one to delete)\n2. Open the RFIs page at /767/rfis\n3. Find the record titled **Delete Me RFI Test** in the list\n4. Click the three-dot menu on that row and click **Delete** (or open the detail page and click the red Delete button)\n5. Confirm the deletion in the dialog that appears\n6. Wait for the page to stop loading',
   'The record "Delete Me RFI Test" is no longer visible in the list. A success message (toast) briefly appears.',
   'HIGH',
   'Checks that an RFI can be deleted and disappears from the list.',
   'Create an RFI named "Delete Me RFI Test" before running this scenario.'),

  -- 8. Impact Fields
  ('8.1', 'Impact Fields', NULL,
   'Set schedule impact and cost impact on an RFI',
   E'1. Open any RFI detail page\n2. Click **Edit**\n3. In the **Schedule Impact** dropdown, select **Yes**\n4. In the **Cost Impact** dropdown, select **Yes**\n5. Click **Save Changes**\n6. Wait for the page to stop loading',
   'The General Information sidebar shows Schedule Impact = "Yes" and Cost Impact = "Yes". Both values are saved and visible after the save.',
   'MEDIUM',
   'Checks that the schedule and cost impact fields can be set and are saved correctly.',
   'There must be at least one existing RFI.'),

  -- 9. Privacy
  ('9.1', 'Privacy', NULL,
   'Mark an RFI as private',
   E'1. Open any RFI detail page\n2. Click **Edit**\n3. Check the **Private** checkbox\n4. Click **Save Changes**\n5. Wait for the page to stop loading',
   'A "Private" badge appears next to the status badge at the top of the detail page. The checkbox remains checked. No error message appears.',
   'LOW',
   'Checks that an RFI can be marked private and the badge appears correctly.',
   'There must be at least one existing RFI.'),

  -- 10. Views
  ('10.1', 'Views', NULL,
   'Switch between table, card, and list views',
   E'1. Open the RFIs page at /767/rfis\n2. Look for the view toggle buttons in the toolbar (table icon, card icon, list icon)\n3. Click the **Card** view icon\n4. Then click the **List** view icon\n5. Then click the **Table** view icon',
   'Each click switches the display format: Card view shows records as cards, List view shows a condensed list, Table view shows the default grid. Records are visible in all three views with no errors.',
   'MEDIUM',
   'Checks that the three view modes (table, card, list) all work correctly.',
   NULL)

) AS v(test_number, category, subcategory, test_name, steps, expected_result, priority, context_note, setup_steps)
WHERE s.tool_name = 'rfis';
-- Update total_cases
UPDATE test_suites
SET total_cases = (SELECT COUNT(*) FROM test_cases WHERE suite_id = test_suites.id)
WHERE tool_name = 'rfis';
