-- Fix test_cases rows that were inserted without test_type (defaults to NULL).
-- All manually-seeded scenario rows should be 'scenario'.
UPDATE public.test_cases
SET test_type = 'scenario'
WHERE test_type IS NULL;
