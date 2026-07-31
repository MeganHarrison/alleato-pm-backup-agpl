-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Seed Submittals test scenarios
-- Generated: 2026-04-08
-- ─────────────────────────────────────────────────────────────────────────────

-- Upsert the test suite
INSERT INTO test_suites (tool_name, display_name, total_cases, last_generated_at)
VALUES ('submittals', 'Submittals', 0, now())
ON CONFLICT (tool_name) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      last_generated_at = now();
DO $$
DECLARE
  v_suite_id uuid;
BEGIN
  SELECT id INTO v_suite_id FROM test_suites WHERE tool_name = 'submittals';

  -- Remove existing cases for clean re-seed
  DELETE FROM test_cases WHERE suite_id = v_suite_id;

  -- ── 1. Navigation ────────────────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '1.1', 'Navigation',
    'Open the Submittals page',
    'HIGH', '/767/submittals',
    'Checks that the Submittals list page loads without errors and shows existing records.',
    NULL,
    E'1. Make sure you are logged in as test1@mail.com\n2. Navigate to http://localhost:3000/767/submittals\n3. Wait for the page to stop loading',
    'The page loads fully. A table of submittals is visible with columns for Number, Title, Status, Type, Division, and Due Date. No error messages appear.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '1.2', 'Navigation',
    'Open a submittal detail page',
    'HIGH', '/767/submittals',
    'Checks that clicking a record opens the detail view with all tabs visible.',
    'The Submittals list must have at least one existing record.',
    E'1. Open the Submittals page (/767/submittals)\n2. Click on the title of any submittal in the list\n3. Wait for the page to finish loading',
    'The detail page opens. Tabs are visible (General, Workflow, Distributions, Attachments, History). The submittal title, number, and status are shown at the top. No error messages appear.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '1.3', 'Navigation',
    'View the Ball In Court tab',
    'MEDIUM', '/767/submittals',
    'The "Ball In Court" tab filters the list to submittals currently awaiting action from a specific person or team.',
    'At least one submittal must have a Ball In Court value filled in (e.g. "Architect").',
    E'1. Open the Submittals page (/767/submittals)\n2. Click the **Ball In Court** tab at the top of the table\n3. Wait for the list to update',
    'Only submittals that have a Ball In Court value are displayed. Submittals with no Ball In Court value are hidden. No error message appears.'
  );

  -- ── 2. Create ─────────────────────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '2.1', 'Create',
    'Create a new submittal with required fields',
    'HIGH', '/767/submittals',
    'Checks that a user can create a submittal and it appears in the list.',
    NULL,
    E'1. Open the Submittals page (/767/submittals)\n2. Click the **Add Submittal** button (top right)\n3. In the **Number** field, type: **TEST-001**\n4. In the **Title** field, type: **Concrete Mix Design**\n5. Leave Status as **Draft**\n6. Click **Create Submittal**\n7. Wait for the dialog to close',
    'The new submittal "Concrete Mix Design" appears in the list with number TEST-001 and status Draft. No error messages are shown.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '2.2', 'Create',
    'Create fails when Title is empty',
    'HIGH', '/767/submittals',
    'Checks that the form blocks saving when the required Title field is blank.',
    NULL,
    E'1. Open the Submittals page\n2. Click **Add Submittal**\n3. Fill in **Number**: **TEST-VAL-001**\n4. Leave the **Title** field completely empty\n5. Click **Create Submittal**',
    'An error message appears near the Title field saying "Title is required". The submittal is NOT created. The dialog stays open.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '2.3', 'Create',
    'Create fails when Number is empty',
    'HIGH', '/767/submittals',
    'Checks that the form blocks saving when the required Number field is blank.',
    NULL,
    E'1. Open the Submittals page\n2. Click **Add Submittal**\n3. Leave the **Number** field completely empty\n4. Type **Doors and Hardware** in the **Title** field\n5. Click **Create Submittal**',
    'An error message appears near the Number field saying "Number is required". The submittal is NOT created. The dialog stays open.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '2.4', 'Create',
    'Create fails when submittal number already exists',
    'MEDIUM', '/767/submittals',
    'Checks that the system prevents duplicate submittal numbers within the same project.',
    'There must already be a submittal with number TEST-001 (created in scenario 2.1).',
    E'1. Open the Submittals page\n2. Click **Add Submittal**\n3. In **Number**, type: **TEST-001** (same as the one created in scenario 2.1)\n4. In **Title**, type: **Duplicate Number Test**\n5. Click **Create Submittal**',
    'An error message appears saying the submittal number already exists for this project. The submittal is NOT created.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '2.5', 'Create',
    'Create a submittal with all optional fields filled',
    'MEDIUM', '/767/submittals',
    'Checks that all form fields (type, division, spec section, due date, lead time, ball in court, description) can be saved correctly.',
    NULL,
    E'1. Open the Submittals page\n2. Click **Add Submittal**\n3. Enter **Number**: **TEST-FULL-001**\n4. Enter **Title**: **Steel Reinforcing Shop Drawings**\n5. Enter **Specification Section**: **03-2000 - Concrete Reinforcing**\n6. Enter **Division**: **Division 3**\n7. Enter **Submittal Type**: **Shop Drawing**\n8. Set **Status**: **Open**\n9. Set **Final Due Date**: **2026-06-01**\n10. Enter **Lead Time (days)**: **14**\n11. Enter **Ball In Court**: **Structural Engineer**\n12. Enter **Description**: **Shop drawings for all reinforcing steel per structural drawings.**\n13. Click **Create Submittal**\n14. Find "Steel Reinforcing Shop Drawings" in the list and click to open',
    'The detail page shows all saved values: Spec Section = 03-2000 - Concrete Reinforcing, Division = Division 3, Type = Shop Drawing, Status = Open, Due Date = 6/1/2026, Lead Time = 14, Ball In Court = Structural Engineer. No fields are blank or reverted.'
  );

  -- ── 3. Edit ───────────────────────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '3.1', 'Edit',
    'Edit the title of an existing submittal',
    'HIGH', '/767/submittals',
    'Checks that users can update a submittal and the new value is saved.',
    'There must be at least one existing submittal.',
    E'1. Open the Submittals page\n2. Click any submittal to open its detail page\n3. Click the **Edit** button (pencil icon, top right)\n4. Clear the Title field and type: **Updated Submittal Title Test**\n5. Click **Update Submittal**\n6. Wait for the dialog to close',
    'The detail page now shows the title "Updated Submittal Title Test". A success message (toast) briefly appears. The old title is no longer visible.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '3.2', 'Edit',
    'Edits persist after page refresh',
    'HIGH', '/767/submittals',
    'Checks that saved changes are stored in the database, not just shown temporarily in the browser.',
    'Complete scenario 3.1 first.',
    E'1. After saving an edit (from scenario 3.1), stay on the detail page\n2. Press **Ctrl+R** (or Cmd+R on Mac) to refresh the page\n3. Wait for the page to reload',
    'The updated title and any other changes are still shown after the refresh. No data reverted to the old values.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '3.3', 'Edit',
    'Cancel discards unsaved edits',
    'MEDIUM', '/767/submittals',
    'Checks that clicking Cancel does not save any changes.',
    'There must be at least one existing submittal.',
    E'1. Open any submittal detail page\n2. Click the **Edit** button\n3. Change the Title to something random: **DO NOT SAVE THIS**\n4. Click **Cancel** (instead of Update Submittal)',
    'The dialog closes and the original title is still shown. "DO NOT SAVE THIS" does not appear anywhere on the page.'
  );

  -- ── 4. Status Workflow ────────────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '4.1', 'Status',
    'Change status from Draft to Open',
    'HIGH', '/767/submittals',
    'Checks that the status workflow moves forward from Draft to Open.',
    'There must be at least one submittal with status Draft.',
    E'1. Open any submittal with status **Draft**\n2. Click the **Edit** button\n3. In the **Status** dropdown, select **Open**\n4. Click **Update Submittal**\n5. Wait for the dialog to close',
    'The status badge on the detail page now shows "Open". No error message appears.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '4.2', 'Status',
    'Change status to Distributed',
    'MEDIUM', '/767/submittals',
    'Checks that a submittal can be marked as Distributed, meaning it has been sent to the architect or engineer for review.',
    'There must be at least one submittal with status Open.',
    E'1. Open a submittal with status **Open**\n2. Click the **Edit** button\n3. In the **Status** dropdown, select **Distributed**\n4. Click **Update Submittal**\n5. Wait for the dialog to close',
    'The status badge now shows "Distributed". No error message appears.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '4.3', 'Status',
    'Close a submittal',
    'MEDIUM', '/767/submittals',
    'Checks that a submittal can be fully closed once the review process is complete.',
    'There must be at least one submittal with status Distributed.',
    E'1. Open a submittal with status **Distributed**\n2. Click the **Edit** button\n3. In the **Status** dropdown, select **Closed**\n4. Click **Update Submittal**\n5. Wait for the dialog to close',
    'The status badge now shows "Closed". No error message appears. The submittal still appears in the main list (it is not deleted).'
  );

  -- ── 5. Attachments ────────────────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '5.1', 'Attachments',
    'Upload a file attachment',
    'MEDIUM', '/767/submittals',
    'Checks that a file can be attached to a submittal and is visible afterwards.',
    'Have a small file ready to upload (any image or PDF, under 5 MB). There must be at least one existing submittal.',
    E'1. Open any submittal detail page\n2. Click the **Attachments** tab\n3. Click **Upload** or drag a file onto the upload area\n4. Select a small file from your computer\n5. Wait for the upload to complete',
    'The uploaded file appears in the attachments list with its filename. No error message appears.'
  );

  -- ── 6. History ────────────────────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '6.1', 'History',
    'View submittal change history',
    'MEDIUM', '/767/submittals',
    'Checks that the History tab shows a log of edits made to the submittal.',
    'Make at least one edit to a submittal before running this scenario.',
    E'1. Open any submittal that has been edited at least once\n2. Click the **History** tab\n3. Scroll through the history entries',
    'At least one history entry is visible. Each entry shows what was changed and when. No error message appears.'
  );

  -- ── 7. Filter / Search ────────────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '7.1', 'Filter / Search',
    'Search for a submittal by title',
    'MEDIUM', '/767/submittals',
    'Checks that the search box filters the list to matching records.',
    'The Submittals list must have at least two records with different titles.',
    E'1. Open the Submittals page (/767/submittals)\n2. Click the search box (shows "Search submittals...")\n3. Type part of a known submittal title, e.g. **Concrete**\n4. Wait for the list to filter',
    'The list narrows to show only records whose title contains "Concrete". Records with unrelated titles are no longer visible. Clearing the search box brings all records back.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '7.2', 'Filter / Search',
    'Filter submittals by status',
    'MEDIUM', '/767/submittals',
    'Checks that the status filter correctly narrows the list.',
    'The list must have submittals in at least two different statuses.',
    E'1. Open the Submittals page\n2. Click the **Filters** button in the toolbar\n3. Select **Status** and choose **Open**\n4. Wait for the list to update',
    'Only submittals with status Open are shown. Submittals with other statuses (Draft, Distributed, Closed) are hidden. Removing the filter brings all records back.'
  );

  -- ── 8. Delete / Recycle Bin ───────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '8.1', 'Delete',
    'Delete a submittal (moves to Recycle Bin)',
    'HIGH', '/767/submittals',
    'Checks that deleting a submittal removes it from the main list and places it in the Recycle Bin.',
    'Create a submittal named "Delete Me Submittal" before running this scenario.',
    E'1. Open the Submittals page\n2. Find the row titled **Delete Me Submittal**\n3. Click the three-dot menu (⋯) on that row\n4. Click **Delete**\n5. Confirm the deletion in the dialog that appears\n6. Wait for the page to stop loading',
    'The record "Delete Me Submittal" is no longer visible in the main Items list. Clicking the Recycle Bin tab shows the deleted submittal. A success message (toast) briefly appears.'
  );

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '8.2', 'Delete',
    'View deleted submittals in the Recycle Bin',
    'LOW', '/767/submittals',
    'Checks that the Recycle Bin tab shows previously deleted records.',
    'Complete scenario 8.1 first.',
    E'1. Open the Submittals page (/767/submittals)\n2. Click the **Recycle Bin** tab at the top of the table\n3. Wait for the list to load',
    'The Recycle Bin tab shows the submittal deleted in scenario 8.1. It is not visible on the main Items tab. No error messages appear.'
  );

  -- ── 9. Privacy ────────────────────────────────────────────────────────────

  INSERT INTO test_cases (suite_id, test_number, category, test_name, priority, start_url, context_note, setup_steps, steps, expected_result)
  VALUES (
    v_suite_id, '9.1', 'Privacy',
    'Mark a submittal as Private',
    'LOW', '/767/submittals',
    'Checks that the Private checkbox can be checked and saved.',
    NULL,
    E'1. Open the Submittals page\n2. Click **Add Submittal**\n3. Enter **Number**: **PRIV-001** and **Title**: **Private Submittal Test**\n4. Scroll down to the Content section\n5. Check the box labelled **Private (visible only to admins and distribution list)**\n6. Click **Create Submittal**\n7. Find "Private Submittal Test" in the list and click to open',
    'The submittal detail page shows the private flag is enabled. No error messages appear.'
  );

  -- Update total_cases
  UPDATE test_suites
  SET total_cases = (SELECT COUNT(*) FROM test_cases WHERE suite_id = v_suite_id)
  WHERE id = v_suite_id;

END $$;
