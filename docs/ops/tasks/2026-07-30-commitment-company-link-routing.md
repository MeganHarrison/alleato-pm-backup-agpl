# Task: Route Commitment Company Links to the Commitment

Status: Complete
Owner: Codex S019fb56a
Created: 2026-07-30
Task ID: BUG-COMMITMENT-COMPANY-LINK
Linear Issue: Not requested; local bounded bug fix
Related Handoff: N/A

## Objective

Clicking the Company value in a project commitments table opens that row's
commitment detail page instead of the global company directory record.

## Scope

- Own the shared commitments table Company-cell destination and its focused unit test.
- Exclude unrelated company-detail rendering defects and commitment data changes.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/features/commitments/commitments-table-config.tsx`
- Existing shared primitives/services: `CellLink` and the existing commitment detail route
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Company, Number-row, and Title interactions resolve to the selected commitment.
- [x] The Company cell no longer routes to `/directory/companies/{companyId}`.
- [x] A focused regression test asserts the Company link destination.
- [x] The authenticated production route is captured after publication.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted unit check passes.
- [x] Authenticated commitments-page click proves the destination.
- [x] Current final-route screenshot is recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and current `origin/main` contains the fix.

## Failure-Loudly Contract

- Cause surfaced as: focused unit assertion compares the Company-cell `href` to the commitment route.
- Detection path: focused Jest test plus authenticated browser click.
- Recovery path: restore the Company renderer to the canonical commitment detail URL.

## Incident Learning

- Failure fingerprint: `N/A` (no matching routing-specific lesson)
- Root cause: The Company renderer owned a separate global-directory destination from the row and Title renderers.
- Detection gap: Existing tests asserted the Title link but did not assert the Company link.
- Prevention: Keep explicit destination assertions for every linked identity column.
- Guardrail evidence: Focused Company-cell destination test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Red-capable regression | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/features/commitments/__tests__/commitments-table-config.test.ts` | Failed as expected | Expected the commitment URL; received `/directory/companies/company-1`. |
| Focused regression | Same focused Jest command | Passed | 9/9 tests passed. |
| Focused lint | `npx.cmd eslint src/features/commitments/commitments-table-config.tsx src/features/commitments/__tests__/commitments-table-config.test.ts --quiet` | Passed | No output. |
| Independent review | Code reviewer | Approved | No findings. |
| Production database configuration | Vercel Production `DATABASE_URL` | Passed | Replaced the direct Supabase host with the verified PM APP transaction-pooler connection; credentials were not logged or committed. |
| Production dependency repair | `121e4b38ef893b44eb0380b85aa497b663a8fa5f`, `ddfd6bda5dfa2f16908366a541bd9aea3366cd74` | Passed | Declared the runtime editor, animation, and realtime collaboration packages required by the production compiler. |
| Route-budget recovery | `2efac2ccaba12b05412be760bb040327d8306485` | Passed | Vercel's 2,048-route rejection was resolved without excluding project, commitment, invoice, or billing-period routes. |
| Production deployment | `dpl_F9vpvyvhKcQnpWP4UeCkVtzZw3NP` | Ready | Commit `2efac2c`; `projects.alleatogroup.com` assigned to the deployment. |
| Authenticated live click | `/1149/commitments` Company link | Passed | `Americast Development Company LLC` had href `/1149/commitments/e6233b1c-8ef3-4e13-9b47-bc84bfea262f`; clicking loaded the SC-001 Shoring commitment detail with no error boundary. |
| Current final-route screenshot | `C:\Users\Brandon\.codex\visualizations\2026\07\30\019fb56a-0779-7542-a8af-4ff9483f8c23\commitment-company-link-live.png` | Passed | Captured after the authenticated production click. |
| Combined focused regression | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/__tests__/middleware-legacy-redirect.test.ts src/lib/routing/__tests__/legacy-route-redirect.test.ts src/features/commitments/__tests__/commitments-table-config.test.ts` | Passed | 20/20 tests passed; only the 9 commitment tests are part of the published click fix. |

## Remaining Risk

- No known remaining risk for the Company-cell destination. The separate
  production route-budget task documents the bounded internal endpoints
  excluded to keep Vercel below its hard provider limit.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
