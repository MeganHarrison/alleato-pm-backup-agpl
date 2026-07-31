-- Seed: Budget — Feature test suite
-- Generated: 2026-05-14
-- Supabase project: lgveqfnpkxvzbnnwuled
-- 31 cases: CRUD, lock/unlock, budget modifications, forecasting, snapshots,
--           drilldown modals, calculations, filters, views, import, settings,
--           change history, permissions, edge cases, export.

-- 1. Upsert suite
insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
values ('budget', 'feature', 'Budget — Feature', 0)
on conflict (tool_name, suite_type) do update set
  display_name      = excluded.display_name,
  last_generated_at = now()
returning id;

-- NOTE: Replace <SUITE_ID> with the id returned above before running remaining steps.
-- Steps 2-4 (delete + insert + update) are commented out to prevent accidental re-runs.
-- Re-run only when intentionally regenerating scenarios.

-- 2. Wipe existing cases
-- delete from public.test_cases where suite_id = '<SUITE_ID>';

-- 3. Insert cases (31 total)
-- See docs/testing/scenarios/budget.md for full case detail.

-- 4. Update total_cases
-- update public.test_suites
--    set total_cases = (select count(*) from public.test_cases where suite_id = '<SUITE_ID>')
--  where id = '<SUITE_ID>';
