# Task: Repair Company Brain Layout Containment

Status: In Progress
Owner: Codex S202
Created: 2026-07-20
Task ID: AAI-1208
Linear Issue: AAI-1208, https://linear.app/megankharrison/issue/AAI-1208/fix-company-brain-shell-collision-and-page-title-layout
Related Handoff: `docs/ops/handoffs/2026-07-20-S202-company-brain-layout-repair.md`

## Objective

Make the Company Brain header, controls, graph metrics, and caption render inside the graph surface rather than overlapping the application chrome.

## Scope

- `frontend/src/app/(main)/ai-dashboard/workspace-primitives.tsx`
- `frontend/src/features/company-brain/company-brain-experience.tsx`
- `frontend/src/features/company-brain/knowledge-graph-canvas.tsx`
- `frontend/src/features/company-brain/hooks/use-knowledge-graph.ts`
- `frontend/src/features/company-brain/lib/mock-knowledge-data.ts`
- `frontend/src/features/company-brain/company-brain.module.css`
- A focused Company Brain layout regression test.
- No changes to graph data, API, navigation structure, or global shell.

## Source of Truth

- Canonical runtime owner: `/ai-dashboard/company-brain` and `CompanyBrainExperience`.
- Existing shared primitive: `PageShell` plus `AiDashboardWorkspaceShell`.
- Defect owner: scoped Company Brain CSS absolute-positioning context.

Verification contract: Required

## Acceptance Criteria

- [x] The shared AI Dashboard title section sits above the graph on desktop and mobile.
- [x] Graph metrics render below the graph as supporting context.
- [x] Time-range selection changes the displayed graph records and relationships.
- [x] Empty selected ranges fail loudly with a recovery path.
- [x] A focused regression guard asserts the required positioning context.
- [ ] Authenticated canonical-route screenshot is attached to AAI-1208 after deployment.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared dashboard primitives own the page title section.
- [x] The regression test prevents title/metrics from returning as graph overlays.
- [x] Focused tests cover date-range filtering and relationship recomputation.
- [x] Errors are specific and actionable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual live-system readback identified the authenticated route boundary; supplied production screenshot localized the visual defect.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: focused CSS regression test fails if `.root` no longer establishes the containing block for overlays.
- Detection path: Company Brain layout test and canonical route screenshot.
- Recovery path: restore scoped positioning context, then rerun the focused test and route proof.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: viewport-relative absolute overlays because the Company Brain root had no positioning context.
- Detection gap: the prior visual test did not assert the overlay containing block.
- Prevention: focused test asserts scoped root containment.
- Guardrail evidence: pending focused test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Runtime localization | Supplied production screenshot | Pass | Page title visibly intersects global application chrome. |
| Route access | `agent-browser open https://projects.alleatogroup.com/ai-dashboard/company-brain` | Pass | Correctly redirects unauthenticated session to login. |
| Focused unit tests | `jest --runInBand --runTestsByPath ...company-brain-layout.test.ts ...knowledge-graph.test.ts` | Pass | 15 assertions passed after shared-header refactor. |
| Surface complexity | `audit-surface-complexity.mjs` on three changed UI files | Pass | No budget violations. |
| Browser verification | Playwright local route readback | Blocked | Automation session is unauthenticated and redirects to login; the authenticated Codex browser tab remains the evidence source. |
| Time-range tests | `jest --runInBand --runTestsByPath ...knowledge-graph.test.ts ...company-brain-layout.test.ts` | Pass | 17 assertions, including filtered node/relationship behavior and relationship-count recomputation. |
| Focused lint | ESLint from the isolated worktree | Blocked | Worktree has no installed dependencies; ESM plugin resolution cannot cross into the shared checkout. The scoped Jest check passed. |

## Remaining Risk

- Authenticated production screenshot is required before closeout.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
