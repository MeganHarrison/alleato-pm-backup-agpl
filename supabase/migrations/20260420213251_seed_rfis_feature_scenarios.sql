-- Seed rfis FEATURE suite (26 consolidated cases).
-- Idempotent: re-running this file regenerates the suite + cases cleanly.

begin;
with s as (
  insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
  values ('rfis', 'feature', 'RFIs — Feature', 0)
  on conflict (tool_name, suite_type) do update set
    display_name      = excluded.display_name,
    last_generated_at = now()
  returning id
)
delete from public.test_cases where suite_id = (select id from s);
insert into public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
select s.id, v.test_number, v.category, v.subcategory, v.test_name,
       v.context_note, v.setup_steps, v.steps, v.expected_result, v.priority,
       'scenario', v.start_url
from public.test_suites s
cross join (values
  ('1.1', 'Create', 'Save as Draft',
   'Save an RFI as Draft with only a subject',
   'Draft RFIs only require a subject. Verifies the minimal happy path.',
   null::text,
   E'1. Click "Create RFI" on /67/rfis.\n2. Type "Smoke draft RFI" into the Subject field.\n3. Click "Save as Draft".\n4. Wait for the page to stop loading.',
   'The user returns to /67/rfis. A new row appears with Subject "Smoke draft RFI" and Status "Draft". No validation errors appeared.',
   'HIGH', '/67/rfis'),

  ('1.2', 'Create', 'Create Open (full)',
   'Create an Open RFI with all primary fields filled in',
   'Happy-path create for an Open RFI covering every required + common optional field.',
   null,
   E'1. Click "Create RFI" on /67/rfis.\n2. Type "Structural clarification needed at grid B-4" into Subject.\n3. Type "Please confirm the beam size at grid B-4 per drawing S-201." into Question.\n4. Pick a Due Date two weeks from today.\n5. Pick any RFI Manager from the dropdown.\n6. Type "Jane Contractor, John Architect" into Assignees.\n7. Type "ACME Structural" into Responsible Contractor.\n8. Type "Level 2 — North Wing" into Location.\n9. Select Schedule Impact = "Yes" and Cost Impact = "TBD".\n10. Click "Create Open".',
   'The user returns to /67/rfis. A new row appears with the typed Subject, Status "Open", the two assignees listed, and the correct due date. Opening the detail page shows every entered field persisted.',
   'HIGH', '/67/rfis'),

  ('1.3', 'Create', 'Required field validation',
   'Open submission blocks when required fields are missing',
   'Creating as Open requires Subject + Question + Due Date + at least one Assignee.',
   null,
   E'1. Click "Create RFI".\n2. Leave every field blank.\n3. Click "Create Open".',
   'The form does not submit. Inline error messages appear under Subject ("Subject is required"), Question ("Question is required for Open RFIs"), Due Date ("Due date is required for Open RFIs"), and Assignees ("At least one assignee is required for Open RFIs"). The URL remains /67/rfis/new.',
   'HIGH', '/67/rfis/new'),

  ('1.4', 'Create', 'Draft required subject',
   'Draft submission blocks when Subject is empty',
   'Draft has the single required field Subject.',
   null,
   E'1. Click "Create RFI".\n2. Leave Subject blank but type "some question" in Question.\n3. Click "Save as Draft".',
   'The form does not submit. An inline error "Subject is required" appears under the Subject field. The URL remains /67/rfis/new.',
   'MEDIUM', '/67/rfis/new'),

  ('1.5', 'Create', 'Cancel',
   'Cancel discards the new RFI and returns to list',
   'Verifies the Cancel action abandons the form without creating.',
   null,
   E'1. Click "Create RFI".\n2. Type "About to be cancelled" into Subject.\n3. Click "Cancel" in the form action bar.',
   'The user returns to /67/rfis. No new row with Subject "About to be cancelled" appears in the table.',
   'MEDIUM', '/67/rfis'),

  ('2.1', 'Edit', 'Happy path',
   'Edit all editable fields on an RFI and they persist',
   'Verifies every field is round-trippable via the edit form.',
   E'- An existing RFI is available (from 1.1 or already seeded).',
   E'1. Open any RFI detail page.\n2. Click Edit (three-dot menu > Edit).\n3. Change Subject to "Edited subject".\n4. Change Question to "Edited question text".\n5. Pick a new Due Date one month out.\n6. Change Schedule Impact to "No" and Cost Impact to "N/A".\n7. Change Responsible Contractor to "Updated Contractor".\n8. Click Save.\n9. Wait for navigation, then refresh the page.',
   'After save, the detail page exits edit mode and shows Subject "Edited subject", Question "Edited question text", the new due date, Schedule Impact "No", Cost Impact "N/A", and Responsible Contractor "Updated Contractor". After refresh all values remain.',
   'HIGH', '/67/rfis'),

  ('2.2', 'Edit', 'Cancel',
   'Cancelling an edit discards changes',
   'Verifies cancel does not persist unsaved changes.',
   E'- An existing RFI exists.',
   E'1. Open any RFI detail page. Note the current Subject.\n2. Click Edit.\n3. Change Subject to "About to be cancelled".\n4. Click Cancel.\n5. Wait for navigation.',
   'The detail page returns to read mode. Subject shows the original value, not "About to be cancelled".',
   'MEDIUM', '/67/rfis'),

  ('3.1', 'Delete', 'Happy path',
   'Delete an RFI via the detail header',
   'Covers the single-record delete flow.',
   E'- A disposable RFI (e.g. from 1.1) is available. Note its number.',
   E'1. Open that RFI detail page.\n2. Click the Delete action in the header (three-dot menu > Delete).\n3. Confirm in the AlertDialog.\n4. Wait for navigation back to /67/rfis.',
   'The user returns to /67/rfis. The deleted RFI row no longer appears in the table. A toast "RFI deleted" is visible briefly.',
   'HIGH', '/67/rfis'),

  ('3.2', 'Delete', 'Cancel',
   'Cancelling the delete dialog keeps the RFI',
   'Verifies the confirm dialog is cancellable.',
   E'- An existing RFI is available.',
   E'1. Open any RFI detail page. Note the RFI number.\n2. Click Delete in the header.\n3. Click Cancel in the AlertDialog.',
   'The dialog closes. The detail page still loads. Navigating back to /67/rfis still shows the RFI in the table.',
   'MEDIUM', '/67/rfis'),

  ('3.3', 'Delete', 'Row action',
   'Delete an RFI from the list row actions',
   'Covers the row-action delete flow in addition to the detail-level one.',
   E'- A disposable RFI is available. Note its number.',
   E'1. On /67/rfis, hover the disposable RFI row and open its row actions (three-dot menu).\n2. Click Delete.\n3. Confirm.',
   'The row disappears from the table. A toast "RFI deleted" is visible briefly.',
   'MEDIUM', '/67/rfis'),

  ('4.1', 'Status', 'Draft to Open',
   'Promote a Draft RFI to Open',
   'Verifies the "Open RFI" header action promotes a draft.',
   E'- A Draft RFI exists (use 1.1).',
   E'1. Open the Draft RFI detail page.\n2. Click "Open RFI" in the header.\n3. Wait for the status update.',
   'The status badge changes to "Open". The "Open RFI" button disappears and is replaced by "Close RFI".',
   'HIGH', '/67/rfis'),

  ('4.2', 'Status', 'Open to Closed',
   'Close an Open RFI',
   'Verifies the "Close RFI" header action.',
   E'- An Open RFI exists (use 4.1).',
   E'1. Open the Open RFI detail page.\n2. Click "Close RFI" in the header.',
   'The status badge changes to "Closed". The "Close RFI" button disappears and is replaced by "Reopen".',
   'HIGH', '/67/rfis'),

  ('4.3', 'Status', 'Reopen',
   'Reopen a Closed RFI',
   'Verifies the "Reopen" header action returns a closed RFI to Open.',
   E'- A Closed RFI exists (use 4.2).',
   E'1. Open the Closed RFI detail page.\n2. Click "Reopen" in the header.',
   'The status badge changes to "Open". The "Reopen" button disappears and is replaced by "Close RFI".',
   'MEDIUM', '/67/rfis'),

  ('5.1', 'Filters', 'Status filter roundtrip',
   'Status filter URL param syncs both directions',
   'Verifies the status query param is read on load AND written when the filter changes.',
   null,
   E'1. Navigate directly to /67/rfis?status=closed.\n2. Confirm the status filter pill shows "Closed".\n3. Clear the filter using the Clear button.',
   'On load, the URL already includes status=closed and all visible rows show Status "Closed". After clearing, the URL has no status param and all RFIs return.',
   'MEDIUM', '/67/rfis?status=closed'),

  ('6.1', 'Filters', 'Search match',
   'Search matches on number, subject, and manager',
   'Verifies the debounced search filters by the correct fields.',
   E'- At least one RFI with a known subject fragment.',
   E'1. Type a fragment of an RFI subject into the search box.\n2. Wait for the debounce.\n3. Clear the search.\n4. Type the RFI number into the search box.',
   'In both searches the table narrows to only rows matching the fragment/number. Clearing the search restores the full list.',
   'HIGH', '/67/rfis'),

  ('7.1', 'Filters', 'Sort',
   'Sort the list by RFI number',
   'Verifies column sort toggles direction.',
   E'- At least three RFIs exist.',
   E'1. Click the "#" column header.\n2. Note the order.\n3. Click the "#" column header a second time.',
   'The first click sorts ascending (or toggles the existing sort). The second click reverses the order. The URL includes sort=number and sort_dir=asc/desc.',
   'MEDIUM', '/67/rfis'),

  ('8.1', 'Filters', 'Column visibility',
   'Hide and restore a column',
   'Verifies the Columns menu hides and re-shows columns.',
   null,
   E'1. Open the Columns menu in the toolbar.\n2. Uncheck "RFI Manager".\n3. Re-check "RFI Manager".',
   'After unchecking, the RFI Manager column disappears from the table. After re-checking, it reappears in the same position.',
   'LOW', '/67/rfis'),

  ('9.1', 'Navigation', 'View switch',
   'Switch between table, card, and list views',
   'Verifies all three view modes render.',
   null,
   E'1. Switch view to Card. Inspect the output.\n2. Switch view to List. Inspect the output.\n3. Switch view back to Table.',
   'Each switch updates the layout and the URL (view=card, view=list, view=table). All three render without an error banner.',
   'MEDIUM', '/67/rfis'),

  ('10.1', 'Filters', 'Select all',
   'Select-all checkbox selects every filtered row',
   'Verifies bulk selection matches the filtered count.',
   E'- At least three RFIs exist.',
   E'1. On /67/rfis, click the header checkbox to select all.\n2. Inspect the "selected" indicator in the toolbar.\n3. Click the header checkbox again to deselect.',
   'After select-all, every row checkbox is checked and the toolbar shows the correct selected count. After deselecting, all checkboxes clear and the count returns to 0.',
   'LOW', '/67/rfis'),

  ('11.1', 'Workflow', 'Create Change Event',
   'Create a Change Event from an RFI',
   'Verifies the cross-tool "Create Change Event" header action.',
   E'- An RFI exists.',
   E'1. Open any RFI detail page.\n2. Click "Create Change Event" in the header.\n3. Wait for navigation.',
   'A new Change Event is created with origin "rfis" and origin_id set to the RFI id. The user is redirected to /67/change-events/<new-id>. A toast "Change event created from RFI" appears. The change event title matches the RFI subject.',
   'HIGH', '/67/rfis'),

  ('12.1', 'Workflow', 'Responses',
   'Post a response on the Responses section',
   'Verifies the collaboration comments panel accepts new responses.',
   E'- An Open RFI exists.',
   E'1. Open the RFI detail page.\n2. Scroll to the "Responses" section at the bottom.\n3. Type "Confirmed — use W14x26 per structural." into the composer.\n4. Submit the response.',
   'The response appears immediately in the Responses list attributed to the current user with a timestamp. Reloading the page still shows the response.',
   'HIGH', '/67/rfis'),

  ('13.1', 'Edit', 'Private flag',
   'Mark an RFI as Private',
   'Verifies the is_private flag toggles and persists.',
   E'- An RFI exists.',
   E'1. Open an RFI detail page and enter edit mode.\n2. Check the "Private" checkbox.\n3. Click Save.\n4. Refresh the page.',
   'After save, the detail shows the RFI as private (badge/indicator). After refresh, the private state persists. Unchecking the box in a subsequent edit restores the non-private state.',
   'MEDIUM', '/67/rfis'),

  ('14.1', 'Edit', 'Impact selects',
   'Schedule Impact and Cost Impact selects offer Yes / No / TBD / N/A',
   'Verifies the impact dropdowns expose all four options.',
   null,
   E'1. On /67/rfis/new, open the Schedule Impact select.\n2. Confirm the options.\n3. Open the Cost Impact select.\n4. Confirm the options.',
   'Both dropdowns offer exactly four options: Yes, No, TBD, N/A. Selecting each in turn shows the chosen label in the field.',
   'LOW', '/67/rfis/new'),

  ('15.1', 'Permissions', 'Read-only fallback',
   'RFI detail still loads when a user lacks edit permission',
   'Sanity check that non-admins at least see the detail in read mode.',
   E'- A non-admin test user is available, or simulate by observing the detail page in read mode.',
   E'1. Open any RFI detail page as the current test user.\n2. Confirm the header actions render without error.\n3. If the user lacks write permission, confirm the Edit and Delete actions are disabled or hidden (current implementation shows them to all test1@mail.com users).',
   'The detail page renders. If the user cannot edit, the UI does not throw; Edit/Delete are either hidden or disabled rather than producing a client error.',
   'LOW', '/67/rfis'),

  ('16.1', 'Edge', 'Long subject',
   'Very long subject renders without breaking layout',
   'Verifies the list and detail page handle long text gracefully.',
   null,
   E'1. Create an RFI with a 250-character Subject (any repeated text).\n2. Save as draft.\n3. Inspect the row in the table and the detail page.',
   'The row shows the subject truncated with ellipsis (or wrapped) without overflowing the table. The detail page renders the full subject without breaking the header layout.',
   'LOW', '/67/rfis'),

  ('16.2', 'Edge', 'Assignees parsing',
   'Assignees comma-separated input parses correctly',
   'Verifies the Assignees input splits on comma and trims whitespace.',
   null,
   E'1. On /67/rfis/new, type "  Alice ,Bob,  Charlie  " into Assignees.\n2. Save as Draft.\n3. Open the new RFI detail page.',
   'The RFI detail shows Assignees as exactly three entries: Alice, Bob, Charlie (trimmed). The list page shows these three names in the Assignees column.',
   'LOW', '/67/rfis/new')
) as v(test_number, category, subcategory, test_name, context_note, setup_steps, steps, expected_result, priority, start_url)
where s.tool_name = 'rfis' and s.suite_type = 'feature';
update public.test_suites
   set total_cases = (select count(*) from public.test_cases where suite_id = test_suites.id)
 where tool_name = 'rfis' and suite_type = 'feature';
commit;
