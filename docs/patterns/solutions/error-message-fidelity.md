---
title: Error message fidelity
description: Two patches that preserve real error detail through to telemetry. Companion to the generic-error-swallow error pattern.
---

# Solution: Preserve Error Message Fidelity

**Solves:** [generic-error-swallow](../errors/generic-error-swallow.md)

---

## Two Layers, Two Patches

### Layer 1 — Universal helper (`asGuardrailError`)

`frontend/src/lib/guardrails/errors.ts` — checks for plain objects with `.message` after the `instanceof Error` and `typeof string` checks, so Supabase's `PostgrestError` (a plain object) surfaces its `message` instead of falling through to the literal `"Unexpected error"`:

```ts
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
    message = (error as { message: string }).message;
  } else {
    message = "Unexpected error";
  }
  // ...build GuardrailError using `message`
}
```

**Test it against:** `PostgrestError` (Supabase), `StorageError` (Supabase), `AuthError`, any plain object thrown from a library. All should now surface their `.message` field.

### Layer 2 — Throw sites in API routes

Every `throw new GuardrailError({ message: "..." })` inside a `catch (error)` or `if (error)` block must interpolate the underlying error:

```ts
// ❌ Bad
throw new GuardrailError({
  code: "INTERNAL_ERROR",
  where: "/api/tasks#GET",
  message: "Failed to load tasks.",
  status: 500,
});

// ✅ Good
throw new GuardrailError({
  code: "INTERNAL_ERROR",
  where: "/api/tasks#GET",
  message: `Failed to load tasks: ${error?.message ?? "unknown error"}`,
  status: 500,
});
```

---

## The Rule

A `GuardrailError`'s `message` field must EITHER be:

1. A user-actionable validation message that doesn't depend on any caught exception (e.g., `"commitmentId is missing or is the nil UUID."`), OR
2. An interpolation that includes the underlying `error.message`

Hardcoded strings like `"Failed to load tasks."`, `"Could not save"`, `"Unexpected error"` with no interpolation are always a bug — they erase the diagnostic detail that telemetry needs.

---

## Detection

```bash
# Find anti-pattern throws
grep -rn 'message: ["'\''"]\(Failed\|Unexpected\|Could not\|Unable to\)' \
  frontend/src/app/api/ frontend/src/lib/ \
  | grep -v ': `'   # exclude template-literal interpolations
```

---

## Proposed ESLint Rule

`design-system/no-generic-error-message`:

```js
// pseudocode
// In any object literal passed to a `GuardrailError` constructor,
// if the `message` property's value is a Literal string AND
// contains any of: "Failed to", "Unexpected error", "Could not",
//                  "Unable to", "Error processing",
// fail with: "GuardrailError message must include the underlying error
//             via template-literal interpolation, e.g. `: ${err.message}`"
```

---

## References

- Helper: `frontend/src/lib/guardrails/errors.ts` (commit `3e9931613`)
- Example fix at throw site: `frontend/src/app/api/tasks/route.ts` (commit `aca196aa6`)
- Error pattern: `docs/patterns/errors/generic-error-swallow.md`
- CLAUDE.md core principle: "Never return generic errors."
