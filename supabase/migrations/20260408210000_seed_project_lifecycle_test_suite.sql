-- ============================================================================
-- Seed: Project Lifecycle End-to-End Test Suite
-- Generated: 2026-04-08
-- Suite: project-lifecycle
-- Type: scenario (sequential guided test — data from earlier phases is used
--        in later phases; tester carries context forward throughout the session)
-- Runner: http://localhost:3000/testing
-- 35 scenarios across 7 phases
-- ============================================================================

-- Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('project-lifecycle', 'Project Lifecycle', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Insert all scenarios
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'project-lifecycle')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

  -- ── Phase 1: Project Setup ───────────────────────────────────────────────────

  ((SELECT id FROM suite), '1.1', 'Project Setup', 'Open project',
   'Open an existing project',
   'This is the entry point for the whole lifecycle. You are opening the Alleato AI project. Everything else in this test matrix builds on the project being accessible here.',
   'Log in as test1@mail.com before starting.',
   E'1. Navigate to http://localhost:3000/67\n2. Wait for the project home/dashboard page to load\n3. Observe the project name and any summary cards',
   'The page loads without errors. The project name is visible in the header or sidebar. No spinner remains on screen.',
   'HIGH', 'scenario', '/67'),

  ((SELECT id FROM suite), '1.2', 'Project Setup', 'Verify details',
   'Verify project details are correct',
   'You are checking the administrative details of the project before doing any financial work. The project number and address will be referenced throughout the lifecycle.',
   'Complete test 1.1 first.',
   E'1. From the project home, navigate to project Settings or the Project Overview page\n2. Verify that the following fields are populated: Project Name, Project Number, Address, Start Date, Estimated Completion Date\n3. Note the project number — you will reference it throughout the lifecycle',
   'All key project fields display real data (not "—" or empty). The project address is visible. No field shows a loading spinner. The project number is clearly displayed.',
   'HIGH', 'scenario', '/67'),

  ((SELECT id FROM suite), '1.3', 'Project Setup', 'Team members',
   'Check team members are present',
   'Confirm the project team is set up so that later steps (assigning owners to contracts, vendors to commitments, etc.) have people and companies to select in dropdowns.',
   NULL,
   E'1. Navigate to the project directory or members page\n2. Look for at least one person with a Project Manager role\n3. Look for at least one Owner/Client company listed',
   'The directory loads with at least 2–3 team members. Role labels are visible (Project Manager, Owner, Superintendent, etc.). At least one company is listed as an owner or client.',
   'MEDIUM', 'scenario', '/67/directory'),

  ((SELECT id FROM suite), '1.4', 'Project Setup', 'Permissions check',
   'Verify project permissions allow creating records',
   'Before creating any financial records, confirm you have write access. If the Create buttons are missing, stop and fix permissions before proceeding with the lifecycle.',
   NULL,
   E'1. Navigate to /67/budget\n2. Look for a "New Line Item" or "Add" button in the toolbar or header\n3. Navigate to /67/prime-contracts and look for a "Create" button\n4. Navigate to /67/change-events and look for a "New Change Event" button',
   'All three pages show a primary action button. If any Create/Add buttons are missing, the logged-in user lacks write permission and the lifecycle cannot proceed until permissions are corrected.',
   'HIGH', 'scenario', '/67'),

  -- ── Phase 2: Budget ──────────────────────────────────────────────────────────

  ((SELECT id FROM suite), '2.1', 'Budget', 'Create line items',
   'Add 3 budget line items for major cost divisions',
   'You are creating the original budget. These line items become the baseline for all financial tracking — prime contract SOV (Phase 3), commitments (Phase 4), and pay applications (Phase 7) all reference these cost divisions.',
   'The budget page must load without errors. At least 3 cost codes must exist in the system.',
   E'1. Navigate to /67/budget\n2. Click "New Line Item"\n3. Set Cost Code = first available code (e.g. 03-000 Concrete), Description = "Concrete & Foundation", Original Budget = 85000\n4. Save\n5. Click "New Line Item"\n6. Set Cost Code = second available code (e.g. 16-000 Electrical), Description = "Electrical Systems", Original Budget = 120000\n7. Save\n8. Click "New Line Item"\n9. Set Cost Code = third available code (e.g. 09-000 Finishes), Description = "Interior Finishes", Original Budget = 65000\n10. Save',
   'Three new rows appear in the budget table. The Original Budget summary total at the top updates to $270,000. No error toasts appear. All three line items are visible after saving.',
   'HIGH', 'scenario', '/67/budget'),

  ((SELECT id FROM suite), '2.2', 'Budget', 'Verify totals',
   'Verify budget totals update correctly',
   'Confirm the summary numbers at the top of the Budget page match the individual line items created in 2.1.',
   'Complete test 2.1 first.',
   E'1. Stay on or return to /67/budget\n2. Note the "Original Budget" summary total shown at the top of the page\n3. Add up the Original Budget values from the individual line item rows\n4. Compare the sum to the displayed total',
   'The summary total equals the sum of all visible line item rows (within $1 rounding). If Concrete ($85,000) + Electrical ($120,000) + Finishes ($65,000) were added, the total reads $270,000.',
   'HIGH', 'scenario', '/67/budget'),

  ((SELECT id FROM suite), '2.3', 'Budget', 'Edit and persist',
   'Edit a budget line item amount and verify it persists',
   'Budgets often need adjustment early on. Testing that edits persist confirms data is being written to the database.',
   'Complete test 2.1 first.',
   E'1. Click on the "Concrete & Foundation" line item to open/edit it\n2. Change Original Budget from 85000 to 90000\n3. Save\n4. Press Ctrl+R (or Cmd+R on Mac) to refresh the page',
   'After refresh, the "Concrete & Foundation" row shows $90,000. The summary total updates to $275,000. The change persisted through a full page reload.',
   'HIGH', 'scenario', '/67/budget'),

  ((SELECT id FROM suite), '2.4', 'Budget', 'Cost code grouping',
   'Check the budget breakdown / cost code grouping',
   'The budget should organize line items by cost division. This confirms groupings are logical before the project owner or PM reviews the budget.',
   'Complete test 2.1 first.',
   E'1. On /67/budget, scan the table for any grouping headers or sort order\n2. If a "Group by" or "View" toggle exists, switch to a grouped view\n3. Confirm each of your three line items appears under an appropriate cost code heading',
   'Line items appear organized by cost code — either alphabetically, numerically by division, or under collapsible group headers. No line items are hidden behind collapsed groups that cannot be opened.',
   'MEDIUM', 'scenario', '/67/budget'),

  ((SELECT id FROM suite), '2.5', 'Budget', 'Record total for comparison',
   'Record the final budget total for comparison in Phase 3',
   'This step documents the budget total so you can cross-check it against the prime contract value in test 3.3. Write down the number before proceeding.',
   'Complete tests 2.1–2.3 first.',
   E'1. Open /67/budget\n2. Note the total Original Budget figure from the summary at the top of the page\n3. Write it down — you will use this number in test 3.3 (expected: $275,000)',
   'A clear total is visible on the budget page. The tester records it before continuing to Phase 3.',
   'HIGH', 'scenario', '/67/budget'),

  -- ── Phase 3: Prime Contract ──────────────────────────────────────────────────

  ((SELECT id FROM suite), '3.1', 'Prime Contract', 'Create contract',
   'Create a new prime contract with required fields',
   'The prime contract is the master agreement between the owner and the general contractor. Use the contract number PC-LIFECYCLE-001 exactly — later phases reference this contract by name.',
   NULL,
   E'1. Navigate to /67/prime-contracts\n2. Click the "Create" button\n3. In Contract #, type: PC-LIFECYCLE-001\n4. In Title, type: Vermillion Rise — Prime Contract\n5. Set Status to Draft\n6. In the Owner/Client dropdown, select any available owner company\n7. In the Contractor dropdown, select any available general contractor\n8. In Start Date, enter 2026-01-15\n9. In Estimated Completion Date, enter 2026-12-15\n10. In Default Retainage, type: 10\n11. Click Save',
   'A success toast appears. The app navigates to the detail page for "Vermillion Rise — Prime Contract" (PC-LIFECYCLE-001). Status shows Draft, retainage shows 10%, and the dates are correct. The contract appears in the list at /67/prime-contracts.',
   'HIGH', 'scenario', '/67/prime-contracts/new'),

  ((SELECT id FROM suite), '3.2', 'Prime Contract', 'Add SOV line items',
   'Add Schedule of Values line items that mirror the budget',
   'The SOV breaks the contract price into individual work items. Add three items that match the budget divisions from Phase 2 — this enables accurate pay applications in Phase 7.',
   'PC-LIFECYCLE-001 must exist (complete test 3.1 first). The SOV tab must be accessible.',
   E'1. Open the detail page for PC-LIFECYCLE-001\n2. Click the "Schedule of Values" tab\n3. Click "Add Line Item"\n4. Description = "Concrete & Foundation Work", Scheduled Value = 90000\n5. Save\n6. Click "Add Line Item"\n7. Description = "Electrical Systems", Scheduled Value = 120000\n8. Save\n9. Click "Add Line Item"\n10. Description = "Interior Finishes", Scheduled Value = 65000\n11. Save',
   'All three SOV line items appear in the Schedule of Values table with correct Scheduled Values. The "Original Contract Amount" in the contract summary updates to $275,000. No errors appear.',
   'HIGH', 'scenario', '/67/prime-contracts'),

  ((SELECT id FROM suite), '3.3', 'Prime Contract', 'Contract value vs budget',
   'Verify contract value matches the budget total from Phase 2',
   'Cross-check: the prime contract Original Contract Amount should equal the budget total you recorded at the end of Phase 2 ($275,000 in the example).',
   'Complete tests 2.5 and 3.2 first.',
   E'1. Open the detail page for PC-LIFECYCLE-001\n2. Note the "Original Contract Amount" figure in the contract header or overview\n3. Compare it to the budget total you recorded in test 2.5',
   'The Original Contract Amount ($275,000) matches the budget total from Phase 2. The contract summary clearly displays the total without requiring a page refresh.',
   'HIGH', 'scenario', '/67/prime-contracts'),

  ((SELECT id FROM suite), '3.4', 'Prime Contract', 'Approve contract',
   'Change the contract status to Approved and mark as Executed',
   'Moving the contract from Draft to Approved simulates the owner signing the contract. Approved + Executed status is required for pay applications in Phase 7.',
   'Complete test 3.1 first.',
   E'1. Open the detail page for PC-LIFECYCLE-001\n2. Click Edit\n3. In the Status dropdown, select "Approved" (or the closest available approved status)\n4. Check the "Executed" checkbox\n5. Click Save',
   'The status badge updates to "Approved". The Executed field shows Yes/checked. A success toast appears. No error messages.',
   'HIGH', 'scenario', '/67/prime-contracts'),

  ((SELECT id FROM suite), '3.5', 'Prime Contract', 'SOV persists after refresh',
   'Verify SOV line items persist after a page refresh',
   'Confirm the SOV data was actually written to the database and not just held in browser memory.',
   'Complete test 3.2 first.',
   E'1. Open PC-LIFECYCLE-001 and click the "Schedule of Values" tab\n2. Press Ctrl+R (or Cmd+R) to refresh\n3. Confirm all three SOV line items are still present',
   'After refresh, all three SOV line items ("Concrete & Foundation Work", "Electrical Systems", "Interior Finishes") are still visible with their original dollar amounts. Nothing reverted to blank.',
   'MEDIUM', 'scenario', '/67/prime-contracts'),

  -- ── Phase 4: Commitments ─────────────────────────────────────────────────────

  ((SELECT id FROM suite), '4.1', 'Commitments', 'Create framing subcontract',
   'Create a framing subcontractor commitment',
   'A commitment is a contract between the general contractor and a subcontractor. Use SC-FRAME-001 exactly — this number is referenced in Phase 5 (change event) and Phase 6 (change order).',
   'At least one subcontractor company must exist in the project directory.',
   E'1. Navigate to /67/commitments\n2. Click "Create" (or "New Commitment")\n3. In Contract #, type: SC-FRAME-001\n4. In Title, type: Framing Subcontract\n5. In the Vendor/Subcontractor dropdown, select any available subcontractor\n6. Set Status to Draft\n7. In Start Date, enter 2026-02-01\n8. In Completion Date, enter 2026-06-30\n9. Click Save',
   'SC-FRAME-001 "Framing Subcontract" is created. The app navigates to its detail page. Status shows Draft. The commitment appears in the list at /67/commitments.',
   'HIGH', 'scenario', '/67/commitments/new'),

  ((SELECT id FROM suite), '4.2', 'Commitments', 'Add line items',
   'Add line items to the framing commitment',
   'Commitment line items describe exactly what the subcontractor will do and for how much. These amounts should reduce the budget''s "committed" balance.',
   'Complete test 4.1 first.',
   E'1. Open the detail page for SC-FRAME-001 (Framing Subcontract)\n2. Go to the Line Items tab or section\n3. Click "Add Line Item"\n4. Description = "Wall Framing", Amount = 45000\n5. Save\n6. Click "Add Line Item"\n7. Description = "Roof Framing", Amount = 35000\n8. Save',
   'Both line items appear in the commitment. The commitment total updates to $80,000. The line items persist after a page refresh.',
   'HIGH', 'scenario', '/67/commitments'),

  ((SELECT id FROM suite), '4.3', 'Commitments', 'Budget rollup',
   'Verify commitment rolls up to the budget',
   'The Budget page should reflect committed amounts from the framing subcontract. Look for a "Committed Costs" or equivalent column — this confirms the budget and commitments are integrated.',
   'Complete tests 4.1 and 4.2 first.',
   E'1. Navigate to /67/budget\n2. Find the cost code row corresponding to the framing work\n3. Look for a "Committed Costs" or "Commitments" column in the budget table\n4. Compare the committed amount against the $80,000 framing subcontract total',
   'The budget shows at least $80,000 in the Committed Costs column (or equivalent). If cost codes were linked in 4.2, the specific code row reflects $80,000. The overall committed column in the budget summary includes the framing commitment amount.',
   'HIGH', 'scenario', '/67/budget'),

  ((SELECT id FROM suite), '4.4', 'Commitments', 'Create electrical subcontract',
   'Create a second commitment for electrical work',
   'Creating a second commitment confirms the list handles multiple subs correctly. The electrical commitment also sets up a realistic context for the change event in Phase 5.',
   NULL,
   E'1. Navigate to /67/commitments and click "Create"\n2. Contract # = SC-ELEC-001, Title = Electrical Subcontract\n3. Select a subcontractor vendor\n4. Set Status to Draft\n5. Click Save\n6. Add one line item: Description = "Electrical Rough-In", Amount = 95000\n7. Save',
   'SC-ELEC-001 appears in the commitments list alongside SC-FRAME-001. The line item saves correctly. The commitment total shows $95,000.',
   'MEDIUM', 'scenario', '/67/commitments/new'),

  ((SELECT id FROM suite), '4.5', 'Commitments', 'Approve commitment',
   'Change a commitment status to Approved',
   'Approved commitments are locked-in costs. Simulates the GC signing the framing subcontractor''s contract.',
   'Complete test 4.1 first.',
   E'1. Open SC-FRAME-001 (Framing Subcontract)\n2. Click Edit\n3. Change Status to Approved (or the closest available status)\n4. Click Save',
   'The status badge updates to Approved. A success toast appears. The status persists after refreshing the page.',
   'MEDIUM', 'scenario', '/67/commitments'),

  -- ── Phase 5: Change Events ───────────────────────────────────────────────────

  ((SELECT id FROM suite), '5.1', 'Change Events', 'Create change event',
   'Create a change event for owner-requested additional electrical outlets',
   'A Change Event captures a potential scope change before it becomes a formal change order. Use CE-001 exactly — this is promoted into PCO-001 in Phase 6. Link it to PC-LIFECYCLE-001.',
   NULL,
   E'1. Navigate to /67/change-events\n2. Click "New Change Event" (or "Create")\n3. In Number, type: CE-001 (or accept the auto-generated number)\n4. In Title, type: Additional Electrical Outlets — Owner Request\n5. In Description, type: Owner has requested 24 additional duplex outlets in the office area per RFI #12\n6. Set Status to Open\n7. Link to Prime Contract: select PC-LIFECYCLE-001\n8. Click Save',
   'Change Event CE-001 is created and appears in the change events list. Title "Additional Electrical Outlets — Owner Request" is visible. Status shows Open. The linked prime contract is shown on the detail page.',
   'HIGH', 'scenario', '/67/change-events/new'),

  ((SELECT id FROM suite), '5.2', 'Change Events', 'Attach cost items',
   'Attach cost line items to the change event',
   'Cost items quantify the financial impact of the scope change. You are estimating the cost of the additional electrical outlets. These costs become the basis for PCO-001 in Phase 6.',
   'Complete test 5.1 first.',
   E'1. Open the detail page for CE-001\n2. Navigate to the Cost Items or Line Items section/tab\n3. Click "Add Cost Item"\n4. Description = "Additional Duplex Outlets (24 units)", Estimated Cost = 8500\n5. Link to the Electrical cost code if prompted\n6. Save\n7. Click "Add Cost Item"\n8. Description = "Additional Conduit & Wire", Estimated Cost = 3200\n9. Save',
   'Both cost items appear on the change event detail page. The Total Estimated Cost shown on CE-001 reflects $11,700. Status remains Open.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '5.3', 'Change Events', 'Visible in list',
   'Verify change event shows in the list with correct status',
   'Confirm the change event is visible to anyone checking the change events list — not hidden or accidentally filtered out.',
   'Complete test 5.1 first.',
   E'1. Navigate to /67/change-events\n2. Scan the list for CE-001 "Additional Electrical Outlets — Owner Request"\n3. Confirm the Status column shows "Open"\n4. Confirm the Total Cost or Estimated Cost column shows approximately $11,700',
   'CE-001 is visible in the list. Status column shows Open. The estimated cost (~$11,700) is displayed. No filtering is hiding the record.',
   'HIGH', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '5.4', 'Change Events', 'Edit description',
   'Edit the change event description and verify it saves',
   'Testing that edits to a change event persist correctly.',
   'Complete test 5.1 first.',
   E'1. Open CE-001\n2. Click Edit\n3. Append to the Description: " — Approved verbally by John Smith on 2026-02-15"\n4. Click Save',
   'The updated description is shown on the detail page. A success toast appears. Refreshing the page confirms the appended text is still there.',
   'MEDIUM', 'scenario', '/67/change-events'),

  ((SELECT id FROM suite), '5.5', 'Change Events', 'Pending changes summary',
   'Check the pending changes summary includes CE-001',
   'The system should aggregate open change events into a pending changes total. This total shows the financial exposure from unapproved scope changes.',
   'Complete tests 5.1 and 5.2 first.',
   E'1. Stay on or return to /67/change-events\n2. Look for a summary row, footer, or header card showing Total Pending Changes or Total Open\n3. Note whether CE-001''s cost ($11,700) is included in that figure',
   'A summary total is visible (header card, table footer, or sidebar). The amount includes CE-001''s estimated cost ($11,700). If other open change events exist, the total is their combined sum.',
   'HIGH', 'scenario', '/67/change-events'),

  -- ── Phase 6: Change Orders ───────────────────────────────────────────────────

  ((SELECT id FROM suite), '6.1', 'Change Orders', 'Generate PCO from change event',
   'Generate a PCO from change event CE-001',
   'A PCO (Potential Change Order) is the formal document sent to the owner requesting approval for a scope change. You are promoting CE-001 into PCO-001. Use PCO-001 exactly — it is tracked through approval in this phase.',
   'Complete Phase 5 first. CE-001 must exist and be linked to PC-LIFECYCLE-001.',
   E'1. Navigate to /67/change-orders\n2. Click "Create" or "New Change Order"\n3. In Number, type: PCO-001\n4. In Title, type: PCO — Additional Electrical Outlets\n5. Link to Change Event: select CE-001\n6. Link to Prime Contract: select PC-LIFECYCLE-001\n7. Set Amount to 11700\n8. Set Status to Draft (or Pending)\n9. Click Save',
   'PCO-001 appears in the change orders list. It is linked to CE-001. The amount shows $11,700. Status is Draft/Pending.',
   'HIGH', 'scenario', '/67/change-orders/new'),

  ((SELECT id FROM suite), '6.2', 'Change Orders', 'Approve PCO',
   'Review and approve PCO-001',
   'Approving the PCO means the owner has agreed to pay for the additional electrical work. After approval, the budget and prime contract totals should update.',
   'Complete test 6.1 first.',
   E'1. Open the detail page for PCO-001\n2. Click Edit\n3. Change Status to Approved\n4. Click Save\n5. Note the approved amount ($11,700)',
   'The status badge updates to Approved. A success toast appears. The approved amount ($11,700) is clearly displayed. Status persists after a page refresh.',
   'HIGH', 'scenario', '/67/change-orders'),

  ((SELECT id FROM suite), '6.3', 'Change Orders', 'Budget impact',
   'Verify the budget reflects the approved change order',
   'An approved change order should appear in the budget''s "Approved Changes" column and increase the Revised Budget total from $275,000 to $286,700.',
   'Complete tests 6.1 and 6.2 first.',
   E'1. Navigate to /67/budget\n2. Look for an "Approved Changes" or "Owner Change Orders" column\n3. Find the electrical cost code row — note whether $11,700 appears\n4. Check the overall budget summary — Revised Budget total should be $286,700',
   'The budget shows $11,700 in the Approved Changes column. The Revised Budget total is $286,700 ($275,000 original + $11,700). The Original Budget column still shows $275,000.',
   'HIGH', 'scenario', '/67/budget'),

  ((SELECT id FROM suite), '6.4', 'Change Orders', 'Prime contract revised amount',
   'Verify the prime contract Revised Amount updated to reflect PCO-001',
   'Approving a change order against a prime contract must increase the contract''s Revised Contract Amount. This confirms the financial data flows correctly from change orders to the contract.',
   'Complete tests 6.1 and 6.2 first.',
   E'1. Open the detail page for PC-LIFECYCLE-001\n2. Look at the "Revised Contract Amount" in the contract summary\n3. Compare to the Original Contract Amount ($275,000) — it should now be $286,700\n4. Click the "Change Orders" tab and confirm PCO-001 is listed with amount $11,700 and status Approved',
   'The Revised Contract Amount shows $286,700. The Original Contract Amount still shows $275,000. The Change Orders tab lists PCO-001 with amount $11,700 and status Approved.',
   'HIGH', 'scenario', '/67/prime-contracts'),

  ((SELECT id FROM suite), '6.5', 'Change Orders', 'Traceability: CE links to PCO',
   'Check that change event CE-001 links back to PCO-001',
   'Traceability check — navigating from a change event to its resulting change order should work in both directions. This confirms the data linkage is intact.',
   'Complete tests 5.1 and 6.1 first.',
   E'1. Open CE-001 (Additional Electrical Outlets — Owner Request)\n2. Look for a linked Change Orders section on the detail page\n3. Confirm PCO-001 is listed as a linked change order\n4. Click on PCO-001 to navigate to its detail page',
   'CE-001 shows PCO-001 in its linked change orders section. Clicking PCO-001 navigates to its detail page without a 404 error. The detail page shows the correct title and amount.',
   'MEDIUM', 'scenario', '/67/change-events'),

  -- ── Phase 7: Invoicing ───────────────────────────────────────────────────────

  ((SELECT id FROM suite), '7.1', 'Invoicing', 'Create pay application',
   'Create a pay application (PA-001) against the prime contract',
   'A Pay Application is the invoice the GC submits to the owner at the end of each billing period. It is always billed against a prime contract. Use PA-001 and link it to PC-LIFECYCLE-001.',
   'PC-LIFECYCLE-001 must be in Approved status (complete test 3.4 first).',
   E'1. Navigate to /67/invoices (or /67/pay-applications)\n2. Click "Create"\n3. In Application Number, type: PA-001 (or accept the auto-generated number)\n4. Link to Prime Contract: select PC-LIFECYCLE-001\n5. Set Period From: 2026-01-15\n6. Set Period To: 2026-02-28\n7. Click Save',
   'PA-001 is created and linked to PC-LIFECYCLE-001. The app navigates to the pay app detail page. Period dates are saved correctly. No error messages appear.',
   'HIGH', 'scenario', '/67/invoices/new'),

  ((SELECT id FROM suite), '7.2', 'Invoicing', 'Add line items with percent complete',
   'Add SOV line items with percent complete to PA-001',
   'You are marking how much of each SOV line item has been completed in this billing period. Use the three SOV items from Phase 3: Concrete & Foundation ($90,000), Electrical Systems ($120,000), Interior Finishes ($65,000).',
   'Complete tests 3.2 and 7.1 first. The SOV must have all three line items.',
   E'1. Open the detail page for PA-001\n2. Find the Schedule of Values / Line Items section\n3. For "Concrete & Foundation Work", set % Complete to 100\n4. For "Electrical Systems", set % Complete to 40\n5. For "Interior Finishes", set % Complete to 0\n6. Click Save (or "Calculate")',
   'Amounts calculate correctly: Concrete $90,000 (100%), Electrical $48,000 (40% of $120,000), Finishes $0 (0%). Gross Amount This Period = $138,000. Retainage (10%) = $13,800. Net Amount Due = $124,200. All totals display without errors.',
   'HIGH', 'scenario', '/67/invoices'),

  ((SELECT id FROM suite), '7.3', 'Invoicing', 'Verify invoice totals',
   'Verify the pay application totals are mathematically correct',
   'Cross-check the arithmetic. The totals on the pay app must match the line item percentages applied to the SOV scheduled values.',
   'Complete test 7.2 first.',
   E'1. Open PA-001\n2. Review these summary figures:\n   - Scheduled Value Total: should be $275,000 (or $286,700 if change order SOV was added)\n   - Work Completed This Period: should be $138,000\n   - Retainage Withheld: should be $13,800 (10% of $138,000)\n   - Net Payment Due: should be $124,200\n3. Verify each figure matches the calculations from test 7.2',
   'All summary totals match expected calculated values within $1 rounding. The pay application clearly displays "Net Amount Due" = $124,200. No columns are blank or showing $0 when they should have values.',
   'HIGH', 'scenario', '/67/invoices'),

  ((SELECT id FROM suite), '7.4', 'Invoicing', 'Submit pay application',
   'Change pay application status to Submitted',
   '"Submitted" means the GC has sent the pay app to the owner for review. This is a key workflow milestone and may trigger notifications or approval workflows.',
   'Complete test 7.1 first.',
   E'1. Open PA-001\n2. Click Edit (or look for a "Submit" action button)\n3. Change the status to Submitted\n4. Click Save',
   'The status badge updates to Submitted. Status persists after a page refresh. If a "Submitted Date" field exists, it is populated with today''s date.',
   'HIGH', 'scenario', '/67/invoices'),

  ((SELECT id FROM suite), '7.5', 'Invoicing', 'Pay app on prime contract invoices tab',
   'Verify PA-001 appears on the prime contract''s Invoices tab',
   'Traceability check — the pay application created against PC-LIFECYCLE-001 should be visible under that contract''s Invoices tab. Confirms the invoice-to-contract link is intact.',
   'Complete tests 7.1 and 7.4 first.',
   E'1. Open the detail page for PC-LIFECYCLE-001\n2. Click the "Invoices" tab\n3. Look for PA-001 in the list\n4. Click on PA-001 to navigate to its detail page',
   'PA-001 appears in the Invoices tab with the correct amount ($124,200 net or $138,000 gross) and status "Submitted". Clicking on PA-001 navigates to the pay application detail page without a 404 error.',
   'HIGH', 'scenario', '/67/prime-contracts')

ON CONFLICT (suite_id, test_number) DO UPDATE SET
  category        = EXCLUDED.category,
  subcategory     = EXCLUDED.subcategory,
  test_name       = EXCLUDED.test_name,
  context_note    = EXCLUDED.context_note,
  setup_steps     = EXCLUDED.setup_steps,
  steps           = EXCLUDED.steps,
  expected_result = EXCLUDED.expected_result,
  priority        = EXCLUDED.priority,
  test_type       = EXCLUDED.test_type,
  start_url       = EXCLUDED.start_url,
  updated_at      = now();
-- Update total_cases count
UPDATE public.test_suites
SET total_cases = (
  SELECT count(*) FROM public.test_cases
  WHERE suite_id = test_suites.id AND test_type = 'scenario'
)
WHERE tool_name = 'project-lifecycle';
