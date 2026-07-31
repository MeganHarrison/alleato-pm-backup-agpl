-- After moving Drawings upload baseline to 1.1, update downstream setup references.

WITH suite AS (
  SELECT id FROM public.test_suites WHERE tool_name = 'drawings'
)
UPDATE public.test_cases tc
SET setup_steps = replace(replace(tc.setup_steps, '2.1', '1.1'), 'A1.1', 'A-101'),
    updated_at = now()
WHERE tc.suite_id = (SELECT id FROM suite)
  AND tc.test_type = 'scenario'
  AND tc.setup_steps IS NOT NULL;
