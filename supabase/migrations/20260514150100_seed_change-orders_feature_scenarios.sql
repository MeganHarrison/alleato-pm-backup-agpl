-- Feature test suite seed: change-orders
-- Generated: 2026-05-14
-- Supabase project: lgveqfnpkxvzbnnwuled
-- Suite id: 96e8ff5a-8b51-4773-90ee-d8ae84b6f54c (37 cases)

insert into public.test_suites (tool_name, suite_type, display_name, total_cases)
values ('change-orders', 'feature', 'Change Orders — Feature', 0)
on conflict (tool_name, suite_type) do update set
  display_name      = excluded.display_name,
  last_generated_at = now()
returning id;

-- delete from public.test_cases where suite_id = <feature_suite_id>;

-- Full insert script mirrors the 37 cases seeded live via MCP on 2026-05-14.
-- Categories: Create (5), Edit (3), Delete (2), Status (4), LineItems (4),
--             Calculations (2), Attachments (2), Emails (2), RelatedItems (1),
--             Filters (3), Views (2), Export (2), History (1), Edge (4).
-- Re-run MCP execute_sql with the test_cases INSERT block from the
-- test-scenario-audit run to restore data if wiped.
