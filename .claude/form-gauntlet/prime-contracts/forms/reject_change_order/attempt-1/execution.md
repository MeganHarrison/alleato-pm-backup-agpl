# Form Gauntlet Execution: reject_change_order

## Summary

- **Status**: SUBMISSION_FAILED (API 403 Forbidden)
- **Form**: Reject Change Order
- **Target**: CO-GAUNTLET-001 on contract 20c40a53-f2d7-4b22-a257-cc1b3a80efaa (Project 67)
- **Date**: 2026-03-22

---

## Test Data Used

| Field | Value |
|-------|-------|
| rejection_reason | `Rejected by form gauntlet automated test` |

---

## Navigation Path

1. Opened: `http://localhost:3000/67/prime-contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa`
2. Clicked: **Change Orders** tab
3. Found CO-GAUNTLET-001 in **Pending** status with Approve/Reject action buttons
4. Clicked: **Reject** button on the CO-GAUNTLET-001 row
5. Dialog opened: "Reject Change Order" with textarea "Rejection Reason *"
6. Filled textarea with: `"Rejected by form gauntlet automated test"`
7. Clicked: **Reject Change Order** (destructive/red submit button)

---

## Submit Method

Clicked the `Reject Change Order` button (`variant="destructive"`) inside the modal dialog.
The button was enabled after filling in the rejection reason textarea.

---

## Immediate Response

- **Toast message**: "Forbidden: Only admins or accepted reviewers can reject a submitted change order"
- **Modal behavior**: Dialog remained open (did not close after submission)
- **Status change**: CO-GAUNTLET-001 status remained **Pending** (did NOT change to Rejected)
- **API response**: HTTP 403 Forbidden

---

## Root Cause

The `/api/projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]/reject` endpoint requires the user to be a project member with a non-null role. The reviewer access check queries a `project_members` table that **does not exist** in the database schema. As a result:

- `membership` is always `null` (query fails silently)
- `access.role` is always `null`
- `canReviewContractChangeOrder()` returns `false`
- All rejection attempts return 403 Forbidden

**File**: `frontend/src/lib/change-orders/reviewer-access.ts`
**Table queried**: `project_members` (does not exist in public schema)
**Actual membership tables available**: `project_directory_memberships`, `project_role_members`, `user_projects`

---

## Screenshot Paths

| Screenshot | Path | Description |
|------------|------|-------------|
| Before | `/tmp/form-gauntlet-reject_co-before.png` | CO-GAUNTLET-001 in Pending status, Change Orders tab visible |
| Dialog (filled) | `/tmp/form-gauntlet-reject_co-dialog.png` | Modal open with rejection reason filled in |
| After | `/tmp/form-gauntlet-reject_co-after.png` | Modal still open, toast showing 403 error |

---

## Errors

| Error | Details |
|-------|---------|
| API 403 Forbidden | "Forbidden: Only admins or accepted reviewers can reject a submitted change order" |
| Root cause | `project_members` table does not exist; reviewer access always returns null role |

---

## Form Behavior Assessment

| Aspect | Result |
|--------|--------|
| Form found | YES - Reject button visible on CO-GAUNTLET-001 row |
| Dialog opens | YES - "Reject Change Order" modal opens correctly |
| Textarea present | YES - "Rejection Reason *" labeled, required |
| Submit button state | CORRECT - disabled until text entered, enabled after |
| Submit triggered API call | YES - POST to `/api/projects/67/contracts/.../change-orders/.../reject` |
| API succeeded | NO - 403 Forbidden |
| Status updated | NO - remains Pending |
| Modal closed | NO - stays open after 403 error |

---

## Status

**SUBMISSION_FAILED** — The form UI works correctly (dialog opens, textarea fills, button enables, API called) but the backend authorization check blocks all rejection attempts due to a missing `project_members` database table.
