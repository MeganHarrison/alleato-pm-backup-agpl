---
title: PostgREST FK disambiguation
description: How to write Supabase select strings that survive multi-FK ambiguity and quoted-identifier quirks. Companion to the postgrest-embed-ambiguity error pattern.
---

# Solution: PostgREST Select Safety

**Solves:** [postgrest-embed-ambiguity](../errors/postgrest-embed-ambiguity.md)

---

## Rule 1 — Always Disambiguate Embeds Between Multi-FK Tables

When two tables have more than one FK between them, **every** embed must specify which FK to use with the `!<fk_name>` hint:

```ts
// ❌ Bad — fails with "more than one relationship was found"
supabase.from("people").select("id, first_name, company:companies(id, name)")

// ✅ Good — pins the relationship to the person's employer
supabase.from("people")
  .select("id, first_name, company:companies!people_company_id_fkey(id, name)")
```

Where to find the FK name: `frontend/src/types/database.types.ts` → the `Relationships` array on each table.

---

## Rule 2 — Prefer snake_case Column Names

Never create columns with spaces or non-snake_case characters. PostgREST's select string parser silently mangles them.

If you inherit a legacy column with a space (e.g. `"job number"`), **rename it in a migration to snake_case** (`project_number`). If the rename isn't possible in your scope, alias the field with a snake_case key in every select:

```ts
// ✅ Acceptable as a last resort
supabase.from("projects").select('id, name, job_number:"job number", phase')
```

But: every place that uses `"job number"` as a literal string in `.eq()`, `.order()`, `.or()`, etc. is a future bug. The durable fix is the rename.

---

## Known FK Ambiguities (Living Reference)

Keep this table current as new tables are added. When you add a new pair of tables with multiple FKs, add a row here AND update the `docs/architecture/tables.yaml` entries for both sides.

| From | To | Use This FK | Semantic Meaning |
|---|---|---|---|
| `people` | `companies` | `!people_company_id_fkey` | The person's employer |
| `companies` | `people` | `!companies_primary_contact_id_fkey` | The company's primary contact |
| `projects` | `companies` | `!projects_company_id_fkey` | The project owner |
| `tasks` | `people` | `!tasks_assigned_to_fkey` | The assignee |

(Update this table any time a new ambiguity is discovered. The reverse-direction FK is often where embeds get confused.)

---

## Audit Procedure

After any migration that adds an FK between tables that already share a relationship:

```bash
# Find every embed of the "to" table from anywhere
grep -rn ":\?<TO_TABLE>(" frontend/src/ --include='*.ts' --include='*.tsx'

# For each, confirm the embed has a !fk_name hint matching one of the
# entries in the Known FK Ambiguities table above. Add the hint if missing.
```

---

## Proposed ESLint Rule

`design-system/postgrest-select-safety`:

- Flag any `.select()` string argument containing `<TABLE>(` for a table listed in the ambiguity registry — unless preceded by `!<fk_name>`.
- Flag any `.select()` string argument containing a double-quoted identifier with embedded whitespace (`"foo bar"`).

The rule would require maintaining an `ambiguous-tables.json` file with the pairs above as input data.

---

## References

- Error pattern: `docs/patterns/errors/postgrest-embed-ambiguity.md`
- Fix commits: `aca196aa6` (people↔companies) and `3e9931613` (job number → project_number)
- Source-of-truth for current FKs: `frontend/src/types/database.types.ts` (regenerated via `npm run db:types`)
