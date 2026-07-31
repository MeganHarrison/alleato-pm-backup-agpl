-- ============================================================================
-- Seed: Documents Test Scenarios
-- Generated: 2026-04-08
-- Suite: documents
-- Type: scenario (plain-English guided tests for non-technical testers)
-- Runner: http://localhost:3000/testing
-- 13 scenarios across 8 categories
-- ============================================================================

-- Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('documents', 'Documents', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Insert all scenarios
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'documents')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

  -- ── 1. Navigation ──────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the Documents page',
   'Checks that the Documents page loads without errors and shows the file list. The Documents tool is where all project files are stored — PDFs, drawings, contracts, photos, and any other documents the team uploads.',
   NULL,
   E'1. Make sure you are logged in as test1@mail.com\n2. In the left sidebar, click "Documents" under project "Alleato AI"\n3. Wait for the page to stop loading',
   'The page loads fully. A table of documents is visible (or an empty state message if none exist yet). The page title says "Documents". No error messages appear.',
   'HIGH', 'scenario', '/767/documents'),

  ((SELECT id FROM suite), '1.2', 'Navigation', 'Views',
   'Switch between table, card, and list views',
   'Checks that the three different display styles all work for browsing documents.',
   NULL,
   E'1. Go to the Documents page\n2. Click the view toggle button in the toolbar (looks like a grid or list icon)\n3. Select "Card" view and look at the result\n4. Select "List" view and look at the result\n5. Switch back to "Table" view',
   'Each view loads without errors. In Card view, files appear as cards with their names. In List view, files appear as rows. Table view shows a full data grid with columns.',
   'MEDIUM', 'scenario', '/767/documents'),

  ((SELECT id FROM suite), '1.3', 'Navigation', 'Open file',
   'Click a document row to open the file',
   'Checks that clicking on a file in the list opens it in a new browser tab so you can read or download it.',
   'There must be at least one document already uploaded to the project.',
   E'1. Go to the Documents page\n2. Click on any document row in the table\n3. Watch what happens',
   'The file opens in a new browser tab. If it is a PDF, it displays in the browser. No error message appears.',
   'HIGH', 'scenario', '/767/documents'),

  -- ── 2. Upload ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '2.1', 'Upload', 'Upload a new document',
   'Upload a small PDF file to the project',
   'Checks the most important feature — adding a new file. Think of this like attaching a file to an email, but it saves to the project permanently.',
   'Have a small PDF ready on your computer (any PDF under 5 MB).',
   E'1. Go to the Documents page\n2. Click the "Upload" button (top right)\n3. In the Title field, type: Test Document Upload\n4. In the Folder field, type: Test Folder\n5. Select any Category from the dropdown\n6. Click the file upload area and select your small PDF\n7. Click the Save or Upload button\n8. Wait for the upload to finish',
   'The dialog closes. The new file "Test Document Upload" appears in the documents list. No error message appears. The folder column shows "Test Folder".',
   'HIGH', 'scenario', '/767/documents'),

  ((SELECT id FROM suite), '2.2', 'Upload', 'Validation — title required',
   'Try to upload without entering a title',
   'Checks that the upload form prevents saving when the required Title field is left blank.',
   NULL,
   E'1. Click the "Upload" button\n2. Leave the Title field completely empty\n3. Select a file to upload\n4. Click the Save or Upload button',
   'A red error message appears near the Title field saying it is required. The file is NOT uploaded. The dialog stays open.',
   'HIGH', 'scenario', '/767/documents'),

  ((SELECT id FROM suite), '2.3', 'Upload', 'Validation — file required',
   'Try to save without selecting a file',
   'Checks that the form prevents saving when no file has been chosen.',
   NULL,
   E'1. Click the "Upload" button\n2. Fill in the Title: Missing File Test\n3. Do NOT select any file\n4. Click the Save or Upload button',
   'An error message appears saying a file is required. The record is NOT created. The dialog stays open.',
   'HIGH', 'scenario', '/767/documents'),

  -- ── 3. Folder Organisation ─────────────────────────────────────────────────
  ((SELECT id FROM suite), '3.1', 'Folder Organisation', 'Upload into a folder',
   'Upload a document and assign it to Test Folder',
   'Checks that files can be organised into named folders, making it easier to find them later — like putting papers into a labeled binder.',
   NULL,
   E'1. Click the "Upload" button\n2. Fill in Title: Folder Test Doc\n3. In the Folder field, type: Test Folder\n4. Select a small PDF\n5. Click Save\n6. On the Documents list, click the Filters button\n7. Filter by Folder: Test Folder',
   'The document "Folder Test Doc" appears in the filtered results. The Folder column shows "Test Folder". Documents in other folders are hidden.',
   'HIGH', 'scenario', '/767/documents'),

  ((SELECT id FROM suite), '3.2', 'Folder Organisation', 'Filter by folder',
   'Use the folder filter to narrow the list',
   'Checks that the folder filter correctly limits the list to only files in the chosen folder.',
   'Upload at least two documents in different folders first.',
   E'1. Go to the Documents page\n2. Click the Filters button in the toolbar\n3. Select a folder name from the Folder filter dropdown\n4. Apply the filter',
   'Only documents assigned to that folder are shown. Documents in other folders disappear. Clearing the filter restores the full list.',
   'MEDIUM', 'scenario', '/767/documents'),

  -- ── 4. Search ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '4.1', 'Search', 'Search by filename',
   'Search for a document by part of its title',
   'Checks that typing in the search box filters the list to matching documents.',
   'The list must have at least two documents with different titles.',
   E'1. Go to the Documents page\n2. Click the search box (shows "Search documents...")\n3. Type: Test Document\n4. Wait a moment for the list to update',
   'Only documents whose title or filename contains "Test Document" are shown. Other documents disappear. Clearing the search box brings all documents back.',
   'HIGH', 'scenario', '/767/documents'),

  ((SELECT id FROM suite), '4.2', 'Search', 'Filter by status',
   'Filter the list to show only Draft documents',
   'Checks that the status filter works. A "Draft" document has been uploaded but not yet published for the whole team.',
   NULL,
   E'1. Click the Filters button in the toolbar\n2. Select Status: Draft\n3. Apply the filter',
   'Only documents with status "Draft" are shown. Documents with other statuses disappear. The filter label is visible in the toolbar.',
   'MEDIUM', 'scenario', '/767/documents'),

  -- ── 5. Delete ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '5.1', 'Delete', 'Delete a single document',
   'Delete a document and confirm it disappears from the list',
   'Checks that a document can be removed from the project. This is a permanent action — the file will no longer appear in the list.',
   'Upload a document titled "Delete Me Test" before running this scenario.',
   E'1. Go to the Documents page\n2. Find the row titled "Delete Me Test"\n3. Click the three-dot action menu on that row\n4. Click "Delete"\n5. In the confirmation dialog, click Delete\n6. Wait for the page to update',
   'The document "Delete Me Test" is no longer visible in the list. A success message (toast) briefly appears. No error message is shown.',
   'HIGH', 'scenario', '/767/documents'),

  ((SELECT id FROM suite), '5.2', 'Delete', 'Bulk delete',
   'Select multiple documents and delete them all at once',
   'Checks that you can remove several files in a single action instead of deleting them one by one.',
   'Upload at least two documents to use as test data.',
   E'1. On the Documents page, check the checkbox on 2 or more document rows\n2. Click the "Delete" bulk action button that appears in the toolbar\n3. In the confirmation dialog, confirm the deletion\n4. Wait for the page to update',
   'All selected documents are removed from the list. A success message says how many were deleted (e.g. "2 documents deleted"). No error message appears.',
   'HIGH', 'scenario', '/767/documents'),

  -- ── 6. Export ──────────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '6.1', 'Export', 'Export the list as a CSV',
   'Download the document list as a spreadsheet file',
   'Checks that clicking the export button downloads a CSV file you can open in Excel or Google Sheets — useful for reporting.',
   'There must be at least one document in the list.',
   E'1. Go to the Documents page\n2. Click the export (download) icon in the toolbar\n3. Wait for the download to start',
   'A CSV file downloads to your computer. Opening it in a spreadsheet app shows columns for Title, File Name, Folder, Category, Status, Uploaded By, and Created date.',
   'MEDIUM', 'scenario', '/767/documents'),

  -- ── 7. Column Visibility ───────────────────────────────────────────────────
  ((SELECT id FROM suite), '7.1', 'Column Visibility', 'Hide and show table columns',
   'Use the column selector to hide the Category column',
   'Checks that the column visibility control lets you customize which columns appear in the table.',
   NULL,
   E'1. Go to the Documents page in Table view\n2. Click the columns selector button in the toolbar (looks like columns or an eye icon)\n3. Uncheck "Category" to hide it\n4. Close the column selector',
   'The Category column disappears from the table. All other columns still display correctly. The rest of the data is unchanged.',
   'LOW', 'scenario', '/767/documents'),

  -- ── 8. Empty State ─────────────────────────────────────────────────────────
  ((SELECT id FROM suite), '8.1', 'Empty State', 'Empty state when no documents exist',
   'Verify the page shows a helpful message when there are no documents',
   'Checks that the page does not show a blank white screen when the project has no documents yet — it should show a friendly message with a button to upload the first file.',
   NULL,
   E'1. Apply a search or filter that returns no results (e.g. search for "xyzzy999notafile")\n2. Look at the main content area',
   'A message appears saying "No documents yet" or similar. An "Upload your first document" button is visible. No blank white space, spinner stuck loading, or error message.',
   'MEDIUM', 'scenario', '/767/documents')

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
 WHERE tool_name = 'documents';
