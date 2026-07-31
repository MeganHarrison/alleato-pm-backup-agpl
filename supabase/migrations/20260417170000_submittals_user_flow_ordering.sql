-- Ensure submittals scenarios follow real user flow:
-- 1) remove standalone load-page case
-- 2) make create-submittal the first scenario (1.1)
-- 3) update duplicate-number prerequisite reference

-- Temporarily drop the high-priority traceability constraint so data migrations
-- can touch existing HIGH rows that predate the traceability requirement.
ALTER TABLE public.test_cases DROP CONSTRAINT IF EXISTS test_cases_high_priority_traceability_chk;
DO $$
DECLARE
  v_suite_id uuid;
BEGIN
  SELECT id INTO v_suite_id
  FROM public.test_suites
  WHERE tool_name = 'submittals';

  IF v_suite_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.test_cases
  WHERE suite_id = v_suite_id
    AND test_name = 'Open the Submittals page';

  UPDATE public.test_cases
  SET test_number = '1.1'
  WHERE suite_id = v_suite_id
    AND test_name = 'Create a new submittal with required fields';

  UPDATE public.test_cases
  SET setup_steps = REPLACE(COALESCE(setup_steps, ''), 'scenario 2.1', 'scenario 1.1')
  WHERE suite_id = v_suite_id
    AND test_name = 'Create fails when submittal number already exists';

  UPDATE public.test_suites ts
  SET total_cases = (
    SELECT COUNT(*)
    FROM public.test_cases tc
    WHERE tc.suite_id = ts.id
  )
  WHERE ts.id = v_suite_id;
END $$;
-- Re-add the constraint as NOT VALID (enforces on new inserts/updates going forward,
-- does not validate existing rows that predate the traceability requirement).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_cases_high_priority_traceability_chk'
  ) THEN
    ALTER TABLE public.test_cases
      ADD CONSTRAINT test_cases_high_priority_traceability_chk
      CHECK (
        priority <> 'HIGH'
        OR (
          procore_feature_id IS NOT NULL
          AND (
            source_chunk_id IS NOT NULL
            OR source_article_id IS NOT NULL
            OR length(trim(coalesce(source_manifest_path, ''))) > 0
          )
          AND length(trim(coalesce(source_url, ''))) > 0
        )
      ) NOT VALID;
  END IF;
END $$;
