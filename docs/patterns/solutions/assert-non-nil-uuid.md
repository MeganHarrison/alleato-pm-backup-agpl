---
title: assertNonNilUuid helper
description: Shared guardrail that rejects the nil UUID at the top of every UUID-param API route. Companion to the nil-uuid-cascade error pattern.
---

# Solution: `assertNonNilUuid` Helper

**Solves:** [nil-uuid-cascade](../errors/nil-uuid-cascade.md)

---

## The Helper

`frontend/src/lib/guardrails/path-params.ts`:

```ts
import { GuardrailError } from "./errors";

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Throws a 400 INVALID_PAYLOAD if `value` is missing or is the nil UUID.
 * Use at the top of every API route handler whose path param is UUID-shaped.
 */
export function assertNonNilUuid(
  value: string | undefined | null,
  paramName: string,
  where: string,
): asserts value is string {
  if (!value || value === NIL_UUID) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: `${paramName} is missing or is the nil UUID. The caller likely fired before the parent resource finished loading.`,
      status: 400,
      severity: "low",
    });
  }
}
```

The `asserts value is string` return type narrows `value` from `string | undefined | null` to `string` for the rest of the handler — so you get type safety AND runtime safety from one call.

---

## Usage

```ts
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

export const GET = withApiGuardrails<{ commitmentId: string }>(
  "/api/commitments/[commitmentId]#GET",
  async ({ params }) => {
    assertNonNilUuid(
      params.commitmentId,
      "commitmentId",
      "/api/commitments/[commitmentId]#GET",
    );

    // params.commitmentId is now narrowed to string
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("commitments")
      .select("*")
      .eq("id", params.commitmentId)
      .maybeSingle();
    // ...
  },
);
```

---

## When to Apply

**Apply to** every API route handler whose path param is UUID-shaped. As of 2026-05-18, these include:

- `frontend/src/app/api/commitments/[commitmentId]/route.ts`
- `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/route.ts`
- `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/route.ts`
- `frontend/src/app/api/projects/[projectId]/commitment-pcos/[pcoId]/route.ts`

**Do NOT apply to** integer-shaped IDs:
- `[projectId]` — `projects.id` is INTEGER per CLAUDE.md
- Any other `*Id` param backed by an INTEGER column

For integers, `parseInt(value, 10)` returns `NaN` and Postgres rejects it naturally. No guard needed.

---

## Companion Client-Side Fix

The helper is the safety net. The root cause is client hooks that fire before the parent ID is loaded. See [`nil-uuid-cascade`](../errors/nil-uuid-cascade.md) for the `enabled: !!parent.id` pattern in `useQuery` and the short-circuit pattern in `useEffect`.

---

## Verifying Coverage

```bash
# List all UUID-param API route files
find frontend/src/app/api -type f -name "route.ts" -path "*\[*Id*"

# Show which ones import the helper
grep -L "assertNonNilUuid" $(find frontend/src/app/api -type f -name "route.ts" -path "*\[*Id*")
```

Any route file that takes a UUID param and is missing the helper is a candidate for a follow-up commit.

---

## References

- Helper file: `frontend/src/lib/guardrails/path-params.ts`
- First introduced in commit `3e9931613`
- Error pattern: `docs/patterns/errors/nil-uuid-cascade.md`
