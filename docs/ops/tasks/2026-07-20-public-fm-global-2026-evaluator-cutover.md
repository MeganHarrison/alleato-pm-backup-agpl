# Task: Cut Over Public FM Global Form to the 2026 Evaluator

Status: Pending Review
Owner: Codex S202
Created: 2026-07-20
Task ID: AAI-1205
Linear Issue: [AAI-1205](https://linear.app/megankharrison/issue/AAI-1205/cut-over-public-fm-global-form-to-the-2026-asrs-evaluator)
Related Handoff: `docs/ops/handoffs/2026-07-20-S202-public-fm-global-2026-evaluator-cutover.md`

## Objective

Make the public `/fm-global/form` evaluate and persist requirements through the same revision-scoped FMDS 8-34 April 2026 contract as the authenticated ASRS Intelligence estimator, while preserving public lead capture and explicit Pending Review results.

## Scope

- Owned public workflow: form inputs, server action, confirmation page, and persisted submission evaluation.
- Owned authenticated workflow: submission detail readback of the saved 2026 evaluation and citations.
- Owned shared contract: reusable ASRS result presentation plus revision identity in the estimator response.
- Owned database surface: additive traceability columns on `fm_form_submissions` in the dedicated ASRS Supabase project.
- Explicit exclusions: corpus activation, approval/rejection writes, AI chat routing, new engineering inference, and deletion of legacy lookup tables before cutover verification.

## Source of Truth

- Canonical runtime/data owner: dedicated ASRS Supabase project `vqnnvpnoitqhijkztyhq`, `public.evaluate_fmds_batch1_rules`, `public.fmds_corpus_revisions`, and `public.fm_form_submissions`.
- Existing shared primitives/services: `evaluateAsrsConfiguration`, `AsrsEstimatorResponse`, shared form controls, `StatusBadge`, `SectionHeader`, and the existing public submission workflow.
- Deprecated or parallel paths: `find_sprinkler_requirements`, `generate_optimization_recommendations`, `fm_global_tables`, `fm_global_figures`, and `fm_sprinkler_configs` in the public form action.

Verification contract: Required

## Attention Brief

- Primary user: public estimator prospect submitting an ASRS configuration.
- Primary job: submit project details and receive the currently supported, source-linked FMDS requirements.
- Primary decision: understand what is Verified and what remains Pending Review.
- Tier 1: submitted inputs, evaluation status, requirement values, and citations.
- Tier 2: corpus edition/revision and retained project/contact context.
- Hidden until requested: raw RPC JSON, internal row IDs, extraction diagnostics, and provider metadata.
- Removal candidates: legacy match/configuration cards and optimization output driven by the pre-2026 lookup model.
- Primary action: Submit requirements.
- Failure-loudly behavior: keep entered values, identify validation/evaluator/persistence failures, and never save a legacy fallback result.

## Workflow Map

- User action: submit `/fm-global/form` with contact, project, ASRS, and sprinkler-design inputs.
- Frontend owner: public FM Global form and confirmation route.
- Server owner: public form server action using `evaluateAsrsConfiguration`.
- Supabase owner: immutable corpus revision, Batch 1 evaluator, and additive submission trace fields.
- Side effects: one submission insert containing intake plus evaluator request/result.
- Expected success evidence: confirmation and authenticated submission detail show the same saved Verified/Pending Review requirements and citations; database readback matches.
- Expected failure behavior: no legacy lookup fallback and no partially persisted evaluation record.

## Acceptance Criteria

- [x] Public submissions call the shared 2026 evaluator and never call legacy matching/configuration RPCs or tables.
- [x] The public form captures the required sprinkler type and design sprinkler count without duplicating the authenticated evaluator implementation.
- [x] Each new submission stores corpus revision identity, evaluator key, normalized evaluator inputs, full result, and aggregate status.
- [x] Confirmation and authenticated detail pages show the saved edition, requirements, statuses, and citations.
- [x] Unsupported outputs remain Pending Review and the April 2026 corpus remains staging.
- [x] Evaluation or persistence failures are specific and do not silently fall back to legacy data.
- [x] Desktop and mobile public submission flows persist and reload successfully.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Generate and apply an additive ASRS migration for submission traceability.
- [x] Add revision identity to the shared typed estimator result.
- [x] Extract one shared result presentation component and reuse it on authenticated and public surfaces.
- [x] Replace the public server action's legacy lookup pipeline with the shared evaluator.
- [x] Update public input mapping and saved-submission readers.
- [x] Add focused contract, action, persistence, legacy-path, and rendering tests.
- [x] Post kickoff, milestone, evidence, and handoff comments to AAI-1205.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Migration ledger and live ASRS schema readback pass.
- [x] Public create, redirect, reload, authenticated detail, and database readback pass.
- [x] Desktop and mobile screenshots are attached to AAI-1205.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and remote branch equality is verified.

## Failure-Loudly Contract

- Cause surfaced as: invalid public input, missing ASRS environment, evaluator failure, unsupported rule, or submission persistence failure.
- Detection path: inline form error, typed server exception, focused tests, database readback, and browser replay.
- Recovery path: correct the named input/configuration and resubmit; unresolved engineering outputs remain Pending Review rather than using legacy tables.

## Incident Learning

- Failure fingerprint: `server-action-non-async-export`
- Root cause: the first browser compilation failed because the `use server` action module exported a string constant; Next.js permits only async function exports from that boundary.
- Detection gap: focused TypeScript and unit checks did not compile the action through the Next.js server-action transform.
- Prevention: evaluator identity now lives in the shared estimator contract, and the public-action regression test rejects exported variables from the server-action module.
- Guardrail evidence: focused Jest passes the non-async-export assertion; browser create/redirect/reload passes after the boundary correction. No recurring-failure registry match was found, so no registry entry was added for this pre-publication defect.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1205, this task file, S202 handoff, and session-board claim | Pass | Full workflow and verification gate recorded before implementation. |
| ASRS migration | `20260720213133_add_public_submission_evaluation_trace.sql` plus local/remote ledger readback | Pass | Local and remote both contain migration version `20260720213133`; traceability columns, constraints, index, and RLS are live. |
| ASRS access control | Live privilege and RLS readback | Pass | Anonymous and authenticated insert/select are denied; RLS is enabled; service role retains access. Existing advisor warnings are outside this migration. |
| Focused tests | Five Jest suites / 13 tests | Pass | Covers evaluator contract, server integration, API route, public action atomicity/no fallback, server-action export guardrail, and shared result rendering. |
| Targeted static checks | ESLint, `check:routes`, design no-new-form/no-new-disables/ratchet, `typecheck:changed`, `git diff --check` | Pass | Design ratchet reports 1500 current violations below baseline 3416; no new `any` or diff whitespace errors. |
| Full typecheck | `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit --pretty false` | Unrelated fail | 540 existing diagnostics across daily briefs, AI assistant, communication tools, executive artifacts, DrawingService, companyService, and permissionService; none reference AAI-1205-owned ASRS/FM paths. |
| Browser create/reload | `/fm-global/form` to `/fm-global/form/submitted/be6cd121-1483-4e13-9e3f-ac76319bb2e3` | Pass | Submission redirects, reloads, and renders saved verified hose demand plus three Pending Review requirements with citations. |
| Browser failure path | Missing design sprinkler count | Pass | Inline error says to enter a whole-number count greater than zero; no partial row is persisted. |
| Authenticated readback | `/fm-global/submissions/be6cd121-1483-4e13-9e3f-ac76319bb2e3` | Pass | Admin detail renders the saved evaluator key, aggregate status, requirements, and sources. |
| Database readback | Submission `be6cd121-1483-4e13-9e3f-ac76319bb2e3` | Pass | Revision `2026-04` remains `staging`; evaluator `fmds_batch1_v1`; status `pending_review`; four requirements; legacy match/configuration fields are null. |
| Desktop screenshot | `docs/ops/evidence/2026-07-20-public-fm-global-2026-evaluator-cutover/public-submission-results-desktop.png` | Pass | Attached to AAI-1205 as `d679c0d1-cb95-4c02-b628-d21990b22294`. |
| Mobile screenshot | `docs/ops/evidence/2026-07-20-public-fm-global-2026-evaluator-cutover/public-submission-results-mobile.png` | Pass | Attached to AAI-1205 as `199e1ac2-5656-4b3b-9ef1-384ea2e6a751`; 390 px viewport has no horizontal overflow. |
| Publication | Commit `25a75e282de5f20d2a85cdd790293ffad4b8b8c1` | Pass | Local `HEAD` equals `origin/feat/asrs-intelligence`. |

## Remaining Risk

- The reviewed Batch 1 evaluator does not yet provide complete sprinkler-head count/configuration/full-compliance coverage; those outputs must remain Pending Review.
- The repository-wide typecheck remains red from unrelated existing diagnostics; changed-file checks and all five focused suites pass.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
