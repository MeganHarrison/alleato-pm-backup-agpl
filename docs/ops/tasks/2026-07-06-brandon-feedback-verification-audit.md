# Task: Brandon Feedback Verification Audit

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-969
Linear URL: https://linear.app/megankharrison/issue/AAI-969/audit-remaining-brandon-feedback-inbox-items-not-marked-verified-with
Related Handoff: N/A

## Objective

Export every remaining feedback inbox item submitted by Brandon Clymer that is not marked verified (`closed` / `verified`), then verify current product truth for each item with fresh browser evidence.

## Non-Negotiable Done Rule

This task is not done until:

- [ ] The in-scope feedback rows are pulled directly from the current `admin_feedback_items` source of truth.
- [ ] A durable export artifact exists in the repo for the remaining Brandon rows.
- [ ] Every in-scope item has a current classification: `Verified fixed`, `Not fixed`, `Deferred`, or `Unproven`.
- [ ] Every `Verified fixed` item has fresh route-level browser proof.
- [ ] Every item that is not actually done is explicitly called out rather than smoothed over.

## Scope Checklist

- [x] Create the current export of Brandon-submitted feedback rows excluding `closed` / `verified`.
- [x] Record route, title, status, issue links, and prior evidence pointers for each row.
- [x] Group items into efficient verification batches by route/workflow.
- [x] Capture fresh screenshot proof for each route-verified item.
- [x] Capture video recording proof for each verification batch where the workflow needs motion/interaction evidence.
- [x] Write final per-item verdicts and evidence paths back into this task file or linked evidence artifact.

## Verification Approach

- Intake source of truth: live `admin_feedback_items` rows, filtered to Brandon Clymer submissions that are not `closed` / `verified`.
- Completion source of truth: current browser behavior on the exact named route/workflow.
- Supporting evidence only: code, prior task docs, GitHub/Linear issue state, targeted tests, and older screenshots.
- This is an audit/proof pass first. Broken items should be recorded as broken rather than silently repaired.

## Proof Standard

- `Verified fixed`: exact route/workflow verified in-browser with fresh artifact(s) from this task.
- `Not fixed`: current route/workflow still contradicts the intended outcome.
- `Deferred`: intentionally not delivered by current product design or ownership choice.
- `Unproven`: implementation evidence exists, but fresh route-level proof is still missing or blocked.

## Planned Artifacts

- Export ledger: `docs/ops/evidence/2026-07-06-brandon-feedback-verification/export/brandon-feedback-unverified-export.json`
- Human-readable ledger: `docs/ops/evidence/2026-07-06-brandon-feedback-verification/export/brandon-feedback-unverified-export.md`
- Browser evidence root: `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/`
- Verification report: `docs/ops/evidence/2026-07-06-brandon-feedback-verification/brandon-feedback-verification-report.md`

## Audit Ledger

| Feedback ID | Status | Route | Title | Current Verdict | Screenshot | Video | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Exported 26 rows | Mixed | Mixed | Mixed | See linked report | See linked report | See linked report | Current verdicts are recorded in `docs/ops/evidence/2026-07-06-brandon-feedback-verification/brandon-feedback-verification-report.md`. |

## Evidence Log

| Check | Artifact / command | Result | Notes |
| --- | --- | --- | --- |
| Live Brandon export | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/export/brandon-feedback-unverified-export.json` | Pass | 26 current Brandon Clymer rows not marked `closed` / `verified`. |
| Human-readable export | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/export/brandon-feedback-unverified-export.md` | Pass | Route/title/status issue ledger for the same 26 rows. |
| Change Events proof batch | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/change-events/*` | Mixed | List route is live; exact detail and commitment CCO detail still show loading-state evidence. |
| Submittals proof batch | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/submittals/*` | Mixed-positive | Settings entry point is clearly present; export/email affordances exist; branding/output parity still not freshly proven. |
| Drawings proof batch | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/drawings/*` | Mixed | Page and export affordance visible, but local route had zero rows for fresh output verification. |
| RFI proof batch | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/rfis/*` | Mixed | Create form is live; list route had zero rows for fresh export proof. |
| Meetings proof batch | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/meetings/*` | Mixed-positive | Create meeting action is visible on the live route, but broader workflow proof remains incomplete. |
| Budget proof | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/budget/budget-page.png` | Fail for clean verification | Budget stayed in skeleton/loading state during this pass. |
| Tasks proof | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/tasks/*` | Fail for clean verification | Tasks route remained visibly loading instead of proving requested functionality. |
| Progress report proof | `docs/ops/evidence/2026-07-06-brandon-feedback-verification/browser/progress-reports/progress-report-876-fresh.png` | Fail for clean verification | Exact progress-report route stayed in skeleton/loading state. |

## Current Outcome

- Freshly verified fixed: `#550`, `#564`
- Freshly not fixed: `#555`, `#571`, `#582`, `#583`, `#590`
- Freshly unproven: 19 additional rows

Most of the remaining Brandon rows are still not actually proven done. The authoritative per-item ledger for this pass is `docs/ops/evidence/2026-07-06-brandon-feedback-verification/brandon-feedback-verification-report.md`.
