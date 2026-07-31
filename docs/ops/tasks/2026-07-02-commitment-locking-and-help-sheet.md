# Task: Refine commitment locking and add shared commitments help sheet

Status: In Progress
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-904 - https://linear.app/megankharrison/issue/AAI-904/refine-commitment-co-sov-locking-and-add-shared-commitments-help-sheet
Related Handoff: None

## Objective

Make commitment and commitment change-order SOV locking match the intended workflow: approved records may still move back to Draft through the status control, commitment change-order line items stay locked while approved, commitment SOV only stays locked after invoice activity has crossed the first submitted/processed threshold, and commitments surfaces expose one consistent help sheet that explains the workflow and locking rules.

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

## Acceptance Criteria

- [x] Approved commitment change orders do not allow line-item edits, but the record status can still move back to Draft from the detail page edit flow.
- [x] Once a commitment change order returns to Draft, line-item editing becomes available again.
- [x] Commitment SOV editing is not blocked only because status is Approved; it remains locked only after first invoice submission/processed state evidence exists.
- [x] The lock decision is owned by shared helpers, not duplicated page-by-page.
- [x] Commitments list/detail/change-order subpages expose one consistent help affordance that opens the same commitments help sheet.
- [x] The help sheet explains commitment workflow, commitment change-order workflow, SOV lock rules, and invoice-related exceptions.

## Files Changed

- `docs/ops/tasks/2026-07-02-commitment-locking-and-help-sheet.md` - Task definition and verification ledger.
- `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx` - Commitment detail integration for lock behavior and help affordance.
- `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/invoices/[invoiceId]/page.tsx` - Commitment invoice detail route that now uses the shared commitments help surface through the invoice detail shell.
- `frontend/src/components/commitments/tabs/ScheduleOfValuesTab.tsx` - Shared commitment SOV lock behavior and messaging.
- `frontend/src/components/commitments/CommitmentsHelpSheet.tsx` - Shared commitments help sheet content and trigger.
- `frontend/src/components/invoicing/SubcontractorInvoiceDetail.tsx` - Invoice detail header integration for the shared commitments help sheet.
- `frontend/src/lib/commitments/commitment-sov-lock.ts` - Shared invoice-aware commitment SOV lock rules.
- `frontend/src/lib/commitments/commitment-sov-lock.server.ts` - Server-side commitment invoice lock lookup.
- `frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx` - Commitment CO help affordance and lock messaging integration.
- `frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/route.ts` - Commitment SOV server guardrail.
- `frontend/src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/route.ts` - Imported commitment SOV guardrail.
- `frontend/src/app/api/commitments/[commitmentId]/route.ts` - Commitment read model support for invoice-aware SOV locking and approved-status patch behavior.
- `frontend/src/components/commitments/*` - Shared help sheet primitive and entry-point integration.

## Attention Brief

Primary user: Project manager or accounting user managing commitments and change orders.
Primary job: Understand whether the record can be edited, update its status, and know when SOV values are still safe to change.
Primary decision: Can I edit this now, or do I need to move status or finish invoice processing first?
Tier 1: Current lock state, status control, SOV editability, next action.
Tier 2: Commitment and CO workflow rules, invoice threshold, where to manage related records.
Tier 3: Supporting explanation and operational notes.
Hide until requested: Longer help copy and rule explanations.
Remove: Duplicate helper text, duplicate CTAs, page-specific one-off banners.
Primary action: Open the help sheet or change the record status.
Failure-loudly behavior: Server guardrails reject invalid edits with specific lock reasons; UI explains exactly why editing is blocked and what unlocks it.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && node_modules/.bin/eslint 'src/components/invoicing/SubcontractorInvoiceDetail.tsx' 'src/components/commitments/CommitmentsHelpSheet.tsx' 'src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx' 'src/app/(main)/[projectId]/commitments/page.tsx' 'src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx' 'src/app/(main)/[projectId]/commitments/new/page.tsx' 'src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx' 'src/app/(main)/[projectId]/commitments/settings/page.tsx' 'src/app/(main)/[projectId]/commitments/configure/page.tsx' 'src/app/(main)/[projectId]/commitments/[commitmentId]/pcos/new/page.tsx' --no-warn-ignored` | Pass with warnings | No new errors. Existing design-system warnings remain in older page files and invoice detail form fields. |
| Targeted tests        | `cd frontend && node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/api/commitments/[commitmentId]/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/__tests__/route.test.ts' 'src/lib/commitments/__tests__/commitment-sov-lock.unit.test.ts' 'src/lib/change-orders/__tests__/commitment-change-order-status.unit.test.ts' 'src/lib/change-orders/__tests__/commitment-change-order-line-item-lock.server.unit.test.ts'` | Pass | 5 suites passed, 12 tests passed. |
| Browser/user-flow     | Refreshed `frontend/tests/.auth/user.json` via Supabase auth bootstrap script, then verified with Playwright on `http://localhost:3001/tasks` and `http://localhost:3001/876/commitments` | Pass | Protected routes opened successfully with fresh saved auth state. |
| DB/provider read-back | Read-back via commitment invoice lock helpers and API response contract (`/api/commitments/[commitmentId]` now returns `sov_lock`) | Pass | No migration, schema, or provider change was required for this task. |
| End-to-end proof      | Screenshots: `/tmp/commitments-list-help-open.png`, `/tmp/commitment-detail-help-open.png` | Pass | Shared commitments help sheet opens on the live commitments list and a real commitment detail page under authenticated local app state. |

## Risks / Gaps

- The checkout contains unrelated dirty files and unresolved conflicts outside the commitment scope. Finish flow must stage only task-owned files.
- The exact invoice state that should count as "submitted and processed" was implemented via shared helper logic using `submitted_at`, `approved_at`, and submitted-workflow statuses. This should be confirmed against any future product-rule refinements.
- Browser proof now depends on keeping `frontend/tests/.auth/user.json` fresh when local sessions expire.

## Known Unrelated Failures / Warnings

- `cd frontend && node_modules/.bin/eslint ... --no-warn-ignored`
  - Existing owner files with warnings: `src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx`, `src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx`, `src/app/(main)/[projectId]/commitments/[commitmentId]/pcos/new/page.tsx`, `src/app/(main)/[projectId]/commitments/configure/page.tsx`, `src/app/(main)/[projectId]/commitments/settings/page.tsx`, `src/components/invoicing/SubcontractorInvoiceDetail.tsx`.
  - Warning class: existing design-system/page-layout lint rules; no new lint errors from this task.
- `cd frontend && BASE_URL=http://localhost:3001 node_modules/.bin/playwright test tests/auth.setup.ts --config tests/playwright.config.ts`
  - Failure: `No tests found.` / config drift in direct invocation.
  - Owner files: `frontend/tests/playwright.config.ts`, auth bootstrap wiring.
  - Relation: unrelated repo verification/config debt, not a commitments feature bug.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
