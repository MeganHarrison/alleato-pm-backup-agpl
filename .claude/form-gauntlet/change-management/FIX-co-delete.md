# Fix Report: CO List Delete Confirmation + Commitment PCO Edit Stub

Date: 2026-06-13

---

## BUG 1 — change_orders_list_delete (HIGH PRIORITY — FIXED)

### Root cause
`handleDeletePrime` and `handleDeleteCommitment` in
`frontend/src/app/(main)/[projectId]/change-orders/change-orders-client.tsx`
called `apiFetch(..., { method: "DELETE" })` synchronously on row-action click
with no AlertDialog confirmation gate. One mis-click permanently destroyed a
change order.

### Evidence
Discovery doc section `change_orders_list_delete` confirmed: "DELETE WITH NO
CONFIRMATION. `handleDeletePrime` / `handleDeleteCommitment` call the DELETE
endpoint immediately from the row-action menu with no AlertDialog."

Both the commitment-pcos list and the prime-contract-pcos list use
`useConfirmationDialog` from `@/components/common/ConfirmationDialog` before
firing their DELETE calls. This CO list was the only exception.

### Fix applied
File: `frontend/src/app/(main)/[projectId]/change-orders/change-orders-client.tsx`

1. Imported `useConfirmationDialog` from `@/components/common/ConfirmationDialog`.
2. Added two dialog instances — `primeDeleteDialog` and `commitmentDeleteDialog`
   — with destructive variant and "cannot be undone" copy, matching the existing
   PCO list pattern exactly.
3. Changed both handlers from `async (co) => { apiFetch... }` to
   `(co) => { dialog.confirm(async () => { apiFetch... }) }`.
4. Rendered both `dialog.dialog` JSX nodes in each of the two return paths
   (prime tab and commitment tab) wrapped in a React fragment.

The actual DELETE call, error handling, toast messages, and `router.refresh()`
are unchanged — only the confirmation gate was added.

### Type safety
`npx tsc --noEmit` exited 0 after the change.

---

## BUG 2 — commitment_pco_edit (LOWER PRIORITY — MADE HONEST)

### Root cause
`renderPcoRowActions` in
`frontend/src/features/commitment-pcos/commitment-pcos-table-config.tsx`
rendered an active "Edit" `DropdownMenuItem` that called `onEdit(item)`, which
pushed `/${projectId}/commitment-pcos/${item.id}?edit=1` to the router. The
detail page (`commitment-pcos/[pcoId]/page.tsx`) has no edit form wired to the
`?edit=1` param — it only shows a `disabled` Button with
`title="Edit form coming soon"`. The list row action appeared functional but
landed users on a dead state.

### Fix applied
File: `frontend/src/features/commitment-pcos/commitment-pcos-table-config.tsx`

1. Removed the `canEdit` local variable (was only gating the now-removed block).
2. Removed the `SquarePen` lucide import (was only used in the removed block).
3. Replaced the `{canEdit && <DropdownMenuItem>Edit</DropdownMenuItem>}` block
   with a comment documenting the missing feature and what to do when it ships.
4. Kept the `onEdit` parameter signature (marked as reserved) to avoid a
   breaking change to all callers — the list page still passes `handleEdit` but
   it is never invoked.

The detail page `disabled` button with "coming soon" tooltip is the honest
disclosure to the user and was left in place unchanged.

### What remains for a future full implementation
- Add an edit page at `commitment-pcos/[pcoId]/edit/page.tsx` (or toggle on
  detail page with `?edit=1`).
- Wire the RHF form with the same fields as the create form
  (`commitment_id`, `title`, `change_reason`, `schedule_impact`, `due_date`,
  `description`).
- PATCH to `/api/projects/{projectId}/commitment-pcos/{pcoId}`.
- When done: remove the comment in `renderPcoRowActions`, restore the
  `canEdit` guard and `SquarePen` import, and un-disable the detail page button.

---

## Files changed

- `frontend/src/app/(main)/[projectId]/change-orders/change-orders-client.tsx` — Bug 1 fix
- `frontend/src/features/commitment-pcos/commitment-pcos-table-config.tsx` — Bug 2 honest fix
