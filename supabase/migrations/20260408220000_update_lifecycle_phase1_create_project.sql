-- ============================================================================
-- Update Project Lifecycle Phase 1: Start with creating a new test project
-- Each tester creates their own isolated project and enters its ID in the
-- test run form so all subsequent URLs auto-substitute the correct project ID.
-- ============================================================================

WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'project-lifecycle')

UPDATE public.test_cases
SET
  test_name    = vals.test_name,
  context_note = vals.context_note,
  setup_steps  = vals.setup_steps,
  steps        = vals.steps,
  expected_result = vals.expected_result,
  start_url    = vals.start_url
FROM (VALUES

  ('1.1',
   'Create a new test project',
   'Every tester creates their own isolated project so data from different testers does not collide. Name your project using the pattern "Test – [Your Name] – [Today''s Date]" so it is easy to identify and clean up later.',
   'Log in as test1@mail.com before starting.',
   E'1. Navigate to /create-project\n2. In Project Name, type: Test – [Your Name] – [Today''s Date] (e.g. "Test – Jordan – 2026-04-08")\n3. Fill in any other required fields (e.g. Project Number: TEST-001, Status: Active, Start Date: today)\n4. Click Save / Create\n5. Wait for the page to redirect to your new project dashboard\n6. Note the project ID from the URL (e.g. https://app.alleato.com/123/home — the ID is 123)\n7. Enter that project ID in the "Project ID" field in the test run form (top of the sidebar)',
   'A success toast appears. The app redirects to the new project dashboard. The URL contains your new project ID. After entering the ID in the test run form, all "Open in app" links throughout this test suite will open pages in your new project.',
   '/create-project'),

  ('1.2',
   'Verify project details are saved correctly',
   'Confirm the details you just entered are correct before doing any financial work. The project name and number will appear throughout the lifecycle.',
   'Complete test 1.1 and enter your project ID in the run form.',
   E'1. From your new project dashboard, navigate to project Settings or the Project Overview page\n2. Verify that the following fields are populated: Project Name, Project Number, Status, Start Date\n3. Confirm the project name matches what you typed in test 1.1',
   'All key project fields display the data you entered. No field is blank or shows a placeholder. The project name is exactly what you typed.',
   '/67'),

  ('1.3',
   'Check directory is ready for later steps',
   'Later phases (commitments, prime contracts) require companies and people to be assigned as owners, vendors, and contractors. Confirm the project directory has usable entries — if not, add them now.',
   'Complete test 1.2 first.',
   E'1. Navigate to your project''s Directory page (/[projectId]/directory)\n2. Check the People tab — confirm at least 1 person is listed (you may need to add yourself)\n3. Check the Companies tab — confirm at least 1 company is listed\n4. If empty, add a test person and a test company now before continuing',
   'The directory shows at least 1 person and 1 company. Role labels are visible. The tester can proceed knowing dropdowns in later forms will have options to select.',
   '/67/directory'),

  ('1.4',
   'Verify create permissions on financial tools',
   'Before creating any financial records, confirm you have write access. If Create buttons are missing, stop and fix permissions before proceeding.',
   'Complete test 1.3 first.',
   E'1. Navigate to your project''s Budget page (/[projectId]/budget)\n2. Look for a "New Line Item" or "Add" button in the toolbar or header\n3. Navigate to /[projectId]/prime-contracts — look for a "Create" button\n4. Navigate to /[projectId]/change-events — look for a "New Change Event" button',
   'All three pages show a primary action button. If any Create/Add buttons are missing, the logged-in user lacks write permission — fix permissions before continuing the lifecycle.',
   '/67')

) AS vals(test_number, test_name, context_note, setup_steps, steps, expected_result, start_url)

WHERE suite_id = (SELECT id FROM suite)
  AND test_cases.test_number = vals.test_number;
