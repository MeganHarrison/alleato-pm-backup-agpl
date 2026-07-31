# Task: Execute Remaining Scheduling Production Matrix

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: SCHED-PRODUCTION-MATRIX-2026-07-30
Linear Issue: Not requested; the functional matrix IDs are the acceptance source.
Related Handoff: N/A; single-session production verification.

## Objective

Execute every scheduling function still marked `NOT RUN` through the
authenticated production application or its production API boundary, record
specific evidence for each row, and leave no disposable test data behind.

## Scope

- Verify matrix rows A07-A09, A14-A15, A18-A19; B03-B04, B09-B10, B13;
  C01-C03, C05-C08; D04-D10; E09; F03-F07, F09-F12; and G03, G05.
- Use uniquely named, provenance-guarded disposable projects and synthetic
  people/resources only.
- Capture screenshots, downloads, response/readback evidence, and cleanup
  counts under the task-owned evidence directory.
- Update the scheduling functional audit matrix with `PASS`, `FAIL`, or
  `BLOCKED` for every executed row.
- Repair production defects localized by the matrix under the user's earlier
  instruction to fix the issues and publish them to `main`.
- Exclusion: Do not mutate Nexcom, project 43, project 67, or any other
  pre-existing project schedule.
- Product repair is limited to failures reproduced by this matrix and their
  focused regression contracts.

## Source of Truth

- Canonical runtime/data owner:
  `frontend/src/app/(main)/[projectId]/schedule/page.tsx`, its scheduling
  components, and `/api/projects/[projectId]/scheduling/**`.
- Existing shared primitives/services:
  `frontend/tests/helpers/db.ts` and the disposable scheduling-project fixture.
- Deprecated or parallel paths: Fixed-project production test fixtures.

Delivery lane: High-risk

Verification contract: Focused production evidence

## Acceptance Criteria

- [x] Every one of the 38 remaining matrix rows has a current production result.
- [x] Every mutation is scoped to a verified disposable project or synthetic
  person/resource owned by this run.
- [x] Each result identifies the UI/API boundary exercised and its artifact.
- [x] Failures preserve the first observed boundary and actionable error.
- [x] Database cleanup readback reports zero residual task-owned projects,
  people, resources, revisions, and leveling records.
- [x] Existing customer and historical test projects are unchanged.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared disposable-project ownership guards are identified before testing.
- [x] Production errors will be recorded with the matrix ID and exact boundary.
- [x] Authentication, permissions, downloads, and destructive cleanup are
  explicitly included.

## Integration and Verification

- [x] Targeted Playwright discovery and compilation pass.
- [x] Authenticated production journeys execute against the exact production alias.
- [x] Database/API readbacks verify committed state and negative paths.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` is present on `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: A matrix-specific assertion naming the first UI, API, or
  database boundary where expected behavior differs from observed behavior.
- Detection path: Playwright result, screenshot/download, response body, and
  guarded service-role readback.
- Recovery path: Preserve the failed run artifact, clean owned data in
  `afterAll`, classify the row `FAIL` or `BLOCKED`, and record the smallest
  product repair needed.

## Incident Learning

- Failure fingerprint: `scheduling.timeline-window-and-e2e-fixture-ownership`
- Root cause: The task-create route omitted the assignee/mode fields; dependency
  constraint conflicts fell through the generic 500 handler; the linked
  submittal query did not name its successor foreign key; filter/loading states
  lacked complete accessible semantics.
- Detection gap: Earlier coverage stopped at visible success or mocked service
  boundaries and did not assert full database payloads, structured error
  classification, generated PostgREST relationships, or accessible state.
- Prevention: Focused route/shared-toolbar tests plus the 38-row production
  matrix now freeze the corrected contracts. Calendar-sensitive production
  fixtures derive Today, This Week, and Future from one runtime timestamp.
- Guardrail evidence: Repository finish gates, 17 route tests, 8 toolbar tests,
  the 35-test production run, and zero-residual readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | PASS | Scope and production safety gate captured before mutation. |
| Repository quality gates | `codex:finish --no-push` | PASS | Route, changed-file quality, structured-error, project-map, system-map, and lint-staged gates passed. |
| Focused route tests | Three scheduling route suites | PASS: 17 of 17 | Task creation, dependency guardrail, and submittal relationship contracts. |
| Shared toolbar tests | Three toolbar suites | PASS: 8 of 8 | Filter, view-switcher, and column behavior. |
| Production deployment baseline | `projects.alleatogroup.com` inspection | PASS | Ready deployment `dpl_5G21k8gq5Pef9Ygtx8Uo2g416E3x`, source d293e851dbff20e7bdfb4f20d9470e5d708c1940, containing CRM source ff173b702 and the scheduling recovery. |
| Remaining production matrix | `schedule-production-matrix.spec.ts` plus three safe resource/regression suites | PASS: 35 of 35 in 2.0 minutes | All 38 remaining matrix rows plus disposable fixture regressions. |
| Cleanup readback | Service-role scoped counts | PASS | Disposable projects and matrix, P4A, P4B, and viewer identities all `0`. |

## Remaining Risk

- No function in the scheduling audit remains `NOT RUN`, `FAIL`, or `BLOCKED`.
- The separate legacy Vercel project named `frontend` rejected the Git author;
  it is not the canonical runtime. `project-management-agent` built the exact
  audited commit and owns `projects.alleatogroup.com`.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
