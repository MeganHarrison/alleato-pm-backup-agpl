-- Migration: Seed Drawings test scenarios
-- Generated: 2026-04-08
-- Tool: drawings

-- Step 1: Upsert the test suite
INSERT INTO test_suites (id, tool_name, display_name, source_doc_count, total_cases, created_at, last_generated_at)
VALUES (
  gen_random_uuid(),
  'drawings',
  'Drawings',
  3,
  0,
  now(),
  now()
)
ON CONFLICT (tool_name) DO UPDATE
  SET display_name       = EXCLUDED.display_name,
      last_generated_at  = now();
-- Step 2: Insert test cases
-- Uses a CTE to resolve the suite_id by tool_name
WITH suite AS (
  SELECT id FROM test_suites WHERE tool_name = 'drawings'
)
INSERT INTO test_cases (id, suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps, created_at, updated_at)
SELECT
  gen_random_uuid(), suite.id, tc.test_number, tc.category, tc.subcategory, tc.test_name,
  tc.steps, tc.expected_result, tc.priority, tc.test_type, tc.start_url, tc.context_note,
  tc.setup_steps, now(), now()
FROM suite, (VALUES

  ('1.1', 'Navigation', NULL,
   'Open the Drawings page',
   E'1. Make sure you are logged in as test1@mail.com\n2. Go to http://localhost:3000/767/drawings\n3. Wait for the page to stop loading',
   'The page loads fully. A table (or card grid) of drawings is visible. Columns include Drawing Number, Title, Discipline, and Status. No error messages appear.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that the Drawings list page loads without errors and shows existing records.',
   NULL),

  ('1.2', 'Navigation', NULL,
   'Open a drawing in the viewer',
   E'1. Open the Drawings page\n2. Click on any drawing in the list\n3. Wait for the viewer page to finish loading',
   'The drawing viewer page opens. The PDF or image of the drawing is displayed. The drawing number and title are shown at the top. No error messages appear.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that clicking a drawing row opens the full-screen viewer.',
   'The Drawings list must have at least one existing drawing.'),

  ('1.3', 'Navigation', NULL,
   'Switch between tabs (Current Drawings, Drawing Sets, Recycle Bin)',
   E'1. Open the Drawings page at /767/drawings\n2. Click the Drawing Sets tab\n3. Click the Recycle Bin tab\n4. Click the Current Drawings tab to go back',
   'Each tab loads without errors. The URL changes to match the selected tab. No blank pages or error screens appear.',
   'MEDIUM', 'scenario', '/767/drawings',
   'Checks that the three tab views all render correctly.',
   NULL),

  ('2.1', 'Upload', NULL,
   'Upload a new drawing',
   E'1. Open the Drawings page\n2. Click the Upload button (top right)\n3. Type A-101 in the Drawing Number field\n4. Type First Floor Plan in the Title field\n5. Select Architectural in the Discipline dropdown\n6. Type 0 in the Revision Number field\n7. Set today''s date in the Received Date field\n8. Click the file picker and select any PDF file from your computer\n9. Click Upload (or Submit)\n10. Wait for the upload to complete',
   'The upload dialog closes. The new drawing "A-101 — First Floor Plan" appears in the drawings list. No error messages appear.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks the end-to-end upload flow for a new drawing with required fields.',
   'Have a small PDF file (under 10 MB) ready to upload.'),

  ('2.2', 'Upload', NULL,
   'Try to upload a drawing without a file attached',
   E'1. Open the Drawings page\n2. Click the Upload button\n3. Fill in Drawing Number: A-999 and Title: No File Test\n4. Do NOT select a file\n5. Click Upload (or Submit)',
   'An error message appears (e.g. "File is required"). The drawing is NOT created. The upload dialog stays open.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that the form blocks submission when no file is chosen.',
   NULL),

  ('2.3', 'Upload', NULL,
   'Try to upload a drawing without a Drawing Number',
   E'1. Open the Drawings page\n2. Click the Upload button\n3. Leave Drawing Number blank\n4. Type Missing Number Test in the Title field\n5. Select a PDF file\n6. Click Upload (or Submit)',
   'An error message appears near the Drawing Number field (e.g. "Drawing number is required"). The record is NOT created. The dialog stays open.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that Drawing Number is enforced as a required field.',
   NULL),

  ('3.1', 'Filter / Search', NULL,
   'Filter drawings by discipline',
   E'1. Open the Drawings page\n2. Click the Filters button in the toolbar\n3. In the Discipline filter, select Architectural\n4. Wait for the list to update',
   'Only drawings with Discipline = "Architectural" are shown. Drawings from other disciplines (e.g. Structural, Mechanical) are hidden. Clearing the filter brings all drawings back.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that the discipline filter correctly narrows the drawing list.',
   'The list must have drawings from at least two different disciplines.'),

  ('3.2', 'Filter / Search', NULL,
   'Search for a drawing by number',
   E'1. Open the Drawings page\n2. Click the search box (shows "Search drawings..." placeholder)\n3. Type A-101\n4. Wait for the list to filter',
   'The list narrows to show only drawings whose number or title contains "A-101". Drawings with unrelated numbers disappear. Clearing the search box restores all drawings.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that the search box filters by drawing number.',
   'The list must have at least two drawings with different numbers.'),

  ('3.3', 'Filter / Search', NULL,
   'Filter drawings by status',
   E'1. Open the Drawings page\n2. Click the Filters button\n3. In the Status filter, select Superseded\n4. Wait for the list to update',
   'Only drawings with Status = "Superseded" are shown. Active drawings are hidden. Clearing the filter restores all drawings.',
   'MEDIUM', 'scenario', '/767/drawings',
   'Checks that the status filter works correctly.',
   'The list must contain drawings with at least two different statuses.'),

  ('4.1', 'Viewer', NULL,
   'Zoom in and out on a drawing',
   E'1. Open any drawing in the viewer\n2. Click the Zoom In button (magnifying glass with +) in the toolbar\n3. Click it two more times\n4. Click the Zoom Out button three times',
   'The drawing zooms in when Zoom In is clicked — the content gets larger. The drawing zooms back out when Zoom Out is clicked. The drawing remains visible and does not error.',
   'MEDIUM', 'scenario', '/767/drawings',
   'Checks the zoom controls in the drawing viewer.',
   'At least one drawing must be uploaded.'),

  ('4.2', 'Viewer', NULL,
   'Download a drawing from the viewer',
   E'1. Open any drawing in the viewer\n2. Click the Download button (down arrow icon) in the toolbar\n3. Wait for the file download to start',
   'A file download begins in the browser. The downloaded file has the same name as the drawing file. No error message appears.',
   'MEDIUM', 'scenario', '/767/drawings',
   'Checks that the Download button triggers a file download.',
   'At least one drawing with an uploaded file must exist.'),

  ('5.1', 'Revisions', NULL,
   'View the revision history of a drawing',
   E'1. Open any drawing in the viewer\n2. Look for a Revisions panel or button in the viewer toolbar\n3. Click it to open the revisions list',
   'A list of revisions is shown. Each revision entry shows a revision number (e.g. "0", "1", "2"), a received date, and a status. The current/active revision is highlighted or marked.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that the revisions panel is accessible and displays revision history.',
   'At least one drawing must exist. Ideally it has more than one revision.'),

  ('5.2', 'Revisions', NULL,
   'Upload a new revision of an existing drawing',
   E'1. Open any drawing in the viewer\n2. Open the Revisions panel\n3. Click Add Revision (or the + button)\n4. Type 1 in the Revision Number field\n5. Set today''s date in the Received Date field\n6. Select a new PDF file from your computer\n7. Click Upload (or Save)\n8. Wait for the upload to complete',
   'The new revision appears in the revisions list with number "1". The viewer updates to show the new file. The previous revision (number "0") is still listed but marked as an older version. No error message appears.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that a second revision can be added to an existing drawing.',
   'A drawing must already exist with at least revision "0". Have a second PDF ready to upload.'),

  ('6.1', 'Delete', NULL,
   'Delete a drawing',
   E'1. Open the Drawings page\n2. Find the drawing titled First Floor Plan (number A-101) in the list\n3. Click the three-dot menu on that row\n4. Click Delete\n5. Confirm the deletion in the dialog that appears\n6. Wait for the page to stop loading',
   'The drawing "A-101 — First Floor Plan" is no longer visible in the list. A success message (toast) briefly appears. The drawing is gone even after refreshing the page.',
   'HIGH', 'scenario', '/767/drawings',
   'Checks that a drawing can be deleted from the list.',
   'Create a drawing named "First Floor Plan" with number A-101 before running this scenario.')

) AS tc(test_number, category, subcategory, test_name, steps, expected_result, priority, test_type, start_url, context_note, setup_steps)
ON CONFLICT (suite_id, test_number) DO UPDATE
  SET test_name       = EXCLUDED.test_name,
      steps           = EXCLUDED.steps,
      expected_result = EXCLUDED.expected_result,
      priority        = EXCLUDED.priority,
      start_url       = EXCLUDED.start_url,
      context_note    = EXCLUDED.context_note,
      setup_steps     = EXCLUDED.setup_steps,
      updated_at      = now();
-- Step 3: Update total_cases count
UPDATE test_suites
SET total_cases = (
  SELECT COUNT(*) FROM test_cases tc WHERE tc.suite_id = test_suites.id
)
WHERE tool_name = 'drawings';
