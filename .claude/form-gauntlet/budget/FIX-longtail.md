# Budget Tool — Long-tail Fix Report

Date: 2026-06-14

## Files Changed

| File | Issue Fixed |
|------|------------|
| `frontend/src/app/(main)/[projectId]/budget/setup/components/CreateBudgetCodeModal.tsx` | Raw `fetch()` → `apiFetch` from `@/lib/api-client`; error surfaced via `ApiError.message` instead of generic fallback |
| `frontend/src/app/(main)/[projectId]/budget/line-item/new/page.tsx` | Two `alert()` calls → `toast.error()` (validation: "please select a cost code"; "all rows must have a budget code and non-zero amount") |
| `frontend/src/app/(main)/[projectId]/budget/setup/page.tsx` | Generic `toast.error("Failed to create budget lines")` → surfaces real server message via `ApiError`/`Error.message` |
| `frontend/src/components/budget/modals/CreateBudgetLineItemsModal.tsx` | Two `alert()` calls → `toast.error()` with real error message; `confirm()` → state-driven `AlertDialog` ("Discard unsaved line items?") |
| `frontend/src/components/budget/BudgetViewsModal.tsx` | Generic `toast.error("Failed to save view")` → surfaces real `ApiError.message` |
| `frontend/src/components/budget/BudgetViewsManager.tsx` | Three generic catch toasts (clone/delete/set-default) → surface real `ApiError.message` |

## Verification

- `npx tsc --noEmit | grep -i budget` — zero new errors (pre-existing errors in contracts SOV code unrelated to this task)
- `run-frontend-eslint.sh strict` on all 6 changed files — ZERO errors

## Deferrals

None. All flagged issues in DISCOVERY.md issues 1–5 are resolved.
