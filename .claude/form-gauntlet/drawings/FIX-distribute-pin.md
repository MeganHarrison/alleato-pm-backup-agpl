# Drawings Fix Report — distribute + pin_delete

Fixed: 2026-06-13

---

## BUG 1: drawing_distribute — fake success (silent failure)

### Root cause
`DrawingDistributeDialog.handleSubmit` used `setTimeout(500)` + `toast.success` with no API
call. The user received a success confirmation for an action that did not happen.

### Investigation
- Searched `frontend/src/app/api` and `backend/` for any `/distribute` route under drawings.
- Found only `submittals/[submittalId]/distribute/route.ts` — no drawings equivalent.
- Checked `database.types.ts` for `drawing_distribution*` tables — none exist.
- No backend, no DB table, no email infra for drawings distribution.

### Decision: option (a) — disable honestly

No DB table exists and no email template exists for drawings distribution. Inventing a new
table and route would require a Supabase migration, an email template, and a backend
distribution record — scope far beyond a bug fix. The correct fix per CLAUDE.md ("Never ship
silent failures") is to make the UI honest about the feature's status rather than pretend
it works.

### Fix applied
`frontend/src/components/drawings/DrawingDistributeDialog.tsx`

- Removed all form fields, state, and the fake `handleSubmit` with its `setTimeout`.
- Removed `toast` import (no longer needed).
- Replaced form body with `<InfoAlert>` (from `@/components/ds/InfoAlert`) explaining the
  feature is coming soon.
- Dialog remains openable so the user gets a clear message instead of a broken form.
- The `Send` icon is retained on the Close button to maintain visual context.

### What would have caught this before production
A smoke test that POSTs to `/api/projects/{id}/drawings/{id}/distribute` and asserts a
non-404 response. The absence of such a route in `api-smoke-test.sh` is what allowed the
stub to ship undetected.

### Guardrail added
The dialog now has no submit path — if a future developer wires a real API, they must add
the route first, then update this component. There is no longer a code path that returns
success without a real backend call.

---

## BUG 2: drawing_pin_delete — destructive single-click delete

### Root cause
`DrawingLinksPanel` called `deletePin.mutate(pin.id)` directly on the trash button click
with no confirmation step. Pins link drawings to RFIs, punch items, photos, etc. — deleting
one is irreversible (the backend hard-deletes the pin row).

### Fix applied
`frontend/src/components/drawings/DrawingLinksPanel.tsx`

- Added `React` import and `pendingDeletePin: DrawingMarkupPin | null` state.
- Trash button now calls `setPendingDeletePin(pin)` instead of `deletePin.mutate(pin.id)`.
- Added `<ConfirmDeleteDialog>` (from `@/components/ds/ConfirmDeleteDialog`) with:
  - `title="Remove this link?"` — scoped language (not "delete") since the linked entity
    is not affected.
  - `description` clarifies the linked item (RFI, punch item, etc.) is not deleted.
  - `confirmLabel="Remove"` — accurate to the action.
  - `isDeleting={deletePin.isPending}` — disables buttons during in-flight delete.
  - `onSettled` callback clears `pendingDeletePin` after success or error.

### Type safety
`useDeleteDrawingPin` returns a TanStack Query `UseMutationResult` which exposes `isPending`
— no casting required.

### What would have caught this before production
A Playwright test that clicks the trash icon and asserts a confirmation dialog appears before
the pin count changes.

---

## Files changed

- `frontend/src/components/drawings/DrawingDistributeDialog.tsx`
- `frontend/src/components/drawings/DrawingLinksPanel.tsx`

## TypeCheck result

No errors in changed files. Pre-existing unrelated error in
`change-orders/change-orders-client.tsx` (JSX fragment mismatch) — not introduced by this
fix, not in scope.
