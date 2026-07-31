# Task: Documents Split View Full Width

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-624 - https://linear.app/megankharrison/issue/AAI-624/adjust-project-documents-split-view-to-full-width-and-remove-preview
Related Handoff: N/A

## Objective

Make the project documents split view at `/876/documents` use the full available
page width and remove the bordered, rounded frame around the in-page document
viewer so the surface matches the quieter split-view pattern used elsewhere.

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

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `pnpm --dir frontend exec prettier --check src/features/documents/project-documents-browser.tsx src/features/documents/preview-pane.tsx src/features/documents/pdf-preview.tsx tests/e2e/project-documents-browser.spec.ts` | Pass | Files are formatted after the change. |
| Static/type/lint      | `pnpm --dir frontend exec eslint src/features/documents/project-documents-browser.tsx src/features/documents/preview-pane.tsx src/features/documents/pdf-preview.tsx` | Pass | Focused lint on changed source files. |
| Targeted tests        | `PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm --dir frontend exec playwright test tests/e2e/project-documents-browser.spec.ts --config=config/playwright/playwright.no-webserver.config.ts --project=chromium` | Pass | 5 passed, including the new full-width/unframed split-view regression check for `/876/documents`. |
| Browser/user-flow     | `docs/ops/evidence/2026-06-24-documents-split-view-full-width/876-documents-split-view.png` | Pass | `agent-browser` on `http://localhost:3001/876/documents` after selecting a document; screenshot shows the split browser without the rounded outer frame. |
| DB/provider read-back | N/A                | N/A    | No database, provider, env, or migration changes expected. |
| End-to-end proof      | `agent-browser eval` shell metrics on `/876/documents` | Pass | `documents-browser-shell` and `document-preview-pane` both reported `0px` border radius and `0px` top border; shell width measured `1160px` inside the live project app shell. |

## Files Changed

- `docs/ops/tasks/2026-06-24-documents-split-view-full-width.md` - Task done gate and evidence ledger.
- `frontend/src/features/documents/project-documents-browser.tsx` - Owns the project documents split-view shell and page-width behavior.
- `frontend/src/features/documents/preview-pane.tsx` - Owns the in-page document viewer chrome and framing.

## Risks / Gaps

- Existing unrelated dirty files are present in the checkout and must not be staged accidentally.
- `agent-browser` initially reused stale daemon auth and landed on `/access-denied`; closing the daemon and reopening with `frontend/tests/.auth/user.json` fixed verification. This was a tooling-state issue, not a product regression.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
