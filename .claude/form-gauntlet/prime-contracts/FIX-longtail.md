# Prime Contracts — Long-tail Fix Report

**Date:** 2026-06-14
**Session:** fix-longtail (post-FINAL-REPORT)

---

## Issues Fixed

### 1. Error swallowing in PCO pages and payments_sync

**Root cause:** Every catch block built a proper `Error(serverMessage)` but then called `toast.error("Failed to …")` with a hardcoded string, discarding the Error object entirely.

**Fix:** In all catch blocks, surface `err instanceof Error ? err.message : String(err)` as the toast message. Files changed:
- `prime-contract-pcos/[pcoId]/edit/page.tsx` — `loadPco` catch + `handleSave` catch
- `prime-contract-pcos/[pcoId]/page.tsx` — `handleDelete` catch + `handlePromote` catch
- `prime-contract-pcos/page.tsx` — `handleDelete` catch + `handlePromote` catch + `handleBulkPromote` catch
- `prime-contract-detail/PrimeContractPaymentsTab.tsx` — `handleSyncERP` catch (already used `apiFetch`; only the toast was wrong)

### 2. Raw `fetch` → `apiFetch` in PCO pages

**Root cause:** All three PCO-facing pages (`edit/page.tsx`, `[pcoId]/page.tsx`, `page.tsx`) used raw `fetch` instead of the guardrailed `apiFetch` from `@/lib/api-client`. This bypassed the automatic JSON error body parsing, deduplication, telemetry, and consistent error typing.

**Fix:** Replaced every `fetch(…)` call in those pages with `apiFetch(…)` (or `apiFetch<T>(…)` where a typed return was needed). Removed manual `response.ok` checks and `response.json()` error-parse blocks — `apiFetch` throws `ApiError` with `.message` already set to the real server message.

### 3. Dead CO status `<select>` — removed

**Root cause:** The New Change Order dialog had a `<select>` with a single option (`"pending"`). It was inert UI noise — users could not change anything, and the server already defaults to `"pending"`.

**Decision:** Remove the control entirely. The backend `createChangeOrderSchema` defaults `status` to `"pending"` when omitted, so no behavioral change.

**Files changed:**
- `[contractId]/components/PrimeContractDialogs.tsx` — removed the status `<select>` block (11 lines)
- `[contractId]/types.ts` — removed `status: "pending"` from `ChangeOrderFormState`
- `[contractId]/page.tsx` — removed `status: "pending"` from all three `coForm`/`editCoForm` initializations and from the POST body in `handleCreateCo`

---

## Files Changed

| File | Change |
|------|--------|
| `prime-contract-pcos/[pcoId]/edit/page.tsx` | `apiFetch` import + raw fetch → apiFetch + surface real error in catches |
| `prime-contract-pcos/[pcoId]/page.tsx` | `apiFetch` import + raw fetch → apiFetch in fetchPco/handleDelete/handlePromote + surface real errors |
| `prime-contract-pcos/page.tsx` | `apiFetch` import + raw fetch → apiFetch in fetchPcos/handleDelete/handlePromote/handleBulkPromote/bulk-delete + surface real errors |
| `prime-contract-detail/PrimeContractPaymentsTab.tsx` | surface real error in handleSyncERP catch |
| `[contractId]/components/PrimeContractDialogs.tsx` | remove dead status select |
| `[contractId]/types.ts` | remove `status` field from `ChangeOrderFormState` |
| `[contractId]/page.tsx` | remove `status` from coForm/editCoForm inits and POST body |

---

## Verification

- `npx tsc --noEmit` scoped to prime-contract files: **0 errors**
- `run-frontend-eslint.sh strict` on all changed files: **0 errors**

---

## Not changed / deferred

- `from_estimate` modal (`CreatePrimeContractFromEstimateModal.tsx`): already uses `apiFetch`; already surfaces `err.message` in `toast.error` description. No change needed.
- `pco_list_bulk_delete`: already surfaced first failure reason via `failed[0].reason?.message` — only needed raw fetch → apiFetch (done above).
- Nested contract context pages (`prime-contracts/[contractId]/change-orders/pcos/…/page.tsx`): are re-exports of the pages fixed above — no change needed.
