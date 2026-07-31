-- Update budget test case 4.1 and set traceability fields when required by schema constraints.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'test_cases'
      AND column_name = 'procore_feature_id'
  ) THEN
    EXECUTE $sql$
      WITH suite AS (
        SELECT id FROM public.test_suites WHERE tool_name = 'budget'
      ),
      budget_feature AS (
        SELECT id
        FROM public.procore_features
        WHERE lower(name) = 'budget'
        ORDER BY created_at ASC NULLS LAST, id ASC
        LIMIT 1
      )
      UPDATE public.test_cases tc
      SET
        test_name = 'Edit the forecast-to-complete value on a line item',
        category = 'Forecast',
        subcategory = 'Edit forecast',
        steps = E'1. Click "Open the app at the right page" above to open the Budget page\n2. Locate any line item row in the table\n3. Click the value in the "Forecast" column — a "Forecast To Complete" sidebar opens\n4. Select "Lump Sum Entry" under Forecast Method\n5. Enter a dollar amount in the Forecast Amount field (e.g. 5000)\n6. Click Save\n7. Refresh the page',
        expected_result = E'Forecast value updates in the table row. "Forecast saved successfully" toast appears. After page refresh, the entered value is still shown. Variance / Projected Over-Under recalculates to reflect the change.',
        procore_feature_id = COALESCE(tc.procore_feature_id, (SELECT id FROM budget_feature)),
        source_manifest_path = COALESCE(NULLIF(trim(tc.source_manifest_path), ''), '_bmad-output/procore/budget/manifest.md'),
        source_url = COALESCE(NULLIF(trim(tc.source_url), ''), 'https://support.procore.com/products/online/user-guide/project-level/budget'),
        updated_at = now()
      WHERE tc.suite_id = (SELECT id FROM suite)
        AND tc.test_type = 'scenario'
        AND tc.test_number = '4.1'
    $sql$;
  ELSE
    EXECUTE $sql$
      WITH suite AS (
        SELECT id FROM public.test_suites WHERE tool_name = 'budget'
      )
      UPDATE public.test_cases tc
      SET
        test_name = 'Edit the forecast-to-complete value on a line item',
        category = 'Forecast',
        subcategory = 'Edit forecast',
        steps = E'1. Click "Open the app at the right page" above to open the Budget page\n2. Locate any line item row in the table\n3. Click the value in the "Forecast" column — a "Forecast To Complete" sidebar opens\n4. Select "Lump Sum Entry" under Forecast Method\n5. Enter a dollar amount in the Forecast Amount field (e.g. 5000)\n6. Click Save\n7. Refresh the page',
        expected_result = E'Forecast value updates in the table row. "Forecast saved successfully" toast appears. After page refresh, the entered value is still shown. Variance / Projected Over-Under recalculates to reflect the change.',
        updated_at = now()
      WHERE tc.suite_id = (SELECT id FROM suite)
        AND tc.test_type = 'scenario'
        AND tc.test_number = '4.1'
    $sql$;
  END IF;
END;
$$;
