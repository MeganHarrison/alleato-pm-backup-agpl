# RLS Migration Ordering Caution

**Written:** 2026-05-15  
**Context:** Phase 1.6 follow-up after parallel Wave 3 execution

---

## The Incident

During Wave 3 of the Phase 1.5/1.6 RLS enforcement work, two agents ran migrations concurrently:

- **Agent L** applied a performance-wrap migration that modified multiple tables' RLS policies to use `(select auth.uid())` instead of bare `auth.uid()`.
- **Agent M** applied new project-scoped RLS policies to `owner_invoices` replacing the permissive `auth.uid() IS NOT NULL` pattern.

Both migrations targeted `owner_invoices`. Agent L's perf-wrap migration ran after Agent M's project-scoped migration — and because Agent L's migration used `CREATE OR REPLACE POLICY` (or `DROP + CREATE`) on the same policy names, it silently overwrote Agent M's more restrictive policies with the looser perf-wrapped versions.

Agent M detected this during post-migration verification and re-applied the project-scoped policies. The final state was correct, but the incident reveals a real hazard.

---

## Current State (verified 2026-05-15)

`owner_invoices` has the correct project-scoped policies:

```sql
-- All 4 operations (select/insert/update/delete) use:
current_is_app_admin()
OR (EXISTS (
  SELECT 1 FROM prime_contracts pc
  WHERE pc.id = owner_invoices.prime_contract_id
    AND pc.project_id IS NOT NULL
    AND current_is_project_member(pc.project_id)
))
```

No permissive `auth.uid() IS NOT NULL` pattern remains on this table.

---

## The Hazard: Silent Policy Overwrite

When two migrations both touch RLS policies on the same table:

1. Migration A creates policy `foo_select` with logic X.
2. Migration B (perf-wrap, running later) drops and recreates `foo_select` with logic Y.
3. Migration B "wins" — X is gone with no error or warning.
4. The DB applies migrations in the order they are executed. Supabase applies them in filename-alphabetical order by timestamp. Whichever migration has the later timestamp wins on conflicting policy names.

This is not caught by the migration system — there is no "conflict detection" for RLS policy rewrites.

---

## How to Avoid This in Future Waves

### 1. Sequence RLS migrations, never parallelize them on the same table

If Wave N has:
- A "perf-wrap" migration that touches policy bodies
- A "security tighten" migration that replaces policy logic

These must be applied in a defined order. The security tighten migration should always have a **later timestamp** than the perf-wrap, so it wins if both touch the same table.

Alternatively: merge them into one migration.

### 2. The perf-wrap migration should be a prerequisite, not concurrent

Agent L's perf-wrap (wrapping `auth.uid()` calls) is a mechanical transform. It should run first, then Agent M's security policy replacements layer on top. Never the reverse.

### 3. Post-migration verification must check policy bodies, not just existence

A verification step like:

```sql
select policyname, qual from pg_policies
where tablename = 'owner_invoices'
  and qual like '%auth.uid() IS NOT NULL%';
```

...would immediately flag the overwrite. Add this to the Wave verification checklist.

### 4. Use descriptive, version-tagged policy names when introducing breaking changes

Instead of `owner_invoices_select`, consider `owner_invoices_select_v2` for a fundamentally different policy. This forces the old policy to be explicitly dropped — it cannot be silently overwritten by a perf-wrap that targets the old name.

The downside is namespace pollution. The upside is no silent overwrites.

---

## Wave Planning Checklist Addition

For any future Wave that includes multiple agents touching RLS policies:

- [ ] List all tables each agent will modify RLS policies on
- [ ] Check for overlaps — if two agents share a table, merge into one migration or enforce strict ordering
- [ ] Perf-wrap migrations run BEFORE security tighten migrations (lower timestamp)
- [ ] Post-wave verification queries `pg_policies` and checks `qual` for expected content, not just existence
