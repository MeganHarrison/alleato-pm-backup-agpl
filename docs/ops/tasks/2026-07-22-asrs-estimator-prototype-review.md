# Task: ASRS Estimator Prototype Review

Status: In Progress  
Owner: Codex (evidence and implementation readiness); Brandon (ASRS domain decisions)  
Created: 2026-07-22  
Task ID: AAI-1223  
Linear Issue: [AAI-1223](https://linear.app/megankharrison/issue/AAI-1223/prototype-the-reviewable-asrs-bom-and-estimate-result)  
GitHub Tracker: [Issue #74](https://github.com/The-Alleato-Group/project-management/issues/74)  
Related Handoff: `docs/ops/handoffs/2026-07-21-brandon-asrs-estimator-codex-handoff.md`

## Objective

Obtain Brandon's explicit acceptance or correction of the complete Phase 1 manual-input, coordinate, fabrication, BOM, pricing, result-page, and blocked-result contract before product implementation begins.

## Scope

- Own the evidence-backed prototype-review contract and nine sequential Brandon decisions.
- Prepare source-linked inputs, vocabulary, topology, selector, and deterministic fixtures that make each decision concrete.
- Keep Decision 1 as the only active question until Brandon answers it.
- Exclude product code, migrations, rule activation, database schema, supplier ingestion, and production estimator UI until Milestone 1 is accepted and the AAI-1224 implementation sequence is defined.
- Verification contract: Not applicable to runtime behavior in this decision-only task. Repository/external tracker evidence is still required; eventual product implementation has a separate required end-to-end verification contract.

## Source of Truth

- Canonical domain contract: `docs/ops/handoffs/2026-07-21-brandon-asrs-estimator-codex-handoff.md`
- Durable accepted-decision owner: `docs/ops/handoffs/2026-07-21-brandon-asrs-estimator-decision-log.md`
- Direct Brandon review surface: GitHub issue #74
- Historical/mirrored tracker: Linear AAI-1223
- FMDS evidence owner: ASRS Supabase project, revision `65306e47-c25a-4397-92a0-c44c03903d0f` (`FMDS0834 / 2026-04`)
- Existing shared runtime owners: `frontend/src/app/(main)/fm-global/**`, `frontend/src/components/fm-global/**`, and `frontend/src/lib/fmds/**`
- Existing reviewed Batch 1 evaluator: reusable infrastructure and fail-closed pattern, but not the Phase 1 geometry/takeoff calculator

## Acceptance Criteria

- [x] Complete reviewed FMDS corpus coverage is proven without treating review/embedding as rule activation.
- [x] Complete Phase 1 input dependencies are traced across FMDS, coordinates, fabrication, recipes, and quotes.
- [x] Horizontal selector and figure-topology boundaries preserve exact revision/source provenance.
- [x] Deterministic fixtures prove coordinate-first counting, spacing failure, endpoint validation, piece partitioning, outlet ownership, ambiguity, and blocked propagation.
- [x] Failure-loudly behavior is defined for every current prototype dependency.
- [x] Brandon has one direct review surface and does not depend on Megan or Linear access.
- [ ] Decision 1 — complete manual input availability/naming — accepted or corrected by Brandon.
- [ ] Decision 2 — geometry vocabulary — accepted or corrected one term at a time.
- [ ] Decision 3 — row/level/line multiplication model — accepted or corrected.
- [ ] Decision 4 — 2.5 ft pass / 2.75 ft fail explanation — accepted or corrected.
- [ ] Decision 5 — outlet-to-piece ownership and four-outlet fixture — accepted or corrected.
- [ ] Decision 6 — BOM categories and derived/manual ownership — accepted or corrected.
- [ ] Decision 7 — supplier scenario/line selection — accepted or corrected.
- [ ] Decision 8 — dedicated result-page journey — accepted or corrected.
- [ ] Decision 9 — blocked-result wording — accepted or corrected.
- [ ] Brandon accepts the resulting prototype contract as Milestone 1.

## Decision Preparation Checklist

- [x] Reviewed 20-figure horizontal IRAS topology matrix published.
- [x] Four reviewed horizontal selector tables normalized into 29 logical rows.
- [x] Full Phase 1 input provenance traced across 51 relevant table entries.
- [x] Decision 2 vocabulary prepared as ten one-at-a-time questions.
- [x] Deterministic acceptance fixtures prepared and programmatically checked.
- [ ] Each Brandon response is recorded immediately in the durable decision log.
- [ ] Each accepted response is mirrored to GitHub issue #74 and Linear AAI-1223.
- [ ] Final prototype corrections are reflected in the handoff and acceptance fixtures.
- [ ] AAI-1224 implementation sequencing starts only after Milestone 1 acceptance.

## Integration and Verification

- [x] Targeted ledger/fixture checks pass for every published evidence artifact.
- [x] GitHub issue #74 contains the single active Decision 1 question and source-linked checkpoints.
- [x] Linear AAI-1223 contains mirrored milestone evidence.
- [x] All completed task-owned evidence artifacts were published to `origin/main` with remote content-hash readback.
- [ ] Brandon's reply is visible and attributable on GitHub issue #74.
- [ ] The durable decision log matches every accepted GitHub answer.
- [ ] A viewable completion screenshot is attached to the task/tracker and shows the accepted prototype-review state.
- [ ] Local canonical checkout is reconciled so `HEAD == origin/main` without losing unrelated session work.

## Failure-Loudly Contract

- Cause surfaced as: the exact missing decision, source input, ambiguous figure, geometry fact, rule/template, recipe, or quote match is named; dependent outputs remain nonnumeric.
- Detection path: targeted evidence verifier, GitHub Decision 1 response audit, task checklist, and eventual deterministic/browser acceptance tests.
- Recovery path: Brandon answers the one active decision; Codex records the answer, updates the contract/fixtures, and advances to the next single decision.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: The first Decision 1 question was described as complete after inspecting only the horizontal geometry layer; vertical-design, ceiling-design, material, and pricing dependencies had not been traced.
- Detection gap: No task file or end-to-end input-provenance checklist required every downstream dependency to be enumerated before the manual contract was presented to Brandon.
- Prevention: The Phase 1 input provenance matrix now traces FMDS, coordinate, fabrication, recipe, and quote dependencies before a completeness claim; this task file binds acceptance to all nine recorded decisions.
- Guardrail evidence: `docs/ops/evidence/2026-07-22-asrs-phase1-input-provenance-matrix.md` and `node scripts/ops/learning-registry.mjs lookup --symptom "ASRS manual input contract was declared complete before tracing all reviewed selector vertical design fabrication and pricing dependencies" --files docs/ops/handoffs/2026-07-21-brandon-asrs-estimator-codex-handoff.md,docs/ops/evidence/2026-07-22-asrs-phase1-input-provenance-matrix.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Corpus completion | `docs/ops/evidence/2026-07-21-fmds0834-table-corrections/final-corpus-verification.json` | Pass | 122/122 pages, 225/225 chunks, 58/58 tables, 60/60 figures; structured embeddings complete; revision still staging. |
| Open-top head-count source boundary | `docs/ops/evidence/2026-07-22-asrs-head-count-rule-candidate-matrix.md` | Pass | Ten reviewed open-top figures; 2.5 ft boundary passes and 2.75 ft boundary blocks. |
| Horizontal topology | `docs/ops/evidence/2026-07-22-asrs-horizontal-iras-topology-matrix.md` | Pass | 20/20 figures and source IDs across four families. Commit `6d01e1e696696fe47af7c859a3b2a8b1502df6e2`. |
| Horizontal selectors | `docs/ops/evidence/2026-07-22-asrs-horizontal-iras-selector-matrix.md` | Pass | 4/4 tables, 29/29 logical rows, final reviewed/embedded coverage. Commit `30113e72d09a3dd1ddf2247d8eefb026d392bf6b`. |
| Complete input provenance | `docs/ops/evidence/2026-07-22-asrs-phase1-input-provenance-matrix.md` | Pass | 51 relevant entries, 14 source dimensions, 10 locked contract dimensions. Commit `49e19a275f3f4d35849576028d105f13a3183151`. |
| Geometry vocabulary | `docs/ops/evidence/2026-07-22-asrs-geometry-vocabulary-review.md` | Pass | Ten ordered one-at-a-time terms. Commit `e73a0fe40c975f9dba0cd1b7a4ab57661a63121e`. |
| Deterministic fixtures | `docs/ops/evidence/2026-07-22-asrs-phase1-deterministic-fixture-matrix.md` | Pass | Coordinate, spacing, piece, outlet-boundary, mismatch, collision, and blocked-propagation checks. Commit `577bba8dd9a133225e5cd8d5753ffdba2d73359c`. |
| Brandon response | GitHub issue #74, Decision 1 comment `5040519553` | Pending | No comment from `bdclymer` yet. |

## Remaining Risk

- Brandon has not answered Decision 1. Owner: Brandon. Next action: answer the updated GitHub question with `Accepted` or corrected/unavailable fields.
- No approved horizontal-IRAS head-count rule card exists and the FMDS revision remains staging. Owner after prototype acceptance: AAI-1224 implementation sequence.
- Product code intentionally remains the older Batch 1 evaluator. Owner after prototype acceptance: AAI-1224 implementation sequence.
- The canonical checkout is behind `origin/main` and contains unrelated session files, so local `HEAD` reconciliation is deferred to the checkout owner; every task-owned artifact is independently verified on remote main.
- Completion screenshot is pending because the prototype-review milestone is not accepted.

## Final Status

- [ ] All required checklist items are complete.
- [x] Current evidence is filled in without claiming Milestone 1 acceptance.
- [x] Incident learning is linked.
- [x] Deferred implementation includes cause, detection gap, prevention step, owner, and next action.
