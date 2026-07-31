---
name: alleato-complex-feature-development
description: Use for complex Alleato PM features with nested forms, editable tables, imports, generated rows, document attachments, contract/estimate/invoice flows, or multi-step UI that writes to Supabase. Enforces data-contract mapping, shared-component ownership, bulk operation design, specific error handling, live DB/schema checks, and browser verification before completion.
---

# Alleato Complex Feature Development

Use this skill when work touches a complex user workflow, especially:

- Estimates, prime contracts, commitments, invoices, budgets, change events, submittals, documents, or imports
- Nested tabs, editable tables, dropdowns, modals, generated rows, template loading, or attachment flows
- Any UI action that writes to Supabase through API routes
- Any change where frontend state, API validation, database columns, migrations, and live data must agree

The goal is to prevent partial fixes that look correct in one component but fail in the real workflow.

## Required Operating Mode

Do not start by editing code. First map the workflow and contracts, then implement the smallest durable slice.

For urgent user-facing bugs, still gather the minimum runtime evidence before changing code:

1. Identify the exact route, tab, button, or field.
2. Identify the exact API route or server action called.
3. Identify the exact database table/column touched.
4. Identify whether the action is single-row, bulk, generated, imported, or page-load seeded.
5. State the likely failure class before patching.

## Workflow Map

Before implementation, produce or internally complete this map:

```text
User action:
Frontend owner component:
Shared primitive/component owner:
Client state changed:
API route(s):
Validation schema(s):
Service/helper(s):
Supabase table(s):
Live DB column/type assumptions:
Side effects on render:
Bulk/import/template behavior:
Expected success evidence:
Expected failure behavior:
```

If any row is unknown, inspect before editing.

## Non-Negotiable Design Rules

- Do not add page-local styling when a shared primitive owns the pattern.
- Do not create one-off versions of editable table rows, file uploaders, import flows, or line-item sections when a shared pattern exists.
- Do not seed, import, or template-load many rows by firing many independent client requests.
- Do not mutate the database from page load unless the workflow explicitly requires it and the operation is idempotent.
- Do not leave generic `toast.error("Failed to ...")` without a console/server log that names the failing action and owner route.
- Do not rely on generated Supabase types alone when a bug involves database type/constraint behavior. Check the live DB when feasible.

## Data Contract Gate

For every write path, verify these layers agree:

1. Frontend payload shape
2. API route request parsing
3. Zod/schema validation
4. Service/update payload
5. Supabase generated types
6. Live database type/nullability/default/constraint
7. Migration ledger, if a migration is involved

Use direct SQL for live-column checks when database behavior is central:

```bash
set -a; source .env; set +a
psql "$DATABASE_URL" -qAt -c "
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = '<table>'
order by ordinal_position;
"
```

When a migration is added:

- Apply it or explicitly mark it blocked/deferred.
- Verify with `npm run db:migrations:verify-applied -- supabase/migrations/<file>.sql`.
- Do not claim the database fix is complete until live DB and ledger evidence agree.

## Bulk Operation Gate

Use bulk endpoints for:

- Template loading
- Importing spreadsheet rows
- Seeding default rows
- Creating generated line items
- Uploading/linking multiple files when the backend supports it

Bad pattern:

```ts
await Promise.all(rows.map((row) => apiFetch("/api/thing", { method: "POST", body: JSON.stringify(row) })));
```

Preferred pattern:

```ts
await apiFetch("/api/thing", {
  method: "POST",
  body: JSON.stringify({ items: rows }),
});
```

Server-side route requirements:

- Validate the parent entity once.
- Insert rows in one database operation when possible.
- Return all created rows in deterministic order.
- If one row fails, fail the operation loudly instead of leaving partial client state.
- For imports, return structured warnings separately from fatal errors.

## Error Handling Gate

Every catch block in the touched workflow must answer:

- What action failed?
- Which entity or route failed?
- Was local optimistic state reverted?
- Is the user message specific enough to act on?
- Is the technical cause logged server-side or console-side?

Use:

```ts
catch (error) {
  console.error("Failed to <specific action>", error);
  toast.error("<Specific user-facing message>.");
}
```

Avoid:

```ts
catch {
  toast.error("Failed to save");
}
```

Never pass raw `err.message` into `toast.error`.

## Side-Effect Gate

Look for side effects inside `useEffect`, route loaders, and default render paths.

If a page auto-creates rows when it opens:

- Prefer moving the creation to the explicit create/import/template API.
- If page-load creation remains, make it idempotent.
- Use one bulk request.
- Make duplicate prevention explicit.
- Log failures with enough context to trace the entity id.

## Implementation Slicing

For nested workflows, split work by ownership boundary:

1. Data contract/schema/API
2. Shared UI primitive or row component
3. Feature component wiring
4. Error handling and rollback
5. Browser verification
6. Guardrail/test

Do not mix unrelated feature changes into the same patch.

If the worktree has unrelated dirt, commit only task-owned files using `npm run codex:finish -- --files ...`.

## Verification Requirements

Minimum checks:

- Targeted lint for touched frontend files
- Route guardrails for touched API routes
- DB live check for schema/type/constraint changes
- Migration ledger verification for migrations

For frontend workflows, use `agent-browser` on the exact route when feasible:

```bash
agent-browser open http://localhost:3000/<projectId>/<route>
agent-browser snapshot -i
agent-browser click @e...
agent-browser fill @e... "..."
agent-browser wait --load networkidle
agent-browser screenshot
```

Verification must include the user action, expected UI result, and whether the database persisted the result when relevant.

## Completion Report

Final response must include:

- What is done
- What remains
- Verification performed
- Known unrelated dirty files, if any
- Recommended next steps

For failures, include:

- Cause
- Detection gap
- Prevention step
- Exact failing command or route when known
- Owner file(s)

## Common Alleato Failure Patterns To Check

- Frontend schema accepts a value but live DB rejects the column type.
- Generated types are current but the migration was not applied.
- A page-load `useEffect` creates rows and shows random toasts when the request fails.
- A template/import flow creates rows through many client POSTs instead of one bulk route.
- A nested dropdown closes because blur handling ignores focus moving into the popover.
- A shared table/input primitive has a styling issue but the fix is applied locally.
- Imported spreadsheet warnings treat expected blank rows as user-facing errors.
- “Actions” buttons diverge from shared primary/dropdown styling.
- Read-only generated rows look editable because the row styling does not communicate ownership.
