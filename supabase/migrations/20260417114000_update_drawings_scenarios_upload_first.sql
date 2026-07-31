-- Reorder Drawings guided scenarios so upload is first, and remove page-load-only scenario.
-- Keeps testing runner content aligned with docs/testing/drawings-scenarios.md.

WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'drawings'
)
DELETE FROM public.test_cases
WHERE suite_id = (SELECT id FROM suite)
  AND test_type = 'scenario'
  AND test_number = '2.1';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'drawings'
)
UPDATE public.test_cases tc
SET test_number = '2.1.tmp',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '2.2'
  AND tc.test_name = 'Try to upload a drawing without a file attached';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'drawings'
)
UPDATE public.test_cases tc
SET test_number = '2.2.tmp',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '2.3'
  AND tc.test_name = 'Try to upload a drawing without a Drawing Number';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'drawings'
)
UPDATE public.test_cases tc
SET test_number = '2.1',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '2.1.tmp';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'drawings'
)
UPDATE public.test_cases tc
SET test_number = '2.2',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '2.2.tmp';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'drawings'
)
UPDATE public.test_cases tc
SET category = 'Upload',
    test_name = 'Upload 3 starter drawing files',
    steps = E'1. Make sure you are logged in as test1@mail.com\n2. Go to http://localhost:3000/767/drawings\n3. Click Upload\n4. Upload file docs/testing/drawings/3.-2024.02.29-Architectural-Construction-Drawing_Part1.pdf with Drawing Number A-101, Title Architectural Plan — Part 1, Discipline Architectural, Revision 0\n5. Upload file docs/testing/drawings/3.-2024.02.29-Architectural-Construction-Drawing_Part2.pdf with Drawing Number A-102, Title Architectural Plan — Part 2, Discipline Architectural, Revision 0\n6. Upload file docs/testing/drawings/3.-2024.02.29-Architectural-Construction-Drawing_Part3.pdf with Drawing Number A-103, Title Architectural Plan — Part 3, Discipline Architectural, Revision 0\n7. Wait for uploads to finish and return to the list',
    expected_result = 'All three drawings appear in the list (A-101, A-102, A-103) with the correct titles and uploaded files. No error messages appear.',
    priority = 'HIGH',
    start_url = '/767/drawings',
    context_note = 'Checks core upload flow and creates a baseline dataset for downstream drawing tests.',
    setup_steps = 'Download these files first: docs/testing/drawings/3.-2024.02.29-Architectural-Construction-Drawing_Part1.pdf, docs/testing/drawings/3.-2024.02.29-Architectural-Construction-Drawing_Part2.pdf, docs/testing/drawings/3.-2024.02.29-Architectural-Construction-Drawing_Part3.pdf',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '1.1';
UPDATE public.test_suites ts
SET total_cases = (
  SELECT COUNT(*)
  FROM public.test_cases tc
  WHERE tc.suite_id = ts.id
)
WHERE ts.tool_name = 'drawings';
