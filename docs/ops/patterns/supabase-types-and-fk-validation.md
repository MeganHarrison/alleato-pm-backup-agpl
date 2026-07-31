# Pattern: Supabase Types And FK Validation

Last validated: 2026-04-14
Severity: Critical
Category: Database safety

## Problem

Database code written from memory causes schema drift bugs, especially FK type mismatches.

## Required Rule

Before any DB code change:

```bash
npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts
```

Then verify table/column/type existence in `frontend/src/types/database.types.ts`.

## Guardrails

- FK type must match referenced PK type.
- Do not assume schema from old docs or memory.
- Treat generated types as source of truth.

## Failure Signals

- TypeScript schema mismatch errors.
- Runtime insert/query failures due to missing columns or wrong types.

## Evidence Source

- Legacy references: `docs/patterns/errors/supabase-types-stale.md`
- Guardrails reference: `AGENTS.md`
