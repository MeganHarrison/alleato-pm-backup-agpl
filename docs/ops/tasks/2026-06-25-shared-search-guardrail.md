# Task: Shared Search Guardrail

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-673 - https://linear.app/megankharrison/issue/AAI-673/add-guardrail-against-page-local-search-inputs
Parent: AAI-647

## Objective

Prevent page-local search inputs from being introduced on app table/list
surfaces. The Comments page must use the same shared search primitive/pattern as
the rest of the app, and a hard lint guardrail must fail loudly when a local
search input is added instead.

## Attention Brief

Primary user: product/operator scanning records in table/list pages.
Primary job: use one consistent search pattern across the app.
Primary decision: filter records quickly without relearning page-specific input
styling or behavior.
Tier 1: shared search control and filter state.
Tier 2: status filters/counts.
Tier 3: page-local markup details.
Hide until requested: implementation-specific lint exceptions.
Remove: one-off search inputs and page-local search styling.
Primary action: search with the shared primitive.
Failure-loudly behavior: ESLint/check fails when a page/component adds a local
`Input`/`input` search control instead of the approved shared primitive.

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
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `frontend/src/app/(main)/comments/page.tsx` - replace comments search with unified `ExpandableSearch`.
- `frontend/src/app/(main)/[projectId]/drawings/viewer-v3/[drawingId]/page.tsx` - migrate current `ExpandingSearch` debt in touched app source.
- `frontend/src/app/(main)/directory/companies/[companyId]/page.tsx` - migrate current `ExpandingSearch` debt in touched app source.
- `frontend/eslint-plugin-design-system/rules/no-raw-search-input.js` - block raw search inputs and `ExpandingSearch`.
- `frontend/eslint-plugin-design-system/rules/no-raw-search-input.test.cjs` - rule contract proof.
- `scripts/lint-staged/run-frontend-eslint.sh` - escalate `no-raw-search-input` to error in strict changed-file lint.
- `docs/ops/tasks/2026-06-25-shared-search-guardrail.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `cd frontend && npx eslint ... 'src/app/(main)/comments/page.tsx' ... --rule 'design-system/no-raw-search-input:error'` | Pass | Changed app files pass with the search guardrail forced to error. |
| Static/type/lint | `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 npx tsc --noEmit --pretty false` | Pass | Full frontend typecheck passed with project large-heap setting. |
| Targeted tests | `cd frontend && node --test eslint-plugin-design-system/rules/no-raw-search-input.test.cjs` | Pass | Rule catches raw `<Input placeholder="Search...">` and `ExpandingSearch`; allows `ExpandableSearch`. |
| Targeted tests | `cd frontend && npx jest --runInBand --runTestsByPath 'src/app/(main)/comments/__tests__/comments-page-utils.test.ts'` | Pass | Comments filtering utilities still pass. |
| Browser/user-flow | `agent-browser open http://localhost:3001/comments`; `agent-browser snapshot -i`; Playwright authenticated smoke | Pass | Snapshot showed `Search comments` as a collapsed unified icon button; Playwright expanded it to one textbox and filtered for `KPI`. Screenshots: `docs/ops/evidence/2026-06-25-shared-search-guardrail/comments-unified-search.png`, `docs/ops/evidence/2026-06-25-shared-search-guardrail/comments-unified-search-filtered.png`. |
| DB/provider read-back | Not applicable | Pass | No schema migration or provider config changed. |
| End-to-end proof | ESLint rule test + `/comments` browser proof | Pass | The old selected always-open input is gone; changed-file strict lint now blocks recurrence. |

## Files Changed

- `docs/ops/tasks/2026-06-25-shared-search-guardrail.md` - task ledger and evidence.
- `frontend/src/app/(main)/comments/page.tsx` - Comments uses unified `ExpandableSearch`.
- `frontend/src/app/(main)/[projectId]/drawings/viewer-v3/[drawingId]/page.tsx` - migrated to `ExpandableSearch`.
- `frontend/src/app/(main)/directory/companies/[companyId]/page.tsx` - migrated to `ExpandableSearch`.
- `frontend/eslint-plugin-design-system/rules/no-raw-search-input.js` - expanded rule coverage.
- `frontend/eslint-plugin-design-system/rules/no-raw-search-input.test.cjs` - direct rule proof.
- `scripts/lint-staged/run-frontend-eslint.sh` - strict changed-file enforcement.

## Risks / Gaps

- Existing checkout has unrelated dirty files. Stage only task-owned files.
- `frontend/src/app/(main)/comments/page.tsx` had a pre-existing larger uncommitted rewrite. Publish must stage only the search-related hunk unless that rewrite is intentionally included by its owner.
- A full global `no-raw-search-input:error` scan still reports existing raw-search debt outside this task. This task prevents new/changed-file recurrence and migrates the current `ExpandingSearch` instances in changed app surfaces.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
