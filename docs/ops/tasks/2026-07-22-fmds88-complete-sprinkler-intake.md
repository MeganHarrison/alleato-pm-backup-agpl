# Task: Complete FMDS 8-34 Sprinkler Intake

Status: In Progress
Owner: Codex SROOT-FMDS88
Created: 2026-07-22
Task ID: GitHub #88
Linear Issue: Not used — GitHub issue [#88](https://github.com/The-Alleato-Group/project-management/issues/88) is the implementation tracker.
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-fmds88-complete-sprinkler-intake.md`

## Objective

Both canonical FMDS 8-34 intake surfaces collect one normalized, server-validated sprinkler specification, preserve entered facts, and name the exact missing or incompatible fact that prevents a sourced determination.

## Scope

- Shared estimator request/schema and existing public/authenticated intake adapters.
- Explicit recovery guidance and focused cross-surface validation coverage.
- Excludes deterministic sprinkler-head count, new rule-card authority, legacy lookup fallback, and FMDS 8-9.

## Source of Truth

- Canonical runtime/data owner: `AsrsEstimatorRequest` and `evaluateAsrsConfiguration`.
- Existing shared primitives/services: public FMDS form, authenticated ASRS estimator, evaluator schema/server adapter.
- Deprecated or parallel paths: legacy FM lookup and a second intake evaluator are excluded.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] Both intake surfaces collect the same normalized sprinkler specification and validate it server-side.
- [ ] Each additional fact is tied to a stated evaluator decision; no duplicate or decorative field is introduced.
- [ ] Invalid or incomplete inputs preserve entered values and return named recovery guidance.
- [ ] Public and authenticated access boundaries remain intact; no legacy fallback is added.
- [ ] Focused tests plus desktop/mobile authenticated browser proof cover a supported and blocked intake result.

## Implementation Checklist

- [x] Canonical field/query/schema owners are mapped before edits.
- [x] A failing contract test is added for each new shared validation/recovery condition.
- [x] Public and authenticated adapters reuse the shared request schema without divergent mapping.
- [x] Errors are source/revision-safe and actionable.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual public and authenticated user flows prove the requested outcome.
- [ ] Evidence artifacts are recorded.
- [ ] Independent review is complete.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: named missing or incompatible sprinkler fact, unsupported reviewed rule coverage, or evaluator revision failure.
- Detection path: shared schema tests, public/action and authenticated/API tests, then browser input/error evidence.
- Recovery path: retain the submitted facts, request only the named needed fact, or return Pending Review when reviewed authority does not exist.

## Incident Learning

- Failure fingerprint: Incomplete intake payload could be collapsed before the shared evaluator, making a review-gated result look determinate.
- Root cause: intake data and evaluator facts are currently narrower than the form state.
- Detection gap: no single cross-surface contract asserts the complete normalized request and recovery state.
- Prevention: extend only the shared request/schema and assert exact pass-through from both adapters.
- Guardrail evidence: shared schema/action/API/browser tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | High-risk scope and acceptance contract captured before implementation. |
| Focused contract tests | Public action and shared estimator schema suites | Pass | 2 suites / 9 tests; incomplete object-width/angle input is rejected before evaluation or persistence. |
| Targeted lint | Public intake client/form/action and action test | Pass | No errors. |

## Remaining Risk

- Deterministic head count remains outside reviewed authority. Owner: #90/#91; next action: do not emit a numeric head count until the reviewed rule-card dependency is complete.
- The currently reviewed Batch 1 rules do not authorize using public ASRS metadata (for example storage height or K-factor) in a deterministic outcome. Owner: #89; next action: retain those as persisted context, not evaluator authority, until exact-one matching is implemented.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
