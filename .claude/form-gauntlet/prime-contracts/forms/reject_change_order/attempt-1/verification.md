## Verification Report: Reject Change Order
**Verdict: FAIL**

### Criterion-by-Criterion

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Modal opens from row action | MET | Dialog "Reject Change Order" opened correctly with textarea |
| rejection_reason field fills | MET | Textarea filled with "Rejected by form gauntlet automated test" |
| Submit fires API call | MET | POST/PATCH to change-orders endpoint was called |
| Modal closes after submission | NOT MET | Modal stayed open; toast showed error |
| Status changes to "Rejected" | NOT MET | Status remains "Pending" |

### Issues Found

**Bug: reviewer-access.ts queries non-existent `project_members` table**

- **What's wrong:** `canReviewContractChangeOrder()` in `frontend/src/lib/change-orders/reviewer-access.ts` queries a `project_members` table that does not exist in the database. The query returns `null`, causing the function to always return `false` — blocking all users from rejecting change orders.
- **API error:** HTTP 403 — "Forbidden: Only admins or accepted reviewers can reject a submitted change order"
- **How to reproduce:** Navigate to any prime contract with a pending CO → click Reject → fill reason → submit → 403
- **Expected:** CO status changes to "Rejected", modal closes
- **Actual:** 403 error toast, modal stays open

### Fix Required

Read `frontend/src/lib/change-orders/reviewer-access.ts` and fix the query to use the correct table name (check `database.types.ts` for the correct project membership/team membership table).
