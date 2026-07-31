# Task: Verify Budget Functionality End To End

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-910 - https://linear.app/megankharrison/issue/AAI-910/full-budget-end-to-end-audit-and-repair-loop-excluding-erpintegrations
Related Handoff: None

## Objective

Verify the budget functionality from a real user perspective on the local app,
including the main budget tab, budget changes workflow, and the highest-risk
editable budget flows, with browser, API, and database evidence.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Procore budget baseline reviewed and documented.
- [x] Budget route owner files and API routes identified.
- [x] Success criteria written before browser testing.
- [x] Failure-loudly behavior defined for silent budget data loss.

## Verification Checklist

- [x] Exact local budget route chosen and documented.
- [x] Main budget tab inspected in browser with screenshots/video.
- [x] At least one editable budget flow executed end to end.
- [x] Resulting API/data read-back captured for tested flows.
- [x] Negative-path validation tested.
- [x] Edit/pre-fill behavior checked for dropdown/select fields.
- [x] Design-system audit completed for the verified surface.
- [x] Structured verification report written to `verify-output/budget-functionality/report.md`.

## Acceptance Criteria

- [x] The report states which budget flows pass, fail, or partially pass.
- [x] Every tested editable field has an explicit expected outcome and DB/API verification path.
- [x] Any Critical/High issue includes exact repro evidence and owner files.
- [x] Final response states what is done, what remains, and recommended next steps.

## Attention Brief

Primary user: PM/accounting user managing a project budget.
Primary job: View trusted budget financials and make changes without silent data loss.
Primary decision: Whether the budget page and its editing flows are safe to use.
Tier 1: Main budget truth and edit persistence.
Tier 2: Budget changes workflow and derived totals.
Tier 3: Non-critical secondary tabs/settings.
Primary action: Open budget, inspect values, create/update a budget-related record, confirm persistence.
Failure-loudly behavior: Any value entered but not persisted, any mismatch between UI selection and saved FK, any blank edit pre-fill, or any broken route/API response must be recorded with exact route, screenshot/video artifact, and read-back evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Task created | `docs/ops/tasks/2026-07-03-budget-functionality-verification.md` | Pass | Verification task opened before browser execution. |
| Procore baseline | `verify-output/budget-functionality/procore-spec.md` | Pass | Procore docs query + local manifest summarized before browser execution. |
| Success criteria gate | `verify-output/budget-functionality/success-criteria.md` | Pass | Browser work started only after criteria file existed. |
| Exact route | `http://localhost:3001/876/budget` and `http://localhost:3001/760/budget` | Pass | Locked and unlocked budget routes both verified live. |
| Main budget discovery | `verify-output/budget-functionality/screenshots/main-budget-form-discovery*.png` | Pass | Locked budget state, tabs, and grouped rows captured. |
| Budget change create flow | `verify-output/budget-functionality/videos/budget-change-creation.webm` | Pass | Created `BM-0006` via UI on locked budget path. |
| Budget change DB proof | `psql ... budget_modifications / budget_mod_lines` | Pass | `BM-0006` inserted as draft, then approved with matching +/- line rows. |
| Budget change approval | `verify-output/budget-functionality/screenshots/bm0006-pending.png`, `bm0006-approved.png` | Pass | UI status moved `draft -> pending -> approved`. |
| Budget rollup read-back | `curl /api/projects/876/budget` | Pass | Row-level budget modifications updated to `-749.45` and `749.45`; grand total netted to `0.00` as a balancing transfer. |
| Negative validation | `verify-output/budget-functionality/screenshots/budget-change-validation-empty.png` | Pass | Empty save showed specific validation toast and created no extra draft. |
| Design/accessibility audit | Browser console + grep | Pass | No hardcoded color/shadow regressions in checked files; budget-modification modal no longer reproduced the missing-description warning. |
| Unlocked original-budget edit | `verify-output/budget-functionality/screenshots/unlocked-budget-edit-*.png` | Pass | Calculated edit on project `760` persisted `Qty`, `UOM`, and `Unit Cost`, and the reopen modal prefilled all three values after the fix. |
| Live edit/prefill coverage | Project `760` unlocked edit flow | Pass | `Qty`, `UOM`, and `Unit Cost` now round-trip through save and reopen on the live route. |
| Unlocked create flow | `verify-output/budget-functionality/screenshots/unlocked-budget-line-created-03-8100.png` + DB/API read-back | Pass | Created `03-8100.S` on project `760` with `Qty=1`, `UOM=EA`, `Unit Cost=1`, verified it in DB/API, then cleaned it up. |
| Live delete guard recheck | Authenticated `DELETE /api/projects/760/budget/lines/78ffefab-9705-4e0c-b966-2bd68e238772` | Pass | Returns `409 INVALID_PAYLOAD` with `details.code=LINE_HAS_CHANGE_EVENT_REFERENCES` and the blocking change-event line id. |

## Risks / Gaps

- User did not specify a project route, so the local verification route may need to be inferred from current budget fixtures.
- Full budget functionality is broad; the verification will prioritize the highest-risk live user flows first and call out untested slices explicitly.
- Exact project `876` is budget-locked, so unlocked create/delete behavior was verified on project `760` instead of the original locked route.
- Grouped-table click-through delete on the exact `07-9200.S` row was not repeated after the route fix; the authenticated live delete route was re-verified directly instead.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
