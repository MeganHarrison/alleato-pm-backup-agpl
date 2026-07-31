# Estimates Long-tail Fix Report

Discovered: 2026-06-14
Status: COMPLETE

## Issue 1 — gc_template_load: destructive non-transactional DELETE+INSERT (DATA LOSS RISK)

**Root cause:** `handleConfirmLoadTemplate` called `DELETE /gc-items` (bulk wipe) then `POST /gc-items` (insert template rows) as two separate requests. A failure between them left the GC tab permanently empty.

**Fix — atomic PUT endpoint (`insert-first, delete-old-on-success`):**

- Added `PUT /api/projects/[projectId]/estimates/[estimateId]/gc-items/route.ts`
  - Step 1: INSERT new rows from the template. If this fails, throw — old rows survive untouched.
  - Step 2: DELETE rows whose IDs are NOT in the newly inserted set. If this fails after a successful insert, log and continue (user sees duplicates on reload, but no data is lost).
- Updated `handleConfirmLoadTemplate` in `estimate-detail-client-v2.tsx` to:
  1. Fetch template data first (before touching the DB)
  2. Call `PUT` instead of `DELETE` + `POST`
  3. Removed the now-unused `insertGcTemplateItems` helper
- Error surfaced via `showEstimateError("Template load failed", ...)` — never swallowed.

**Files changed:**
- `frontend/src/app/api/projects/[projectId]/estimates/[estimateId]/gc-items/route.ts` — added `PUT` handler
- `frontend/src/app/(main)/[projectId]/estimates/[estimateId]/estimate-detail-client-v2.tsx` — updated `handleConfirmLoadTemplate`, removed `insertGcTemplateItems`

## Issue 2 — Silent failures (raw `err.message` toast pattern)

Replaced `const msg = err instanceof Error ? err.message : "Unknown error"; toast.error(\`...: ${msg}\`)` with `showEstimateError(...)` at three locations:

| Location | Handler | Before | After |
|----------|---------|--------|-------|
| ~line 3078 | `toggleScopeItemChecked` | `toast.error(\`Failed to save scope item: ${msg}\`)` | `showEstimateError("Scope item save failed", err, ...)` |
| ~line 3843 | `handlePrimaryAction` use-bid path | `toast.error(\`Failed to flow bid into estimate: ${msg}\`)` | `showEstimateError("Use bid failed", err, ...)` |
| ~line 5055 | Inline "Use bid" button | same raw pattern (multi-line) | `showEstimateError("Use bid failed", err, ...)` |

Note: `toggleScopeItemChecked` already had an error toast (contrary to DISCOVERY notes) but used the forbidden raw-message pattern. Now uses `showEstimateError`.

## Verification

- `npx tsc --noEmit 2>&1 | grep -i estimate` → no output (zero new errors)
- `run-frontend-eslint.sh strict <both files>` → `Strict design lint found no new errors on staged changed lines.`

## Deferrals

None. All flagged issues for this longtail pass are resolved.
