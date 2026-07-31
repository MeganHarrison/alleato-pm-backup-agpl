---
title: Generic error swallow
description: API routes throw "Unexpected error" or "Failed to load X" instead of the real Supabase/exception message, making every production incident un-diagnosable.
---

# Pattern: Generic Error Swallow

**Severity:** HIGH
**Triggers:** "Unexpected error", "Failed to load", "Failed to save", `GuardrailError`, `instanceof Error`, `PostgrestError`, `asGuardrailError`

---

## The Mistake

An API route catches an exception and throws a new `GuardrailError` with a hardcoded literal message — discarding the real underlying detail:

```ts
// ❌ Bad
if (error) {
  throw new GuardrailError({
    code: "INTERNAL_ERROR",
    where: "/api/tasks#GET",
    message: "Failed to load tasks.",   // ← the real error is gone
    status: 500,
  });
}
```

Or a universal helper that's supposed to surface error messages uses the wrong type guard:

```ts
// ❌ Bad — asGuardrailError before round 3
const message =
  error instanceof Error ? error.message :
  typeof error === "string" ? error :
  "Unexpected error";   // ← Supabase PostgrestError falls here
```

Supabase's `PostgrestError` is a **plain object**, not an `Error` subclass. The `instanceof Error` check missed it, so every Supabase DB error in every API route resolved to literal `"Unexpected error"`.

---

## Real Incident — 2026-05-18 telemetry

| Route | Events | Telemetry Message |
|---|---|---|
| `/api/tasks` (line 132) | 14 | "Failed to load project tasks." |
| `/api/tasks` (line 205) | 7 | "Failed to load tasks." |
| `/api/projects/[projectId]/directory/people` | 6 | "Unexpected error" |

For all three, the **real** error message (RLS denial, missing column, ambiguous embed, etc.) was being thrown away. We couldn't tell what was wrong without re-running the query manually.

---

## The Fix

### 1. Surface the underlying error at the throw site

```ts
// ✅ Good
if (error) {
  throw new GuardrailError({
    code: "INTERNAL_ERROR",
    where: "/api/tasks#GET",
    message: `Failed to load tasks: ${error.message}`,
    status: 500,
  });
}
```

### 2. Fix the universal helper

```ts
// ✅ Good — asGuardrailError after round 3
function asGuardrailError(error: unknown, where: string): GuardrailError {
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    message = (error as { message: string }).message;   // ← PostgrestError lands here
  } else {
    message = "Unexpected error";
  }
  // ...
}
```

This single change in `frontend/src/lib/guardrails/errors.ts` makes every Supabase error self-diagnosing across every API route.

---

## Detection

Grep for the anti-pattern:

```bash
# Hardcoded throw messages with no interpolation
grep -rn 'message: ["'\''"]\(Failed to\|Unexpected\)' frontend/src/app/api/ \
  | grep -v ': `'   # exclude template literals (the good kind)
```

Also: review every `try { ... } catch (e) { throw new GuardrailError(...) }` block in API routes. The catch handler should always include the underlying error in the message.

---

## Why a Pattern, Not a One-Off Fix

This bug pattern hid the real root cause of **three high-severity error groups** for days. The universal-helper variant (`asGuardrailError`) silently affected **every API route in the codebase** — every Supabase error from any route, anywhere, was being reported as the string `"Unexpected error"`.

Per CLAUDE.md's core principle: "Never return generic errors." This pattern is the most common way that rule gets violated.

---

## Recurrence Killer (proposed)

Custom ESLint rule (`design-system/no-generic-error-message`) that fails CI when a `GuardrailError`'s `message` field is a literal string containing "Failed to" / "Unexpected" / "Could not" — unless followed by `: ${...}` interpolation.

---

## References

- Helper fixed: `frontend/src/lib/guardrails/errors.ts` (commit `3e9931613`)
- Call site fixed: `frontend/src/app/api/tasks/route.ts` (commit `aca196aa6`)
- CLAUDE.md core principle: "Never return generic errors."
