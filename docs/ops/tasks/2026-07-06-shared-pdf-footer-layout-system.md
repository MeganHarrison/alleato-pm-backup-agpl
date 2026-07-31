# Task: Shared PDF Footer Layout System

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-973 - https://linear.app/megankharrison/issue/AAI-973/shared-pdf-footerlayout-system-full-width-repeated-footer-plus-last
Related Handoff: docs/ops/handoffs/2026-07-06-S119-shared-pdf-footer-layout-system.md

## Objective

Create a shared PDF layout contract for branded report exports so footer and heading changes can be made once, then reused across PDF routes. Deliver the first migration through the weekly progress report PDF/email export path.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and current PDF export owners reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for shared PDF footer/layout behavior.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate footer paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing output follows the shared footer/layout contract.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for this workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core shared-footer behavior.
- [x] Contract test added/updated for report-to-layout integration.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the requested PDF outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] Shared PDF helper supports named footer/layout variants instead of one hardcoded repeated footer.
- [x] Repeated PDF footer is full width.
- [x] Standard non-final-page footer contains `Alleato Group`, report/document name, generated date, and `Page X of Y`.
- [x] Detailed location/contact footer renders only on the last page for progress reports.
- [x] Progress report download and progress report email attachment use the new shared layout contract.
- [x] Focused tests cover the shared footer/layout contract.

## Files Expected To Change

- `docs/ops/tasks/2026-07-06-shared-pdf-footer-layout-system.md`
- `docs/ops/handoffs/2026-07-06-S119-shared-pdf-footer-layout-system.md`
- `docs/ops/orchestration/session-board.md`
- `frontend/src/lib/documents/print-layout.ts`
- `frontend/src/lib/documents/branded-letterhead.ts`
- `frontend/src/lib/documents/pdf.ts`
- `frontend/src/lib/progress-reports/pdf.ts`
- `frontend/src/lib/progress-reports/__tests__/pdf.unit.test.ts`
- `frontend/src/app/api/projects/[projectId]/progress-reports/[reportId]/pdf/route.ts`
- `frontend/src/app/api/projects/[projectId]/progress-reports/[reportId]/email/route.ts`
- `frontend/src/lib/documents/__tests__/print-layout.unit.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Root-cause readback | `pdftotext '/Users/meganharrison/Downloads/Exol Morrisville Weekly Progress Report.pdf' -` | Pass | Sample PDF shows the detailed footer repeated on both pages instead of a simple repeated footer plus a last-page-only detailed footer. |
| Shared footer owner | `nl -ba frontend/src/lib/documents/branded-letterhead.ts | sed -n '121,145p'` | Pass | Confirmed the current shared footer helper hardcodes a centered `600px` layout and repeats the same footer on all pages. |
| Progress report route usage | `nl -ba frontend/src/app/api/projects/\[projectId\]/progress-reports/\[reportId\]/pdf/route.ts | sed -n '58,69p'` | Pass | Confirmed progress report PDF currently uses the repeated shared footer helper directly. |
| Focused Jest | `cd frontend && ./node_modules/.bin/jest --runInBand 'src/lib/documents/__tests__/print-layout.unit.test.ts' 'src/lib/progress-reports/__tests__/pdf.unit.test.ts' 'src/lib/documents/__tests__/pdf.unit.test.ts'` | Pass | Shared footer plan, progress report layout wiring, and Chromium guardrails all passed. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/lib/documents/print-layout.ts' 'src/lib/documents/branded-letterhead.ts' 'src/lib/documents/pdf.ts' 'src/lib/progress-reports/pdf.ts' 'src/lib/progress-reports/__tests__/pdf.unit.test.ts' 'src/lib/documents/__tests__/print-layout.unit.test.ts' 'src/app/api/projects/[projectId]/progress-reports/[reportId]/pdf/route.ts' 'src/app/api/projects/[projectId]/progress-reports/[reportId]/email/route.ts'` | Pass | No lint errors in the touched PDF layout and progress report files. |
| Changed-file type gate | `cd frontend && npm run typecheck:changed` | Pass | No new changed-file type debt introduced. |
| Synthetic PDF render proof | `/tmp/progress-report-footer-proof.pdf`, `docs/ops/evidence/2026-07-06-shared-pdf-footer-layout-system/pdfinfo.txt`, `page-1.txt`, `page-2.txt`, `progress-report-footer-proof-1.png`, `progress-report-footer-proof-2.png` | Pass | Rendered a 2-page proof showing the simple full-width footer on page 1 and the detailed footer only on page 2. |

## Risks / Gaps

- Chromium/Puppeteer footer templates repeat on every page; last-page-only detailed content must live in a post-processing layer or a non-template layout strategy.
- Other PDF routes still depend on the current shared footer helper, so the refactor must preserve existing callers while introducing explicit variants.
- No direct browser click-through verification was run against the `/progress-reports/[reportId]` route in this slice; proof is at the rendered PDF/output layer.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
