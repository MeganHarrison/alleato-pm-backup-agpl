# Task: Make ASRS Intake a Workspace Destination

Status: In Progress
Owner: Codex
Created: 2026-07-22
Task ID: AAI-1258
Linear Issue: [AAI-1258](https://linear.app/megankharrison/issue/AAI-1258/make-asrs-intake-the-canonical-workspace-entry)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-aai-1258-asrs-workspace-intake.md`

## Objective

An authenticated user can begin the existing ASRS intake from the ASRS workspace, then view the resulting assessment without leaving ASRS.

## Scope

- Add the existing intake form as `/asrs/intake` and make it the first ASRS workspace tab.
- Add one direct assessment action to the ASRS chat landing page.
- Reuse existing form validation, submission, evaluator, and persistence logic.
- Add an ASRS-scoped submitted-result route backed by the same record reader.
- Excluded: chat routing, RAG behavior, deterministic estimator calculations, corpus activation, taxonomies, pricing, and database contracts.

## Source of Truth

- Canonical intake form: `frontend/src/app/(public)/fm-global/form/fm-global-client.tsx`
- Canonical intake fields: `frontend/src/app/(public)/fm-global/form/fm-global-form.tsx`
- Submission persistence: `frontend/src/app/(public)/fm-global/form/actions.ts`
- Existing submitted-result reader: `frontend/src/app/(public)/fm-global/form/submitted/[submissionId]/page.tsx`
- ASRS workspace navigation: `frontend/src/lib/fmds/asrs-workspace.ts`

Verification contract: Required

## Attention Brief

- Primary user/job: an ASRS operator beginning an assessment.
- Primary action: start and submit the intake.
- Secondary actions: ask ASRS chat questions; inspect tables and figures.
- Information that belongs elsewhere: RAG history, corpus diagnostics, pricing, taxonomy maintenance, and estimator-rule administration.
- Blessed pattern: PageShell form page and shared workspace tabs.
- Complexity budget: one form per page, one primary submit action, no dashboard cards.
- Failure-loudly behavior: existing field validation and persisted-submission failure messages remain visible.

## Acceptance Criteria

- [ ] `/asrs` exposes one direct `Start assessment` action.
- [ ] `/asrs/intake` renders the existing shared intake without a duplicate form implementation.
- [ ] An intake submitted from ASRS lands on `/asrs/intake/submitted/[submissionId]`.
- [ ] The existing public form remains operational and keeps its current public result route.
- [ ] ASRS tabs consistently expose Assessment, Chat, Tables, and Figures.
- [ ] Desktop and mobile browser proof exists on canonical ASRS routes.

## Implementation Checklist

- [x] Add an optional submitted-result base path to the shared form client.
- [x] Extract the public submitted-result presentation into a reusable export.
- [x] Add ASRS intake and submitted-result route adapters.
- [x] Add Assessment to shared ASRS workspace tabs and a direct ASRS chat action.
- [ ] Run focused static checks and an authenticated browser flow.

## Failure-Loudly Contract

- Cause surfaced as: field validation, submission write failure, or missing submitted record.
- Detection path: existing form validation, server action errors, submitted-route not-found state, and browser flow.
- Recovery path: correct the named field, retry submission, or return to the intake route.

## Incident Learning

- Failure fingerprint: ASRS intake was only reachable from a separate FM Global surface.
- Root cause: the ASRS workspace was created around chat and corpus review without including the existing intake workflow.
- Detection gap: route-level review verified chat/tables/figures but not the end-to-end entry workflow.
- Prevention: ASRS workspace tabs own the assessment entry point and result return path.
- Guardrail evidence: shared route/tab contract plus desktop and mobile canonical-route screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1258 | Pass | Scope recorded before product edits. |

## Remaining Risk

- The existing estimator is a review-gated workflow, not a deterministic engineering design tool. This UI work must not imply otherwise.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Task-owned files are published and remote SHA readback is recorded.
