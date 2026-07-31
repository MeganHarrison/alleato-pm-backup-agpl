---
title: PostgREST embed and select quirks
description: PostgREST's select parser has unintuitive rules. Multi-FK ambiguity (multiple relationships between same tables) and quoted-identifier-with-space both produce 5xx errors that never typecheck.
---

# Pattern: PostgREST Embed & Select Quirks

**Severity:** HIGH
**Triggers:** `companies(`, `people(`, `.select(`, `!fk_name`, "more than one relationship was found", "column ... does not exist", PostgREST, embed, `42703`

---

## Two Distinct Failures, One Pattern

PostgREST's select-string parser silently allows syntax that Postgres rejects at runtime. Two known traps:

### Trap 1 — Multi-FK ambiguity

When two tables have multiple foreign keys between them, PostgREST cannot guess which relationship you want for an embed:

```ts
// ❌ Bad — "more than one relationship was found for 'people' and 'companies'"
supabase.from("people").select("id, first_name, company:companies(id, name)")
```

The `people` table has at least two FKs into `companies`:
- `people.company_id → companies.id`  (the person's employer)
- `companies.primary_contact_id → people.id` (reverse)

PostgREST returns HTTP 502 with the error `"more than one relationship was found"`.

### Trap 2 — Quoted identifier with embedded space

A column literally named `"job number"` (with a space) breaks the select string parser:

```ts
// ❌ Bad — "column projects.number does not exist" (42703)
supabase.from("projects").select('id, name, "job number", phase')
```

PostgREST parses the string and reads `"job"` as one column and `number` as a separate bare column, producing a Postgres "undefined column" error.

---

## Real Incidents — 2026-05-18 telemetry

| Class | Route | Events | Status |
|---|---|---|---|
| Multi-FK ambiguity | `GET /api/projects/[projectId]/directory/roles` | 34 (server + client) | 502 |
| Quoted-identifier-with-space | `GET /api/projects/[projectId]/shell` | 6 | 500 |

Five files in the codebase had the ambiguous `people`→`companies` embed. Four had the `"job number"` reference.

---

## The Fix

### Trap 1 — disambiguate with FK hint

Always specify which FK to use with the `!<fk_name>` syntax:

```ts
// ✅ Good
supabase.from("people").select(
  "id, first_name, company:companies!people_company_id_fkey(id, name)"
)
```

The FK name comes from `frontend/src/types/database.types.ts` — look at the `Relationships` array for the table you're embedding from. Pick the relationship that semantically matches "the company this person belongs to" (typically the column literally named `company_id`).

### Trap 2 — rename to snake_case

Avoid column names with spaces. The 2026-05-18 fix renamed `"job number"` → `project_number`. If a legacy column with a space exists and can't be renamed, alias it in the select with a snake_case key:

```ts
// ✅ Acceptable as a last resort
supabase.from("projects").select('id, name, job_number:"job number", phase')
```

But the durable fix is the migration that renames the column.

---

## Known FK Ambiguities in This Repo

Maintain this table as new tables are added. Update when the schema changes.

| From | To | Use This FK |
|---|---|---|
| `people` | `companies` | `!people_company_id_fkey` (the person's employer) |
| `companies` | `people` | `!companies_primary_contact_id_fkey` (the company's primary contact) |
| `projects` | `companies` | `!projects_company_id_fkey` (the project owner) |
| `tasks` | `people` | `!tasks_assigned_to_fkey` (the assignee) |

---

## Detection

```bash
# Find ambiguous people↔companies embeds without FK hint
grep -rn 'companies(' frontend/src/ --include='*.ts' --include='*.tsx' \
  | grep -v '!people_company_id_fkey' \
  | grep -v node_modules

# Find quoted identifiers with embedded spaces
grep -rnE '\.select\(.*"[a-z]+\s+[a-z]+"' frontend/src/
```

---

## Recurrence Killer (proposed)

Custom ESLint rule (`design-system/postgrest-select-safety`):
- Flag `.select()` strings containing `companies(` or `people(` without an `!` FK hint
- Flag `.select()` strings containing any `"foo bar"` quoted identifier with a space

---

## References

- Files fixed (multi-FK): `frontend/src/app/api/projects/[projectId]/directory/roles/route.ts`, `frontend/src/services/directoryService.ts`, `frontend/src/services/directoryAdminService.ts`, `frontend/src/app/api/contacts/route.ts`, `frontend/src/app/(main)/[projectId]/directory/page.tsx` (commit `aca196aa6`)
- Files fixed (quoted-space): `frontend/src/app/api/projects/[projectId]/shell/route.ts`, `frontend/src/lib/supabase/queries.ts`, `frontend/src/lib/progress-reports/server.ts`, `frontend/src/lib/documents/record-documents.ts` (commit `3e9931613`)
