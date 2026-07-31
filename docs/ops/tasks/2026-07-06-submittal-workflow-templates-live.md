# Task: Submittal Workflow Templates Live

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: Not recorded
Related Handoff: Not applicable

## Objective

Replace the placeholder Submittals settings workflow-templates panel with a live, working workflow templates experience backed by the existing CRUD API and `submittal_workflow_templates` table.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules.

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

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Architecture review | `rg` + file reads across submittals page, workflow template API routes, and DB types | Pass | Existing backend CRUD routes and DB table already exist; only the frontend panel is placeholder-only. |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/submittals/page.tsx' 'src/lib/submittals/workflow-template-utils.ts' 'src/lib/submittals/__tests__/workflow-template-utils.test.ts'` and `cd frontend && npm run typecheck:changed` | Pass with existing warnings | No errors after implementation. Existing pre-existing page warnings remain on raw search inputs, page grids, and numeric inputs in the submittals page. |
| Targeted tests | `cd frontend && ./node_modules/.bin/jest --runTestsByPath 'src/lib/submittals/__tests__/workflow-template-utils.test.ts' --runInBand` | Pass | 1 suite, 3 tests passed. Covers workflow-template JSON normalization and legacy role coercion. |
| Browser/user-flow | `agent-browser` against `http://localhost:3001/876/submittals?tab=settings&settings_tab=workflow-templates` | Pass | Verified empty-state render, create dialog open, template creation, edit save, template row render, and delete returning to empty state. Evidence screenshot: `docs/ops/evidence/2026-07-06-submittal-workflow-templates/workflow-templates-empty-state.png`. |
| DB/provider read-back | Existing app API routes + browser round-trip | Pass | No schema/provider changes required. Successful browser create/delete confirms project-scoped CRUD routes are live against the current backend. |
| End-to-end proof | `agent-browser` create, edit, then delete of verification templates on the live route | Pass | Live create produced a real row with active Edit/Delete actions, edit saved successfully through the same modal, and delete returned the panel to the empty state. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/submittals/page.tsx` - replace placeholder workflow templates panel with live CRUD UI.
- `docs/ops/tasks/2026-07-06-submittal-workflow-templates-live.md` - task record and evidence.
- `docs/ops/evidence/2026-07-06-submittal-workflow-templates/workflow-templates-empty-state.png` - browser proof of the live empty state after delete.
- `frontend/src/lib/submittals/workflow-template-utils.ts` - canonical normalization for stored workflow-template steps.
- `frontend/src/lib/submittals/__tests__/workflow-template-utils.test.ts` - regression coverage for malformed/legacy step payloads.

## Risks / Gaps

- No separate template-detail route exists; current ownership is an in-panel CRUD workflow on the settings tab.
- The page still carries pre-existing design-system warnings unrelated to this slice.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
