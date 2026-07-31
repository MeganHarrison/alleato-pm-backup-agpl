# Task: Expose FMDS 8-9 Figures Awaiting Review

Status: Complete
Owner: Codex SROOT-FIGURE-REVIEW
Created: 2026-07-22
Task ID: AAI-1211
Linear Issue: [AAI-1211](https://linear.app/megankharrison/issue/AAI-1211/prepare-fmds-8-9-estimator-review-batch-1)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-fmds0809-figure-review-discovery.md`

## Objective

An ASRS reviewer opening `/asrs/figures` can see and open the staged FMDS 8-9 figures that still require review.

## Scope

- Make the ASRS figures workspace select the newest staged figure-review corpus, with active corpus as the explicit fallback.
- Keep figures revision-scoped; do not activate FMDS 8-9, alter review decisions, or change estimator rules.
- Reuse the existing figure table and detail-route pattern.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/fmds/fmds-figures.server.ts` backed by the dedicated ASRS Supabase project.
- Existing shared primitives/services: `GenericConfigUnifiedTable`, `fmdsFiguresConfig`, `/asrs/figures/[figureId]`.
- Deprecated or parallel paths: the hard-coded `FMDS0834` figure adapter, which hid newer staged review corpora.

Verification contract: Required

## Acceptance Criteria

- [x] FMDS0809 staged figures are returned by the review workspace instead of being hidden behind an FMDS0834 literal.
- [x] The visible description names the actual revision and its review state.
- [x] A figure evidence lookup accepts the selected revision without cross-revision leakage.
- [x] Targeted tests and a live ASRS readback prove the requested outcome.
- [x] A screenshot of the canonical figures artifact is attached to AAI-1211.

## Implementation Checklist

- [x] Localized the divergence: the ASRS figure adapter queried only `document_code=FMDS0834` while the staged FMDS0809 revision contains the pending figures.
- [x] Replace the document literal with a staging-first review-revision selector and active fallback.
- [x] Keep evidence URLs revision-scoped.
- [x] Show the selected revision context in the list surface.
- [x] Add/adjust focused coverage for the selection contract.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual live-system readback proves the FMDS0809 pending-figure count and selected revision.
- [x] Browser screenshot is recorded and attached to Linear.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: no staged or active corpus with extracted figures, missing source evidence, or an ASRS response missing revision identity.
- Detection path: revision-scoped adapter errors, focused tests, live ASRS readback, and canonical page screenshot.
- Recovery path: stage the named corpus/figure evidence, then reopen the figures workspace; no silent fallback to a different revision.

## Incident Learning

- Failure fingerprint: `rag.native-coverage-hides-structured-gaps`
- Root cause: `getFmdsFiguresPageData` enforced `FMDS0834` at the adapter boundary rather than selecting the current staged review corpus.
- Detection gap: corpus ingestion was verified independently of the reviewer-facing figures route.
- Prevention: staging-first revision selection with an explicit active fallback and focused selection tests.
- Guardrail evidence: focused adapter test and live readback recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | ASRS `fmds_corpus_revisions` / `fmds_figures` readback | Pass | FMDS0809 is staging with pending figures; the page adapter queried only FMDS0834. |
| Focused unit test | `pnpm --dir frontend exec jest --runTestsByPath src/lib/fmds/__tests__/fmds-figures.test.ts --runInBand` | Pass | 3/3 tests, including the staging review-corpus selector. |
| Targeted lint | ESLint on the figures adapter, config, page, and focused test | Pass | No errors. |
| Changed-file typecheck | `pnpm --dir frontend run typecheck:changed` | Pass | No new `any` type debt in changed files. |
| Finish quality gate | `npm --prefix frontend run quality:changed` | Unrelated blocker | It reports an existing warning in unowned dirty file `frontend/src/components/fmds/fmds-visual-review-form.tsx:143`; this task's focused lint and changed-file typecheck pass. |
| Live readback | ASRS PostgreSQL revision/figure aggregate | Pass | `FMDS0809|2026-04|staging|figures=37|pending=37`; FMDS0834 has 60 figures and 0 pending. |
| Canonical artifact | `docs/ops/evidence/2026-07-22-fmds0809-figure-review-discovery/asrs-figures-fmds0809-desktop.png` | Pass | Authenticated `/asrs/figures` shows FMDS0809, 37 rows, and `needs_review` status. Attached to AAI-1211 as Linear attachment `aa4f34bf-8509-4e49-9e69-45c8ae0559a7`; Linear milestone comment `7e2fc554-7d8e-4f2d-affa-d59c07b38760`. |

## Remaining Risk

- The figures remain `needs_review` until a reviewer records a decision; this task only restores their discoverability.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
