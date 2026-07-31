# Task: Split Cost Code and Cost Type Selectors

Status: Implemented — Production browser proof blocked
Owner: SROOTCOST
Created: 2026-07-23
Task ID: LOCAL-COST-CODE-TYPE-SPLIT-2026-07-23
Linear Issue: N/A, local single-session Standard change
Related Handoff: N/A

## Objective

Budget and prime-contract line-item tables let a project manager choose the cost code and cost type in separate columns while still resolving the pair to one active project budget code.

## Scope

- Budget line-item creation table.
- Prime-contract create/edit and detail SOV tables.
- Shared selector behavior and regression coverage.
- Excludes commitments, change events, and other workflows that intentionally select a complete budget code in one control.

## Source of Truth

- Canonical runtime/data owner: `/api/projects/[projectId]/budget-codes`
- Existing shared primitives/services: `frontend/src/components/budget/budget-code-selector.tsx`, `frontend/src/hooks/use-project-budget-codes.ts`
- Deprecated or parallel paths: `frontend/src/components/domain/contracts/CostCodeSelector.tsx` loads unscoped master cost codes and is not suitable for project-budget-code resolution.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Cost Code options do not include the cost type.
- [x] A separate Cost Type column resolves the selected pair to the correct active project budget code.
- [x] Changing the cost code clears or corrects an incompatible cost type.
- [x] Existing saved selections hydrate both controls.
- [x] Missing or incompatible pairs are visibly invalid and cannot be silently submitted.
- [ ] Requested behavior is observable end to end. Blocked by empty production browser-auth environment values; rendered DOM coverage proves the changed client boundary.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned files:

- `frontend/src/components/budget/budget-code-field-selectors.tsx`
- `frontend/src/components/budget/__tests__/budget-code-field-selectors.test.tsx`
- `frontend/src/components/budget/BudgetLineItemCreatorModal.tsx`
- `frontend/src/components/domain/contracts/prime-contract-form/sov.tsx`
- `frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractSovTab.tsx`
- `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/components/PrimeContractOverviewTab.tsx`

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable. Production browser authentication is blocked as recorded below.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the Cost Type selector is disabled until a cost code is chosen; a selected code with no compatible type remains unresolved and the row keeps its required-field error state.
- Detection path: rendered selector regression test plus authenticated browser proof of both financial-entry flows.
- Recovery path: select a valid Cost Code, then choose one of that code's active Cost Types; use the existing create-budget-code action when the required pair is unavailable.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The shared budget-code selector models a composite project budget code as one visible choice and renders `fullLabel`, which concatenates cost code and cost type.
- Detection gap: Existing tests verify persistence resolution but do not assert independent field ownership in financial line-item tables.
- Prevention: Shared split selectors and rendered regression coverage for option labels, dependent types, and pair resolution.
- Guardrail evidence: `frontend/src/components/budget/__tests__/budget-code-field-selectors.test.tsx`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Production browser preflight | `npm run verify:browser-auth -- --base-url https://projects.alleatogroup.com --route / --session pm-cost-code` | Blocked | Vercel inventory contains the required variables, but downloaded production values are empty. |
| Selector and integration regression | `npm run test:unit -- --runInBand --silent src/components/budget/__tests__/budget-code-field-selectors.test.tsx src/components/domain/contracts/prime-contract-detail/__tests__/sov-summary-footer.test.tsx` | Pass | 2 suites, 11 tests. Covers labels, dependent type options, pair resolution, disabled invalid state, all four integration owners, table alignment, and SOV summary rows. |
| Owned-file lint | `npx eslint <six task-owned frontend files>` | Pass with unrelated warnings | Zero errors. Four pre-existing raw-number-input warnings remain in the existing SOV files. |
| Alleato surface audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs <five changed UI files>` | Pass | All changed UI files pass. The first draft's searchable popover was removed in favor of the blessed compact select pattern. |
| Typecheck | `npm run typecheck` | Blocked by unrelated repo debt | Exit 2; no task-owned file appears in the error output. First failures are `src/app/(admin)/admin/daily-briefs/[briefId]/fanout-client.tsx`, `src/app/(admin)/feedback-inbox/page.tsx`, and `src/app/(admin)/observability/page.tsx`. |
| Existing overview layout test | `npm run test:unit -- --runInBand --silent src/app/(main)/[projectId]/prime-contracts/[contractId]/components/__tests__/PrimeContractOverviewTab.layout.test.ts --runTestsByPath` | Existing unrelated failure | Test searches for a removed `Inclusions + Exclusions` section boundary. The same missing boundary exists at workspace `HEAD`; this task did not alter that section. |

## Remaining Risk

- Production browser authentication remains blocked because the Vercel production variables needed by `verify:browser-auth` download as empty values. This prevents a route screenshot and authenticated budget/prime-contract user-flow replay.
- Cause: the production environment inventory exposes the variable names, while readback returns empty values.
- Detection gap: the deployed app can continue serving while Codex's authenticated browser setup has no usable credentials.
- Prevention/next owner action: restore the production browser-auth/Supabase values in Vercel, verify them with `verify:browser-auth`, then replay the Budget Add Line Item and Prime Contract SOV edit flows and attach screenshots.

## Final Status

- [ ] All required checklist items are complete. Authenticated production proof remains blocked.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A. Captured inline above.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
