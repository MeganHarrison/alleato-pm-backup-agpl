# Pattern: FK Created-By Profile Guard

Last validated: 2026-04-14
Severity: High
Category: Database integrity

## Problem

Writes fail with FK violations when `created_by`/`user_id` references a user that exists in auth but not in `profiles`.

## Required Rule

- Before writing `created_by` or similar profile-linked fields, verify profile existence.
- If profile is missing, return explicit error or omit optional FK field intentionally.
- Never allow generic 500s for this failure path.

## API Guard Example

```ts
const { data: profile } = await supabase
  .from("profiles")
  .select("id")
  .eq("id", user.id)
  .maybeSingle();

const payload = {
  title: body.title,
  ...(profile ? { created_by: user.id } : {}),
};
```

## Test/Seed Guard

- Ensure test users have matching `profiles` rows before FK-dependent inserts.

## Failure Signals

- FK errors mentioning `created_by_fkey`/`user_id_fkey`.
- Writes succeed for some users and fail for others depending on profile row presence.

## Evidence Source

- Legacy references: `docs/patterns/errors/fk-constraint-user.md`
