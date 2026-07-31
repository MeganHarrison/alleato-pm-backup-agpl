-- Smoke test suite seed: change-orders
-- Generated: 2026-05-14
-- Supabase project: lgveqfnpkxvzbnnwuled

insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
values ('change-orders', 'smoke', 'Change Orders — Smoke', 0)
on conflict (tool_name, suite_type) do update set
  display_name      = excluded.display_name,
  last_generated_at = now()
returning id;

-- After getting the suite id, wipe and re-insert cases.
-- (Run interactively or adapt to your migration runner to capture the id.)

-- delete from public.test_cases where suite_id = <smoke_suite_id>;

-- insert into public.test_cases (suite_id, test_number, category, subcategory, test_name,
--   context_note, setup_steps, steps, expected_result, priority, test_type, start_url)
-- values
--   (<smoke_suite_id>, '1.1', 'Navigation', 'Page load',
--    'Change Orders page loads without errors',
--    'Verifies the page renders and shows the Prime Contract tab by default.',
--    null,
--    E'1. Log in as test1@mail.com\n2. Navigate to project 67 (Vermillion Rise Warehouse)\n3. Click "Change Orders" in the left sidebar\n4. Wait for the page to stop loading.',
--    'The page loads fully showing the "Change Orders" heading and a table (or empty state). The "Prime Contract" tab is active. No 500 errors in the network.',
--    'HIGH', 'scenario', '/67/change-orders'),
--
--   (<smoke_suite_id>, '1.2', 'Navigation', 'Tab switching',
--    'Commitment tab loads without errors',
--    'Checks that the Commitments tab renders correctly.',
--    null,
--    E'1. Log in as test1@mail.com\n2. Navigate to /67/change-orders\n3. Click the "Commitments" tab.\n4. Wait for the page to stop loading.',
--    'The Commitments tab becomes active, the URL contains tab=commitment, and the table (or empty state) renders without error.',
--    'HIGH', 'scenario', '/67/change-orders'),
--
--   (<smoke_suite_id>, '1.3', 'Navigation', 'Table columns',
--    'Prime Contract tab shows expected columns',
--    'Confirms that the key columns (#, Title, Status, Amount, Created) are visible in the table header.',
--    null,
--    E'1. Navigate to /67/change-orders (Prime Contract tab).\n2. Inspect the table header row.',
--    'Columns "#", "Title", "Status", "Amount", and "Created" are all visible.',
--    'HIGH', 'scenario', '/67/change-orders'),
--
--   (<smoke_suite_id>, '1.4', 'Navigation', 'Create button',
--    'Clicking "New Prime CO" opens the create form',
--    'Ensures the primary create action navigates to the new-PCCO form.',
--    null,
--    E'1. Navigate to /67/change-orders (Prime Contract tab).\n2. Click "New Prime CO" in the header.\n3. Wait for the page to stop loading.',
--    'The URL changes to /67/change-orders/prime/new and the "Create Prime Contract Change Order" form is rendered.',
--    'HIGH', 'scenario', '/67/change-orders'),
--
--   (<smoke_suite_id>, '1.5', 'Navigation', 'Create button',
--    'Clicking "New Commitment CO" opens the create form',
--    'Ensures the Commitments-tab create action navigates to the new-CCO form.',
--    null,
--    E'1. Navigate to /67/change-orders?tab=commitment\n2. Click "New Commitment CO".\n3. Wait for the page to stop loading.',
--    'The URL changes to /67/change-orders/commitment/new and the "Create Commitment Change Order" form is rendered.',
--    'HIGH', 'scenario', '/67/change-orders?tab=commitment'),
--
--   (<smoke_suite_id>, '1.6', 'Filters', 'Status filter',
--    'Status filter narrows the prime CO list',
--    'Confirms the status dropdown filters rows client-side.',
--    E'- At least one Prime Contract CO exists in project 67.',
--    E'1. Navigate to /67/change-orders (Prime Contract tab).\n2. Open the Filters panel and select Status = "Draft".\n3. Observe the table.',
--    'Only rows with status "Draft" are shown. The row count label decreases accordingly.',
--    'HIGH', 'scenario', '/67/change-orders'),
--
--   (<smoke_suite_id>, '1.7', 'Filters', 'Search',
--    'Searching by title filters the prime CO list',
--    'Verifies the search bar performs a client-side filter on # and title.',
--    E'- At least one Prime Contract CO exists with a known title.',
--    E'1. Navigate to /67/change-orders (Prime Contract tab).\n2. Type part of a known CO title in the search box.\n3. Wait for debounce (~300ms).',
--    'Only rows whose # or title contains the typed text are displayed. Clearing the search restores the full list.',
--    'HIGH', 'scenario', '/67/change-orders'),
--
--   (<smoke_suite_id>, '1.8', 'Filters', 'Empty state',
--    'Filtered empty state renders when no results match',
--    'Checks that filtering to zero results shows a helpful message.',
--    null,
--    E'1. Navigate to /67/change-orders (Prime Contract tab).\n2. Type "zzz_nonexistent_9999" in the search box.\n3. Observe the table area.',
--    'An empty state is shown with text like "Try adjusting your search or filters." No JavaScript errors appear.',
--    'MEDIUM', 'scenario', '/67/change-orders');

-- update public.test_suites
--    set total_cases = (select count(*) from public.test_cases where suite_id = <smoke_suite_id>)
--  where id = <smoke_suite_id>;
