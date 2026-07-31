---
title: supauase types stale
description: supauase types stale documentation
---

# Pattern: Stale Supabase Types

> Migrated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/supabase-types-and-fk-validation.md`.

**Severity:** HIGH
**Triggers:** `supabase`, `database`, `types`, `schema`, `migration`, `column`, `table`, `Property does not exist`
**Category:** Database

---

## The Mistake

Writing code that assumes database schema without regenerating types first:

```typescript
// WRONG - Using column that might not exist in types
const { data } = await supabase
  .from('change_events')
  .select('new_column_name');  // TypeScript error: Property not in types

// WRONG - Assuming table structure without verification
interface ChangeEvent {
  id: string;
  title: string;
  assumed_field: string;  // May not match actual schema
}
```diff
**Root cause:** Types in `database.types.ts` don't match actual Supabase schema after migrations.

---

## The Fix

**ALWAYS regenerate types before any database work:**

```bash
# Run this command FIRST, before writing ANY database code
npx supabase gen types typescript \
  --project-id "lgveqfnpkxvzbnnwuled" \
  --schema public \
  > frontend/src/types/database.types.ts
```typescript
**Then verify the schema:**

```typescript
// Read the generated types to understand actual schema
import { Database } from '@/types/database.types';

type ChangeEvent = Database['public']['Tables']['change_events']['Row'];
// Now you know the exact fields available
```diff
---

## The Workflow (Non-Negotiable)

```

1. GENERATE TYPES      →  npx supabase gen types...
2. READ TYPES          →  Open database.types.ts, find your table
3. VERIFY SCHEMA       →  Check column names, types, nullability
4. WRITE CODE          →  Now you can write database code

```sql
**NEVER skip steps 1-3 and go straight to writing code.**

---

## Type-Safe Query Pattern

```typescript
import { Database } from '@/types/database.types';
import { createClient } from '@/lib/supabase/server';

type Tables = Database['public']['Tables'];
type ChangeEvent = Tables['change_events']['Row'];
type ChangeEventInsert = Tables['change_events']['Insert'];

export async function createChangeEvent(data: ChangeEventInsert) {
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from('change_events')
    .insert(data)
    .select()
    .single();

  return { data: result as ChangeEvent | null, error };
}
```sql
---

## Detection

Signs this mistake is happening:

1. TypeScript error: "Property 'X' does not exist on type"
2. Supabase query returns unexpected null values
3. Insert/update fails with "column does not exist"
4. Types don't match what you see in Supabase dashboard
5. Code worked yesterday, fails today (schema changed)

---

## After Migrations

Whenever a migration is applied:

```bash
# 1. Apply migration
npx supabase db push

# 2. IMMEDIATELY regenerate types
npx supabase gen types typescript \
  --project-id "lgveqfnpkxvzbnnwuled" \
  --schema public \
  > frontend/src/types/database.types.ts

# 3. Run typecheck to find any breaking changes
npm run typecheck --prefix frontend
```bash
---

## Quick Reference Commands

```bash
# Regenerate types (use this often!)
npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts

# Check current schema in Supabase
npx supabase db diff

# List all tables
npx supabase db dump --schema public | grep "CREATE TABLE"
```

---

## References

- Types location: `frontend/src/types/database.types.ts`
- Project ID: `lgveqfnpkxvzbnnwuled`
- Gate rule: `.agents/rules/SUPABASE-GATE.md`
