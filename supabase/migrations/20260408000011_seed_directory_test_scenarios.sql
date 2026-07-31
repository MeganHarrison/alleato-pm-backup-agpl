-- Migration: Seed Directory test scenarios
-- Generated: 2026-04-08
-- Suite: directory / Directory

-- ── 1. Upsert suite ────────────────────────────────────────────────
INSERT INTO test_suites (tool_name, display_name)
VALUES ('directory', 'Directory')
ON CONFLICT (tool_name) DO UPDATE
  SET display_name      = EXCLUDED.display_name,
      last_generated_at = now();
-- ── 2. Insert / update test cases ─────────────────────────────────
DO $$
DECLARE
  v_suite_id uuid;
BEGIN
  SELECT id INTO v_suite_id FROM test_suites WHERE tool_name = 'directory';

  INSERT INTO test_cases (suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, start_url, context_note, setup_steps)
  VALUES

  -- 1. Navigation
  (v_suite_id, '1.1', 'Navigation', 'Page load',
    'Open the Directory page',
    E'1. Make sure you are logged in as test1@mail.com\n2. Go to http://localhost:3000/767/directory\n3. Wait for the page to finish loading',
    'The Directory page loads without errors. A list of people (names, companies, roles) is visible. No blank screen or error message appears.',
    'HIGH', '/767/directory',
    'Checks that the main Directory list page renders with real data.',
    null),

  (v_suite_id, '1.2', 'Navigation', 'Person detail',
    'Open a person detail page',
    E'1. Open the Directory page\n2. Click on any person''s name in the list\n3. Wait for the page to finish loading',
    'A detail view opens for that person. Their name, email, phone, company, and role are visible. No error messages appear.',
    'HIGH', '/767/directory',
    'Checks that clicking a person row navigates to their detail view.',
    'The Directory list must have at least one person.'),

  -- 2. Add Person
  (v_suite_id, '2.1', 'Add Person', 'Create',
    'Add a new person to the directory',
    E'1. Open the Directory page\n2. Click the **Add Person** button (top right)\n3. In the **First Name** field, type: **John**\n4. In the **Last Name** field, type: **Smith**\n5. In the **Email** field, type: **jsmith@testco.com**\n6. In the **Job Title** field, type: **Project Manager**\n7. Click **Save** (or Create)\n8. Wait for the page to stop loading',
    'John Smith appears in the directory list. His email and job title are visible. A success message (toast) briefly appears.',
    'HIGH', '/767/directory',
    'Verifies a new person can be added with required fields.',
    null),

  (v_suite_id, '2.2', 'Add Person', 'Validation',
    'Try to add a person without a first name',
    E'1. Open the Directory page\n2. Click the **Add Person** button\n3. Leave the **First Name** field empty\n4. Fill in Last Name: **Smith**\n5. Fill in Email: **noname@test.com**\n6. Click **Save**',
    'An error message appears near the First Name field (e.g. "First name is required"). The record is NOT created. The form stays open.',
    'HIGH', '/767/directory',
    'Confirms required-field validation on the add person form.',
    null),

  (v_suite_id, '2.3', 'Add Person', 'Create',
    'Add a person and assign them to a company',
    E'1. Open the Directory page\n2. Click the **Add Person** button\n3. Type **First Name**: **Maria**\n4. Type **Last Name**: **Torres**\n5. In the **Company** field, select or type **ABC Concrete Co**\n6. In the **Job Title** field, type: **Site Supervisor**\n7. Click **Save**\n8. Find "Maria Torres" in the list and click her name',
    'Maria Torres appears in the directory. Her company shows "ABC Concrete Co" and job title shows "Site Supervisor". No error appears.',
    'MEDIUM', '/767/directory',
    'Checks that a person can be linked to an existing company.',
    'ABC Concrete Co must already exist in the companies list.'),

  -- 3. Add Company
  (v_suite_id, '3.1', 'Add Company', 'Create',
    'Add a new company to the directory',
    E'1. Open the Directory page\n2. Click the **Companies** tab (or navigate to the Companies section)\n3. Click the **Add Company** button\n4. In the **Company Name** field, type: **Steel Frame Solutions**\n5. In the **Trade** (or Type) field, select **Structural Steel** (or the closest option)\n6. Click **Save**\n7. Wait for the page to stop loading',
    'Steel Frame Solutions appears in the companies list. No error messages appear.',
    'HIGH', '/767/directory',
    'Verifies a new company record can be created.',
    null),

  (v_suite_id, '3.2', 'Add Company', 'Validation',
    'Try to add a company without a name',
    E'1. Open the Companies section of the Directory\n2. Click **Add Company**\n3. Leave the **Company Name** field empty\n4. Click **Save**',
    'An error message appears near the Company Name field. The record is NOT created. The form stays open.',
    'HIGH', '/767/directory',
    'Confirms required-field validation on the add company form.',
    null),

  -- 4. Edit Contact
  (v_suite_id, '4.1', 'Edit', 'Update person',
    'Edit a person''s phone number',
    E'1. Open the Directory page\n2. Click on any person''s name to open their detail view\n3. Click the **Edit** button\n4. In the **Phone** field, clear any existing value and type: **555-867-5309**\n5. Click **Save**\n6. Wait for the page to stop loading',
    'The detail view now shows the phone number 555-867-5309. A success toast briefly appears.',
    'HIGH', '/767/directory',
    'Verifies that editing a contact field saves correctly.',
    'At least one person must exist in the directory.'),

  (v_suite_id, '4.2', 'Edit', 'Persist',
    'Edited changes persist after page refresh',
    E'1. Complete scenario 4.1 (edit a phone number and save)\n2. Press **Ctrl+R** (or Cmd+R on Mac) to refresh the page\n3. Wait for the page to reload',
    'The phone number 555-867-5309 is still shown after the refresh. No data reverted to the old value.',
    'HIGH', '/767/directory',
    'Confirms edits are written to the database, not just held in memory.',
    'Complete scenario 4.1 first.'),

  (v_suite_id, '4.3', 'Edit', 'Cancel',
    'Cancel discards unsaved changes',
    E'1. Open any person''s detail view\n2. Click the **Edit** button\n3. Change the Job Title field to: **DO NOT SAVE THIS**\n4. Click **Cancel** (instead of Save)',
    'The form closes. The original job title is still shown. "DO NOT SAVE THIS" does not appear anywhere on the page.',
    'MEDIUM', '/767/directory',
    'Confirms that cancelling an edit does not persist changes.',
    'At least one person must exist in the directory.'),

  -- 5. Delete
  (v_suite_id, '5.1', 'Delete', 'Remove person',
    'Delete a person from the directory',
    E'1. Open the Directory page\n2. Find the person named **John Smith** (created in scenario 2.1)\n3. Click the three-dot menu (⋯) on that row, or open the detail view\n4. Click **Delete** (or Remove)\n5. Confirm the deletion in the dialog that appears\n6. Wait for the page to stop loading',
    'John Smith is no longer visible in the directory list. A success toast briefly appears.',
    'HIGH', '/767/directory',
    'Verifies a person can be permanently removed from the directory.',
    'Create a person named "John Smith" first (see scenario 2.1).'),

  -- 6. Search
  (v_suite_id, '6.1', 'Search', 'By name',
    'Search for a person by name',
    E'1. Open the Directory page\n2. Click the search box (usually shows a magnifying glass icon or says "Search...")\n3. Type: **Maria Torres**\n4. Wait for the list to filter',
    'The list narrows to show only contacts whose name contains "Maria Torres". Other people are hidden. Clearing the search box brings all records back.',
    'HIGH', '/767/directory',
    'Checks that the search box filters the directory by name.',
    'At least two people with different names must exist in the directory.'),

  (v_suite_id, '6.2', 'Search', 'By company',
    'Search for contacts by company name',
    E'1. Open the Directory page\n2. Click the search box\n3. Type: **ABC Concrete Co**\n4. Wait for the list to filter',
    'Only contacts associated with "ABC Concrete Co" are shown. Contacts from other companies are hidden. Clearing the search brings all records back.',
    'MEDIUM', '/767/directory',
    'Checks that searching by company name filters correctly.',
    'At least one person linked to "ABC Concrete Co" must exist.'),

  -- 7. Filter
  (v_suite_id, '7.1', 'Filter', 'By role',
    'Filter directory by role or permission level',
    E'1. Open the Directory page\n2. Click the **Filters** button (or the filter icon in the toolbar)\n3. Find the **Role** (or Permission) filter\n4. Select a role such as **Project Manager** or **Standard**\n5. Click **Apply** (if required)',
    'The directory list updates to show only people who have the selected role. People with other roles are hidden. Removing the filter restores the full list.',
    'MEDIUM', '/767/directory',
    'Verifies the role/permission filter works on the directory list.',
    'Multiple people with at least two different roles must exist.')

  ON CONFLICT (suite_id, test_number) DO UPDATE
    SET
      category        = EXCLUDED.category,
      subcategory     = EXCLUDED.subcategory,
      test_name       = EXCLUDED.test_name,
      steps           = EXCLUDED.steps,
      expected_result = EXCLUDED.expected_result,
      priority        = EXCLUDED.priority,
      start_url       = EXCLUDED.start_url,
      context_note    = EXCLUDED.context_note,
      setup_steps     = EXCLUDED.setup_steps,
      updated_at      = now();

  -- ── 3. Update total_cases count ───────────────────────────────────
  UPDATE test_suites
  SET total_cases = (SELECT COUNT(*) FROM test_cases WHERE suite_id = v_suite_id)
  WHERE id = v_suite_id;
END $$;
