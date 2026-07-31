# Task: Redesign AI Operating System dashboard

Status: Completed
Owner: Codex
Created: 2026-07-21
Task ID: local-ai-os-dashboard-redesign
Linear Issue: Not required, direct user-requested visual redesign in the canonical checkout
Related Handoff: N/A, direct task

## Objective

Make the canonical AI Operating System route an executive operating surface with a clear first decision, dimensional charcoal section surfaces, and a calmer hierarchy.

## Scope

- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`
- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os.module.css`
- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-roadmap-kanban.tsx`
- `frontend/src/app/(main)/ai-dashboard/workspace-shell.tsx`
- `frontend/src/app/(main)/ai-dashboard/__tests__/workspace-pages.test.tsx`
- Excludes data-source, navigation, and workflow-contract changes.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`
- Existing shared primitives/services: `WorkspacePageIntro`, `Heading`, `RoadmapKanban`
- Deprecated or parallel paths: N/A

Verification contract: Required

## Acceptance Criteria

- [x] The operating backlog is the first actionable planning surface.
- [x] Major sections use purposeful charcoal surfaces with stronger headings and breathable spacing.
- [x] Supporting telemetry no longer competes with active work.
- [x] The route is inspected in desktop and mobile browser states.

## Implementation Checklist

- [x] Canonical route and existing primitives are identified before edits.
- [x] The page hierarchy and localized visual system are updated without introducing a parallel page pattern.
- [x] A reduction pass removes duplicated or low-value presentation.

## Integration and Verification

- [x] Focused static checks pass.
- [x] Authenticated browser screenshots prove the desktop and mobile outcomes.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: N/A, the dashboard uses static illustrative data and introduces no new data loading path.
- Detection path: focused checks and rendered browser review expose layout, accessibility, or visual regressions.
- Recovery path: the canonical page continues to expose the retained roadmap and system telemetry without hiding operational data.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: The prior implementation treated all dashboard sections as equally important, delaying the active planning decision.
- Detection gap: A screenshot review did not target the page's lower planning surface.
- Prevention: Browser closeout now includes a targeted capture of the first decision surface and the page end.
- Guardrail evidence: task screenshots and focused static checks.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and visual hierarchy are fixed before implementation. |
| Focused lint | `cd frontend && npx eslint …` | Pass | Changed dashboard files have no lint errors. |
| Navigation regression | `cd frontend && npx jest --runInBand --runTestsByPath src/app/(main)/ai-dashboard/__tests__/workspace-pages.test.tsx` | Pass | 8 tests passed. |
| Complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs …` | Pass | All changed dashboard UI files passed. |
| Browser review | Desktop and 390px mobile screenshots under `docs/ops/evidence/2026-07-21-ai-os-dashboard-redesign*` | Pass | Desktop hierarchy, lower roadmap, and mobile no-overflow state inspected. |
| Publish | `git merge-base --is-ancestor f17c6cba0 origin/main` | Pass | The redesign commit is an ancestor of resolved `origin/main`. |

## Remaining Risk

- The data remains illustrative until live dashboard sources are connected; visual hierarchy must not be read as live operational truth.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] No work is deferred.
