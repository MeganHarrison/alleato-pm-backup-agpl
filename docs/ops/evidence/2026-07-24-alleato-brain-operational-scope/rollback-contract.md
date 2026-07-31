# Phase 1B rollback contract

Phase 1B is a transactional, additive schema release. If any statement fails
during application, PostgreSQL rolls back the entire migration.

After a successful application, the safe operational rollback is to keep the
nullable columns and ledger dormant:

- Existing project-only meetings, tasks, files, and attribution rules continue
  to work.
- No Phase 2 content label is added by this migration.
- No branch-target attribution rule is created or activated.
- The migration ledger remains empty.
- Anonymous file reads remain revoked because restoring that legacy policy
  would reopen a confirmed security gap.

Physical DDL reversal is intentionally not automated. It is safe only while all
of these readbacks are zero:

```sql
select
  (select count(*) from public.meetings where business_area_id is not null)
    as meetings,
  (select count(*) from public.tasks where business_area_id is not null)
    as tasks,
  (select count(*) from public.files where business_area_id is not null)
    as files,
  (
    select count(*)
    from public.project_attribution_rules
    where business_area_id is not null or project_id is null
  ) as branch_rules,
  (select count(*) from public.business_area_migration_runs) as ledger_runs,
  (select count(*) from public.business_area_migration_items) as ledger_items;
```

Once Phase 2 starts, rollback must be data-level and run-scoped: use each ledger
item's `source_database`, `record_type`, `record_id`, prior project/Business
Area values, and `record_snapshot`, then mark that run and its items
`rolled_back`. The Phase 2 implementation must prove that a count mismatch
aborts the operation; it must never fall back to a broad table update. That
future behavior is not claimed as Phase 1B evidence.

The relaxed nullability is required for the target model and is harmless while
unused. Reinstating `NOT NULL`, dropping scope columns, or disabling RLS would
either block the planned transition or restore weaker legacy security, so those
actions require a separate reviewed migration with the zero-use preflight
above.
