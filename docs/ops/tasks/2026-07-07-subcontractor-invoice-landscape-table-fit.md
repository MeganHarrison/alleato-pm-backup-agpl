# Task: Subcontractor Invoice Landscape Table Fit

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-934 - https://linear.app/megankharrison/issue/AAI-934/match-subcontractor-invoice-pdf-export-to-procore-commitment-invoice
Related Handoff: docs/ops/handoffs/2026-07-07-S126-subcontractor-invoice-landscape-table-fit.md

## Objective

Fix the subcontractor invoice PDF export so the invoice detail table fits cleanly within the landscape page width instead of clipping or overflowing at the right edge.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Exact invoice PDF route and renderer inspected.
- [x] Current table cutoff reproduced or verified from the live renderer.
- [x] Shared table/layout seam identified before editing.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Landscape page sizing and table width constraints corrected.
- [x] Any repeated width math or table layout logic moved into a shared helper if needed.
- [x] Legacy or duplicate width handling removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing PDF output remains faithful to the current subcontractor invoice design while fitting within the page width.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow or rendered-PDF verification run for the actual invoice export.
- [x] Evidence artifacts recorded below.

## Acceptance Criteria

- [x] The subcontractor invoice PDF renders its table without cutting off content at the right edge.
- [x] The PDF remains landscape-oriented and uses the canonical invoice renderer route.
- [x] The invoice table preserves readable density and section ordering.
- [x] Regression tests cover the width/layout behavior.

## Files Expected To Change

- `frontend/src/lib/subcontractor-invoice-pdf.tsx`
- `frontend/src/lib/__tests__/subcontractor-invoice-pdf.unit.test.ts`
- `docs/ops/tasks/2026-07-07-subcontractor-invoice-landscape-table-fit.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Task setup | `docs/ops/tasks/2026-07-07-subcontractor-invoice-landscape-table-fit.md` | In progress | Working definition of done created before code changes. |
| Targeted Jest | `cd frontend && ./node_modules/.bin/jest --runInBand src/lib/__tests__/subcontractor-invoice-pdf.unit.test.ts` | Pass | Added a regression assertion for the narrower continuation table container. |
| Targeted ESLint | `cd frontend && ./node_modules/.bin/eslint src/lib/subcontractor-invoice-pdf.tsx src/lib/__tests__/subcontractor-invoice-pdf.unit.test.ts` | Pass | No lint errors on the touched invoice renderer files. |
| Live PDF render | `cd frontend && ./node_modules/.bin/tsx -e '(async()=>{ ... })()'` | Pass | Rendered the subcontractor invoice PDF and confirmed the continuation sheet page fits in landscape. |
| PDF evidence | `docs/ops/evidence/2026-07-07-subcontractor-invoice-landscape-table-fit/subcontractor-invoice.pdf` | Pass | Live PDF render used for inspection. |
| Page 2 proof | `docs/ops/evidence/2026-07-07-subcontractor-invoice-landscape-table-fit/page-2.png` | Pass | Continuation sheet table stays inside the page width. |
| Text proof | `docs/ops/evidence/2026-07-07-subcontractor-invoice-landscape-table-fit/subcontractor-invoice-page2.txt` | Pass | Text extraction confirms page-2 content and ordering. |

## Risks / Gaps

- The worktree already contains unrelated edits; only task-owned files should be touched or staged.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
