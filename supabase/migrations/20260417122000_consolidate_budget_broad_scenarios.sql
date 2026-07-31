-- Consolidate Budget broad scenarios by removing redundant page-load checks.
-- Combines the basic load/column checks into 1.1 and renumbers the remaining scenarios.

WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_name = 'Open Budget and verify table + standard columns',
    category = 'Navigation',
    steps = E'1. Click "Open the app at the right page" above\n2. Wait for the Budget page to finish loading\n3. Verify the table includes these columns: Original Budget, Revised Budget, Projected Budget, Projected Costs, Projected Over/Under, Forecast to Complete, Direct Costs',
    expected_result = 'Budget table loads with line items and totals visible. Standard budget columns are present. No console errors. No spinner is stuck on screen.',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '1.1';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
DELETE FROM public.test_cases tc
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number IN ('2.1', '2.2');
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '2.1.tmp',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '3.1';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '2.2.tmp',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '3.2';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '3.1.tmp',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '4.1';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '4.1.tmp',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '5.1';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '5.1.tmp',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '6.1';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '6.1.tmp',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '7.1';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '2.1',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '2.1.tmp';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '2.2',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '2.2.tmp';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '3.1',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '3.1.tmp';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '4.1',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '4.1.tmp';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '5.1',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '5.1.tmp';
WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'budget'
)
UPDATE public.test_cases tc
SET test_number = '6.1',
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.test_number = '6.1.tmp';
UPDATE public.test_suites ts
SET total_cases = (
  SELECT COUNT(*) FROM public.test_cases tc WHERE tc.suite_id = ts.id
)
WHERE ts.tool_name = 'budget';
