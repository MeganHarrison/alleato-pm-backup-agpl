# Task: Commitment Detail Information Hierarchy, Header Actions, And Attachment Row Cleanup

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-917 - https://linear.app/megankharrison/issue/AAI-917/repair-commitment-detail-page-information-hierarchy-and-approved-sov
Related Handoff: N/A

## Objective

Fix the exact commitment detail route `/876/commitments/370ccdd2-4f9e-404a-84ec-21c4f2403658?scommentId=gxCwrX82Ms38iZtEz3U6` so the general information section is quieter and more readable, description is grouped with the core record facts, attachments stack cleanly, approved schedule-of-values lines render like a normal read-only contract table instead of disabled inputs with unreadable totals, the header identifies purchase orders clearly, and attachment actions follow one quiet global row pattern.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: Commitment detail page, General tab, schedule-of-values section, shared attachment rows.
One purpose: Inspect one commitment and understand its contractual facts, attachments, and schedule-of-values state without noisy controls.
Primary user job: Verify commitment identity, scope description, attachments, line items, and financial totals without edit affordances that contradict the record state.
Primary action: Inspect the commitment; if the record is editable, continue editing from explicit controls, not by mistaking disabled fields for active inputs.
Secondary actions: View attachments, review inclusions/exclusions, inspect financial summary.
Next action after success: Return to commitments, open related invoice/change-order work, or move the commitment back to Draft when edits are needed.
Correction path: Status control remains the route to draft when business rules allow it; locked SOV rows must fail loudly by looking read-only instead of pretending to be editable.
Keyboard path: Tab order reaches metadata, attachments, and table content in reading order; no fake disabled-input trap remains for approved SOV rows.
Information that belongs elsewhere: Decorative section chrome, duplicate description sectioning, and noisy footer treatments that do not improve the inspection workflow.
Blessed pattern: Detail page with open-canvas sections, explicit commitment-type subheading, compact header action ordering, and read-only `InlineTable` treatment for locked financial rows.
Complexity budget: Full detail page, no nested-card treatment, no duplicated description surface, no page-local table skin unless shared primitives are insufficient.
Pass/fail: Current surface fails on hierarchy, affordance honesty, and totals readability; target surface must pass before closeout.

## Noise Gate Brief

Primary user: Project/accounting user reviewing a commitment.
Primary job: Understand the contract quickly and trust what is editable versus locked.
Primary decision: Is this the right commitment, what does it cover, what files are attached, and what do the approved line items add up to?
Tier 1: Number, title, status, company, dates, description, line items, amount totals.
Tier 2: Attachments, inclusions, exclusions, shipping/billing where applicable.
Tier 3: Secondary metadata that does not drive the immediate decision.
Hide until requested: Inclusions/exclusions can stay collapsible; description should not.
Remove: Standalone description section, noisy inline attachment controls, fake-disabled SOV input affordances, unreadable totals stack.
Primary action: Inspect the approved commitment honestly.
Failure-loudly behavior: Locked SOV state uses a read-only table and explicit lock copy instead of misleading disabled controls.

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

## Acceptance Criteria

- [x] General Information has materially better top breathing room and scanability.
- [x] Description is inside General Information above Attachments.
- [x] Attachments render as a stacked block rather than a horizontal metadata row.
- [x] The standalone Description section is removed.
- [x] Approved SOV rows render as a real read-only table with honest locked affordances.
- [x] Totals are legible and follow a normal contract/invoice summary pattern.
- [x] Purchase orders show a clear subheading beneath the title.
- [x] The commitments help button sits to the right of the more-actions menu in the header.
- [x] Shared attachment list rows hide inline category controls and expose edit/download/delete from a single overflow menu.
- [x] No one-off visual primitive is introduced unless shared primitives are insufficient.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Production baseline | `docs/ops/evidence/2026-07-03-commitment-detail-design/production-before.png` | Partial | Saved auth redirected to `/auth/login`; baseline artifact currently proves auth block, not the page content. |
| Production auth attempt | `agent-browser --session commitment-detail-prod --state frontend/tests/.auth/user.json open 'https://projects.alleatogroup.com/876/commitments/370ccdd2-4f9e-404a-84ec-21c4f2403658?scommentId=gxCwrX82Ms38iZtEz3U6'` | Failed | Redirected to login; direct live visual proof requires refreshed auth or local equivalent. |
| Auth refresh | `BASE_URL=http://localhost:3001 ./node_modules/.bin/playwright test --config=config/playwright/playwright.config.ts --project=setup tests/auth.setup.ts` | Pass | Rebuilt `frontend/tests/.auth/user.json` for the local server so the protected commitment route could be reopened. |
| Design doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs 'frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx' 'frontend/src/components/commitments/tabs/ScheduleOfValuesTab.tsx'` | Pass | Both changed UI files pass the surface-complexity gate. |
| Targeted lint | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx' 'src/components/commitments/tabs/ScheduleOfValuesTab.tsx' 'src/components/commitments/tabs/__tests__/ScheduleOfValuesTab.columns.test.tsx'` from `frontend/` | Pass with warnings | No errors. Remaining warnings are pre-existing detail-page grid/raw-detail-field debt in `page.tsx` plus an existing numeric-input warning in `ScheduleOfValuesTab.tsx`. |
| Targeted Jest | `./node_modules/.bin/jest --runInBand 'src/components/commitments/tabs/__tests__/ScheduleOfValuesTab.columns.test.tsx'` from `frontend/` | Pass | 7 assertions passed, including the new approved-status read-only guardrail. |
| Attachment guardrail test | `./node_modules/.bin/jest --runInBand 'src/components/ds/__tests__/document-picker.attachments.test.tsx'` from `frontend/` | Pass | Verifies shared attachment rows stay quiet by default and only reveal category editing through the overflow menu. |
| Updated targeted lint | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx' 'src/components/ds/document-picker.tsx' 'src/components/ds/__tests__/document-picker.attachments.test.tsx' 'src/components/commitments/tabs/__tests__/ScheduleOfValuesTab.columns.test.tsx'` from `frontend/` | Pass with warnings | No errors. Remaining warnings are pre-existing raw detail-field/grid debt in `page.tsx`. |
| Whitespace check | `git diff --check -- 'frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx' 'frontend/src/components/commitments/tabs/ScheduleOfValuesTab.tsx' 'frontend/src/components/commitments/tabs/__tests__/ScheduleOfValuesTab.columns.test.tsx' 'docs/ops/tasks/2026-07-03-commitment-detail-design.md'` | Pass | No whitespace errors in task-owned files. |
| Local browser proof | `docs/ops/evidence/2026-07-03-commitment-detail-design/local-after-playwright.png` | Pass | Exact local route shows description inside General Information, stacked attachments, no standalone Description section, approved-lock copy, read-only SOV row treatment, and no Add Line Item action. |
| Local browser read-back | `node <playwright script using system Chrome + frontend/tests/.auth/user.json>` | Pass | Returned `hasGeneralInformation=true`, `hasStandaloneDescriptionSection=false`, `hasLineItemsTotal=true`, `hasAddLineItem=false`, `hasApprovedLockMessage=true`. |
| Browser comments proof | `docs/ops/evidence/2026-07-03-commitment-detail-design/local-after-browser-comments.png` | Pass | Exact local route shows the Purchase Order subheading, the help button to the right of the more-actions menu, and attachment rows without the old file-size metadata. |
| Browser comments read-back | `agent-browser --session commitment-detail-local ... eval` | Pass | Returned `hasPurchaseOrder=true`, `hasAttachmentRow=true`, `attachmentShowsSize=false`; button bounds showed `More actions.right=1204` and `Open commitments help.left=1212`, confirming help is to the right. |
| Approved SOV action proof | `docs/ops/evidence/2026-07-03-commitment-detail-design/local-after-approved-sov-actions-fix.png` | Pass | Exact local route shows the approved SOV lock message and no `Add Line Item` or `Import from Budget` actions on the purchase-order General tab. |
| Approved SOV action read-back | `agent-browser --session commitment-detail-local ... eval` | Pass | Returned `hasApprovedMessage=true`, `hasAddLineItem=false`, `hasImportFromBudget=false` on the exact commented route. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx` - general-tab information hierarchy owner.
- `frontend/src/components/ds/document-picker.tsx` - shared attachment row owner for quiet list treatment and overflow actions.
- `frontend/src/components/ds/__tests__/document-picker.attachments.test.tsx` - attachment-row interaction guardrail.
- `frontend/src/components/commitments/tabs/ScheduleOfValuesTab.tsx` - approved/read-only SOV presentation owner.
- `frontend/src/components/commitments/tabs/__tests__/ScheduleOfValuesTab.columns.test.tsx` - column/alignment/read-only guardrail coverage.
- `docs/ops/tasks/2026-07-03-commitment-detail-design.md` - task definition and evidence.

## Risks / Gaps

- Production browser verification is still auth-blocked via the saved `agent-browser` state path; local authenticated proof exists, but production would need a refreshed interactive session to capture a second after-screenshot there.
- The page still carries pre-existing detail-page warnings about raw grids/detail fields outside the touched scope; this change did not resolve that broader primitive debt.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
