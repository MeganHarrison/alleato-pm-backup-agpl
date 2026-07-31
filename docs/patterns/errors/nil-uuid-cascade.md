---
title: Nil-UUID cascade
description: Parent-not-loaded React hooks fire requests with the nil UUID 00000000-0000-0000-0000-000000000000, flooding the API with 404s and 500s.
---

# Pattern: Nil-UUID Cascade

**Severity:** HIGH
**Triggers:** `useQuery`, `useEffect`, `apiFetch`, `useMutation`, `[*Id]`, `00000000-0000-0000-0000-000000000000`, "Change event not found", "commitment not found", child route with a parent UUID

---

## The Mistake

A React component renders before its parent resource hook resolves. The child hook reads the parent's `.id` (which is `undefined` or the nil UUID `00000000-0000-0000-0000-000000000000` at that moment), uses it in a URL, and fires the request anyway.

Three downstream consequences:

1. The server burns CPU 404'ing or 500'ing on a non-existent record
2. The error tracker fills with the same group across many distinct routes
3. The user sees a broken state in the UI while the real data is still loading

---

## Real Incident — 2026-05-18 telemetry

| Route | Events | Status |
|---|---|---|
| `PUT /api/commitments/00000000-0000-0000-0000-000000000000` | 22 | 500 — empty body → `JSON.parse` SyntaxError |
| `GET /api/projects/[projectId]/change-events/00000000-…/line-items` | 18 | 404 — "Change event not found." |
| `GET /api/projects/[projectId]/commitment-pcos/00000000-…` | 9 | 401 / 404 cascade |

The trigger: the change-event expanded row in the table renders an inner detail hook before the row's own ID is loaded, and the same hook then fires three more cascade requests (detail → line-items → attachments → rfqs → related-items) per render.

---

## Root Causes

1. **Server side**: route handlers blindly trust `params.xxxId` is a valid UUID. They go straight to Supabase, which returns "not found" or a constraint violation depending on the operation.
2. **Client side**: a `useQuery` / `useEffect` / mutation hook reads `parent.id` from a parent query that's still loading, and there's no `enabled: !!parent.id` guard.

---

## The Fix (server side — always-on safety net)

Use the shared helper `frontend/src/lib/guardrails/path-params.ts`:

```ts
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

export const GET = withApiGuardrails<{ commitmentId: string }>(
  "/api/commitments/[commitmentId]#GET",
  async ({ params }) => {
    assertNonNilUuid(
      params.commitmentId,
      "commitmentId",
      "/api/commitments/[commitmentId]#GET",
    );
    // ...rest of handler
  },
);
```

This throws a 400 `INVALID_PAYLOAD` instead of letting the request hit the database. Apply it as the **first line** of every handler that accepts a UUID path param.

**Do NOT apply** to integer-shaped IDs (`projects.id` is INTEGER per CLAUDE.md). `parseInt` returns `NaN`, which Postgres rejects naturally.

---

## The Fix (client side — root-cause)

Every `useQuery` / `useEffect` depending on a parent UUID must be gated:

```ts
// ❌ Bad — fires with parent.id = undefined or nil
useQuery({
  queryKey: ["line-items", parent.id],
  queryFn: () => apiFetch(`/api/.../${parent.id}/line-items`),
});

// ✅ Good
useQuery({
  queryKey: ["line-items", parent.id],
  queryFn: () => apiFetch(`/api/.../${parent.id}/line-items`),
  enabled: Boolean(parent.id) && parent.id !== NIL_UUID,
});
```

For raw `useEffect`, short-circuit at the top of the effect:

```ts
useEffect(() => {
  if (!id || id === NIL_UUID) return;
  void fetchDetail(id);
}, [id]);
```

---

## Detection

```bash
# Find route handlers without the guard (UUID param routes only)
grep -rL "assertNonNilUuid" "frontend/src/app/api/**/[*Id]/**/route.ts"

# Find useQuery without `enabled` clause around an id-keyed query
grep -rn 'queryKey: \[.*\.id\]' frontend/src/hooks frontend/src/features \
  | xargs grep -L "enabled:"
```

---

## Why a Pattern, Not a One-Off Fix

The same root cause produced **3 distinct high-severity error groups** in a single week (commitments PUT, change-events line-items GET, commitment-pcos GET). Without the shared helper, every new `[*Id]` route would have to remember this. With the helper, it's one import.

---

## References

- Helper: `frontend/src/lib/guardrails/path-params.ts`
- Applied in: `frontend/src/app/api/commitments/[commitmentId]/route.ts`, `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/route.ts`, `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/route.ts`, `frontend/src/app/api/projects/[projectId]/commitment-pcos/[pcoId]/route.ts`
- Fixed callers: `frontend/src/hooks/use-change-event-detail.ts`, `frontend/src/components/domain/change-events/ChangeEventExpandedRow.tsx`
- Commit: `3e9931613`
