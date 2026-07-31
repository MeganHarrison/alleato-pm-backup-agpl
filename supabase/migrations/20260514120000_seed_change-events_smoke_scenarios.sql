-- Seed: change-events smoke suite
-- Generated: 2026-05-14
-- Re-runnable: upserts suite, wipes existing cases, re-inserts.

do $$
declare
  v_suite_id uuid;
begin

  insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
  values ('change-events', 'smoke', 'Change Events — Smoke', 0)
  on conflict (tool_name, suite_type) do update set
    display_name      = excluded.display_name,
    last_generated_at = now()
  returning id into v_suite_id;

  delete from public.test_cases where suite_id = v_suite_id;

  insert into public.test_cases
    (suite_id, test_number, category, subcategory, test_name,
     context_note, setup_steps, steps, expected_result, priority,
     test_type, start_url)
  values
    (v_suite_id, '1.1', 'Navigation', 'Page load',
     'Change Events list page loads without error',
     'Confirms the page renders, no 500 errors, and the table or empty state is visible.',
     'Logged in as test1@mail.com. Project 67 (Vermillion Rise Warehouse) is accessible.',
     E'1. Log in as test1@mail.com.\n2. Click "Change Events" in the left sidebar of project "Vermillion Rise Warehouse".\n3. Wait for the page to stop loading.',
     'The Change Events page loads. The table header row is visible with columns including Status, Scope, Type, Change Reason, Origin, Prime PCO, Cost ROM. No error banner appears.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '1.2', 'Navigation', 'Column groups',
     'Table renders correct column groups',
     'Validates the three column group headers — Change Event, Revenue, Cost — are present.',
     'Logged in as test1@mail.com. At least one change event exists for project 67.',
     E'1. Navigate to /67/change-events.\n2. Wait for the table to load.\n3. Inspect the column group header row.',
     'Column group headers "Change Event", "Revenue", and "Cost" are all visible above the table columns.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '1.3', 'Navigation', 'Create button present',
     '"Create" button is visible and clickable in the header',
     'Confirms the primary action button exists so users can create new change events.',
     'Logged in as test1@mail.com with write permission on change_orders module.',
     E'1. Navigate to /67/change-events.\n2. Wait for the page to load.\n3. Locate the "Create" button in the top-right header area.',
     'A "Create" button is visible in the header. It is not disabled.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '1.4', 'Navigation', 'Create form opens',
     'Clicking "Create" navigates to the new change event form',
     'Ensures the create flow entry point works — without this the tool cannot be used.',
     'Logged in as test1@mail.com.',
     E'1. Navigate to /67/change-events.\n2. Click the "Create" button.\n3. Wait for navigation to complete.',
     'The browser navigates to /67/change-events/new. The create form is visible with fields for Title, Type, Scope, Status, Origin, and Change Reason.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '1.5', 'Navigation', 'Tab switching',
     'All five tabs load without error',
     'Confirms each tab (All, Line Items, No Line Items, RFQs, Recycle Bin) renders correctly.',
     'Logged in as test1@mail.com. At least one change event exists for project 67.',
     E'1. Navigate to /67/change-events.\n2. Click the "Line Items" tab. Wait for load.\n3. Click the "No Line Items" tab. Wait for load.\n4. Click the "RFQs" tab. Wait for load.\n5. Click the "Recycle Bin" tab. Wait for load.\n6. Click "All" to return to default.',
     'Each tab loads without an error state. The table or empty state renders for each tab. The active tab is highlighted.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '1.6', 'Navigation', 'Search',
     'Search field filters the list',
     'Validates the search input actually reduces the displayed rows.',
     'Logged in as test1@mail.com. At least one change event with a known title exists.',
     E'1. Navigate to /67/change-events.\n2. Type "CE-001" in the search field.\n3. Wait for the list to update.',
     'The table filters to show only rows whose number or title contains "CE-001". If no match, the empty filtered state is shown.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '1.7', 'Navigation', 'Status filter',
     'Status filter narrows the list',
     'Confirms filter controls work so users can find events by status.',
     'Logged in as test1@mail.com. Change events with at least two different statuses exist.',
     E'1. Navigate to /67/change-events.\n2. Open the filter panel and select Status = "Open".\n3. Apply the filter and wait for the list to update.',
     'Only rows with status "Open" are displayed. The filter indicator shows the active filter.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '1.8', 'Navigation', 'Empty filtered state',
     'Filtering to no results shows the empty state',
     'Ensures users get clear feedback when no records match rather than a blank table.',
     'Logged in as test1@mail.com.',
     E'1. Navigate to /67/change-events.\n2. Type a random string (e.g., "zzznomatch999") in the search field.\n3. Wait for the list to update.',
     'The table body is empty and a "No change events found" / "Try adjusting your search or filters" message is displayed. No error banner.',
     'MEDIUM', 'scenario', '/67/change-events'),

    (v_suite_id, '1.9', 'Navigation', 'Detail page load',
     'Clicking a row navigates to the change event detail page',
     'Confirms the detail view is reachable from the list — broken row clicks block all downstream workflows.',
     'Logged in as test1@mail.com. At least one change event exists.',
     E'1. Navigate to /67/change-events.\n2. Click anywhere on a change event row.\n3. Wait for navigation to complete.',
     'The browser navigates to /67/change-events/<id>. The detail page loads with the change event title and general information visible. No 404 or error page.',
     'HIGH', 'scenario', '/67/change-events'),

    (v_suite_id, '1.10', 'Navigation', 'Pagination',
     'Pagination controls render and page 2 loads',
     'Ensures server-side pagination works — broken pagination hides data from users.',
     'Logged in as test1@mail.com. More than 25 change events exist, OR per-page can be reduced to 5.',
     E'1. Navigate to /67/change-events.\n2. If fewer than 26 items exist, change per-page to 5 using the per-page selector.\n3. Click the "Next page" button.\n4. Wait for the list to update.',
     'The table updates to show the next page of results. The page number indicator increments by 1. Results are different from page 1.',
     'MEDIUM', 'scenario', '/67/change-events');

  update public.test_suites
     set total_cases = (select count(*) from public.test_cases where suite_id = v_suite_id)
   where id = v_suite_id;

end $$;
