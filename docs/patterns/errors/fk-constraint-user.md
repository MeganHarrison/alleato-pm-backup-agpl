---
title: fk constraint user
description: fk constraint user documentation
---

# Pattern: Foreign Key Constraint on User Profile

> Migrated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/fk-created-by-profile-guard.md`.

**Severity:** HIGH
**Triggers:** `foreign key`, `fk`, `constraint`, `profiles`, `created_by`, `user_id`, `auth.users`, `insert`, `violates`
**Category:** Database

---

## The Mistake

Inserting records with a `created_by` or `user_id` that doesn't exist in the `profiles` table:

```typescript
// WRONG - User exists in auth.users but not in profiles
const { error } = await supabase
  .from('change_events')
  .insert({
    title: 'Test Event',
    created_by: user.id  // This user has no profile!
  });

// Error: insert or update on table "change_events" violates
// foreign key constraint "change_events_created_by_fkey"
```javascript
**Root cause:** Test users are created in `auth.users` but their corresponding `profiles` record may not exist or was deleted.

---

## The Fix

**Option 1: Check if user exists before setting created_by**

```typescript
// In API route handlers
const { data: profile } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', user.id)
  .single();

const insertData = {
  title: input.title,
  project_id: input.projectId,
  ...(profile ? { created_by: user.id } : {})  // Only set if profile exists
};

await supabase.from('change_events').insert(insertData);
```sql
**Option 2: Ensure test user has profile**

```typescript
// In test setup or auth.setup.ts
async function ensureUserProfile(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!existing) {
    await supabase.from('profiles').insert({
      id: userId,
      email: 'test@example.com',
      created_at: new Date().toISOString()
    });
  }
}
```sql
**Option 3: Make created_by nullable with ON DELETE SET NULL**

```sql
-- In migration file
ALTER TABLE change_events
  DROP CONSTRAINT change_events_created_by_fkey,
  ADD CONSTRAINT change_events_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;
```

---

## API Handler Pattern

Standard pattern for handling created_by in API routes:

```typescript
// frontend/src/app/api/projects/[projectId]/[resource]/route.ts
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user has a profile before using created_by
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  const body = await request.json();

  const { data, error } = await supabase
    .from('resource_table')
    .insert({
      ...body,
      // Only include created_by if profile exists
      ...(profile ? { created_by: user.id } : {})
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```sql
---

## Detection

Signs this mistake is happening:
1. Error: "violates foreign key constraint"
2. Error mentions "created_by_fkey" or "user_id_fkey"
3. Insert operations fail silently or with 500 errors
4. Works in development but fails with test users

---

## Database Verification

```sql
-- Check if test user has a profile
SELECT * FROM profiles WHERE id = '[test-user-uuid]';

-- Find all tables with created_by FK
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name IN ('created_by', 'user_id')
    AND ccu.table_name = 'profiles';
```

---

## References

- Fixed in: `frontend/src/app/api/projects/[projectId]/change-events/route.ts`
- Test user: `test1@mail.com` (ensure profile exists)
- Auth setup: `frontend/tests/auth.setup.ts`
