---
title: Schema rename drift
description: A database column is renamed but call sites referencing the old name are not all updated. The compiler does not catch literal-string column references in Supabase .select() calls.
---

# Pattern: Schema Rename Drift

**Severity:** MEDIUM (silent until a specific route is hit, then 5xx)
**Triggers:** column rename, "column X does not exist", `.select(`, Postgres 42703, schema migration without consumer sweep

---

## The Mistake

A column is renamed in the database (e.g. `"job number"` → `project_number`) and the type generation is run. TypeScript sees the new shape on typed access patterns. **But Supabase `.select()` strings are not typechecked** — a literal `"job number"` in a select string keeps compiling indefinitely and fails only at runtime.

The same applies to:
- `.eq("job number", value)`
- `.order("job number")`
- Any string-based column reference in a Supabase query builder call

---

## Real Incident — 2026-05-18 telemetry

| Route | Events | Cause |
|---|---|---|
| `GET /api/projects/[projectId]/shell` | 6 | `.select(..., "job number", ...)` after `project_number` rename |

The rename migration shipped. Type generation ran. Four other files in the codebase still referenced `"job number"` as a literal string and silently kept compiling for **5 days** before users hit the route.

---

## The Fix

Sweep every literal reference after a rename. There's no shortcut — Postgres error 42703 is the only signal you'll get otherwise.

```bash
# After renaming column "X" → "Y" in a migration:
grep -rn '"X"\|\.X\b' frontend/ backend/ --include='*.ts' --include='*.tsx' --include='*.py' \
  | grep -v node_modules
# Update every match. Pay attention to .select(), .eq(), .order(), .or(), .filter() strings.
```

If the column has spaces (legacy: `"job number"`), the rename should also prefer snake_case (`project_number`) to eliminate PostgREST quirks (see `postgrest-embed-ambiguity.md`).

---

## The Discipline

A column-rename migration MUST be committed alongside:

1. The migration file itself (`supabase/migrations/...`)
2. The regenerated `frontend/src/types/database.types.ts`
3. Every code-side reference updated (string literals in `.select()`, hooks, services, components)

If any of those three are missing, the migration is incomplete.

---

## Recurrence Killer (proposed)

A CI gate that records all known column renames in a registry (`docs/database/column-renames.json`):

```json
[
  { "table": "projects", "from": "job number", "to": "project_number", "renamedIn": "20260518100000_rename_project_number.sql" }
]
```

The gate fails the build if any `from` string appears in any code file. Each rename adds an entry and adds the entry to the migration commit.

---

## Detection

```bash
# Find any literal references to commonly-renamed columns
grep -rn '"job number"' frontend/ backend/ --include='*.ts' --include='*.tsx' --include='*.py'
```

---

## References

- Files fixed: `frontend/src/app/api/projects/[projectId]/shell/route.ts`, `frontend/src/lib/supabase/queries.ts`, `frontend/src/lib/progress-reports/server.ts`, `frontend/src/lib/documents/record-documents.ts` — commit `3e9931613`
- One straggler intentionally left: `frontend/src/app/api/projects/route.ts:228` uses `"job number"` in a `.or()` filter; no confirmed 500 events from it
