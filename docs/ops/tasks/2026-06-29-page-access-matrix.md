# Task: Page Access Matrix

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-29
Linear Issue: Not created - available Linear connector exposes comment tools but no issue creation/update-state tool in this session.
Related Handoff: N/A

## Objective

Make `/site-map` a clear, easy-to-update review surface for page access policies without making the visual sitemap the authorization source of truth.

## Attention Brief

Primary user: App admin reviewing route access.
Primary job: Find pages whose access has not been explicitly reviewed and update the access level/module in place.
Primary decision: Which routes need explicit access policy review before trusting access behavior.
Tier 1: Routes with inferred access or `Needs Review` status.
Tier 2: Current access level, module, source, route, and page type.
Tier 3: Last reviewed, access updated time, source file, and references.
Hide until requested: Source metadata and long notes.
Remove: New summary cards, helper panels, duplicate CTAs, and decorative chrome.
Primary action: Select a route, update access/module, mark reviewed.
Failure-loudly behavior: Missing module for module-level access must be rejected by existing validation; routes that remain inferred stay visible in the review queue.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- `/site-map` has a focused access-review view for routes whose access still needs human review.
- The review view uses the existing table/detail editing controls and avoids a separate one-off access editor.
- Inferred access remains visible as a review risk until a route has an explicit saved policy.
- Module-level access still requires a permission module through existing API validation.
- No database, provider, migration, or authorization-source change is introduced in this UI slice.

## Files Planned

- `frontend/src/app/(admin)/site-map/site-map-client.tsx` - Add focused access-review workflow on existing Page Access table.
- `frontend/src/app/(admin)/site-map/__tests__/layout-options.test.ts` or adjacent site-map test - Extend route/tab taxonomy coverage if practical.
- `docs/ops/tasks/2026-06-29-page-access-matrix.md` - Task done gate and evidence ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| DB/provider read-back | N/A | N/A | UI-only page-access review workflow; no migration, provider config, or external service change. |
| Static/type guard | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt detected in changed changes. |
| Static/lint | `./node_modules/.bin/eslint 'src/app/(admin)/site-map/site-map-client.tsx' 'src/app/(admin)/site-map/__tests__/layout-options.test.ts'` | Pass | Focused lint on edited files. |
| Formatting | `./node_modules/.bin/prettier --check 'src/app/(admin)/site-map/site-map-client.tsx' 'src/app/(admin)/site-map/__tests__/layout-options.test.ts'` | Pass | Focused formatting check after write. |
| Targeted test | `./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/(admin)/site-map/__tests__/layout-options.test.ts'` | Pass | 3 tests passed; added access-review guardrail. |
| pnpm runner | `pnpm --dir frontend exec jest --runInBand --runTestsByPath 'src/app/(admin)/site-map/__tests__/layout-options.test.ts'` | Blocked before test | `ERR_PNPM_IGNORED_BUILDS`; switched to repo-local binary. |
| pnpm runner | `pnpm --dir frontend exec eslint 'src/app/(admin)/site-map/site-map-client.tsx' 'src/app/(admin)/site-map/__tests__/layout-options.test.ts'` | Blocked before lint | `ERR_PNPM_IGNORED_BUILDS`; switched to repo-local binary. |
| Browser/user-flow | `agent-browser open 'http://localhost:3001/site-map?tab=access-review' && agent-browser wait 1500 && agent-browser snapshot -i` | Blocked | Redirected to `/auth/login?callbackUrl=%2Fsite-map%3Ftab%3Daccess-review`; no authenticated admin browser session available in this run. |

## Files Changed

- `docs/ops/tasks/2026-06-29-page-access-matrix.md`
- `frontend/src/app/(admin)/site-map/site-map-client.tsx`
- `frontend/src/app/(admin)/site-map/__tests__/layout-options.test.ts`

## Risks / Gaps

- Existing unrelated dirty files are present in the checkout, including prior edits to `site-map-client.tsx`; this task must preserve them.
- Linear issue creation/update-state tools are not exposed in this session; the task file records that operational gap.
- Existing `app_page_access_policies` currently acts as review/update storage; broader route/page enforcement from the saved policies remains a separate hardening step.
- Browser proof is blocked by admin auth redirect in this unauthenticated session; owner next action is to verify `/site-map?tab=access-review` in an authenticated admin browser session.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
