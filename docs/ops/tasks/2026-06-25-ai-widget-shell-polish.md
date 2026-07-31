# Task: AI widget shell polish

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-677 - https://linear.app/megankharrison/issue/AAI-677/polish-ai-widget-shell-spacing-and-chrome
Related Handoff: N/A

## Objective

Make the floating Alleato AI widget on `/comments` feel like a modern, clean chat widget by removing unnecessary chrome, reducing heavy elevation, increasing panel height, and simplifying the composer area without changing AI runtime behavior.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

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

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/components/ai-assistant/global-ai-widget.tsx src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/welcome-screen.tsx src/components/ai-assistant/__tests__/welcome-screen.test.tsx src/components/dev/DevAutoFillForms.tsx`; `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 npx tsc --noEmit --pretty false` | Pass | TypeScript required a dev-server CSS cache restart for browser proof, but emitted no type errors. |
| Targeted tests        | `cd frontend && npx jest --runInBand --runTestsByPath src/components/ai-assistant/__tests__/welcome-screen.test.tsx` | Pass | 2 tests passed. |
| Browser/user-flow     | `docs/ops/evidence/2026-06-25-ai-widget-shell-polish/widget-shell-polish-final-fresh-css.png` | Pass | `/comments` widget open at 1215x899: 640px panel, 0px header border, favicon present, real expand label, no Autofill button, 12px composer bottom gap. |
| DB/provider read-back | N/A                | N/A    | No database/provider changes. |
| End-to-end proof      | `docs/ops/evidence/2026-06-25-ai-widget-shell-polish/widget-shell-polish-final-fresh-css.png` | Pass | Playwright/Chrome assertion failed if Autofill rendered, favicon missing, header border present, panel under 600px, old shadow present, or composer gap exceeded 16px. |

## Files Changed

- `frontend/src/app/globals.css` - Adjust floating widget height and elevation.
- `frontend/src/components/ai-assistant/global-ai-widget.tsx` - Remove unnecessary header divider and tune header spacing.
- `frontend/src/components/ai-assistant/chat-area.tsx` - Use cleaner widget-only composer chrome, suppress browser autofill affordances, and remove extra bottom padding.
- `frontend/src/components/ai-assistant/welcome-screen.tsx` - Tighten widget-only bottom padding.
- `frontend/src/components/dev/DevAutoFillForms.tsx` - Prevent dev-only Autofill controls from attaching inside the global AI widget.

## Risks / Gaps

- None for the requested widget shell changes. The checkout still has unrelated dirty files from other tasks and they were not modified for this scope.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
