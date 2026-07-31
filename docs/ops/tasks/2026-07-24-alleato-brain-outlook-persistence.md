# Task: Alleato Brain Outlook Persistence

Status: In Progress
Owner: Codex (session SBRAINOUTLOOK)
Created: 2026-07-24
Task ID: ALL-11
Linear Issue:
[ALL-11](https://linear.app/alleato-group/issue/ALL-11/alleato-brain-phase-3-rewire-routing-permissions-and-ai-retrieval)
Related Handoff:
`docs/ops/handoffs/2026-07-24-SBRAINOUTLOOK-alleato-brain-outlook-persistence.md`

## Objective

Persist the shared typed assignment target for new Outlook ingestion so a
mapped internal email is stored under exactly one Business Area and every new
RAG chunk carries the same branch authorization label.

## Scope

- Canonical Outlook Graph ingestion in
  `backend/src/services/integrations/microsoft_graph/outlook.py`.
- Shared application document catalog contract in
  `backend/src/services/supabase_helpers.py`.
- Canonical chunk metadata writer in
  `backend/src/services/pipeline/embedder.py`.
- Focused Outlook and embedder regression coverage.
- Includes Outlook historical assignment repair, missing-document rebuild, and
  learned-rule replay guardrails because those paths can overwrite or drop the
  canonical scope.
- Excludes Fireflies/Teams/OneDrive caller migration, branch-target rule
  cloning, and retrieval authorization.

## Source of Truth

- Assignment owner:
  `backend/src/services/ingestion/project_assignment.py`.
- Outlook persistence owner:
  `backend/src/services/integrations/microsoft_graph/outlook.py`.
- RAG chunk metadata owner:
  `backend/src/services/pipeline/embedder.py`.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] New mapped Outlook content writes `business_area_id` and a null
      `project_id` to `document_metadata`.
- [x] Real-project Outlook content remains project-scoped.
- [x] Existing document scope is preserved during re-sync.
- [x] Assignment metadata and intake status identify branch assignment without
      inventing a project assignment.
- [x] Every newly embedded chunk copies `business_area_id` from the canonical
      document row.
- [x] The application catalog helper does not silently drop
      `business_area_id`.
- [x] Mapping or typed-assignment failures remain fail-closed.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Canonical assignment, persistence, and embedder owners were inspected.
- [x] No source-specific duplicate branch mapper will be introduced.
- [x] Focused regressions cover branch, project, existing-scope, and failure
      paths.

## Integration and Verification

- [x] Outlook intake tests pass.
- [x] Business Area embedder tests pass.
- [x] Adjacent project inference and pipeline tests pass.
- [x] Live readback proves the deployed mapping contract.
- [x] Independent review approves the changed boundary.
- [x] Verification contract passes.
- [ ] Exact task-owned paths are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: typed inference returns `assignment_error`, the target XOR
  invariant raises, or persistence/embedder tests expose a missing branch label.
- Detection path: focused Outlook and Business Area embedder regressions plus
  the ALL-11 verification contract.
- Recovery path: stop the affected write; do not fall back to a mapped legacy
  container project or emit an unscoped chunk.

## Incident Learning

- Failure fingerprint: N/A
- Context: new feature boundary.
- Root cause: N/A.
- Detection gap: N/A.
- Prevention: canonical typed target, exact-scope persistence, and chunk-label
  regression tests.
- Guardrail evidence: focused tests under `backend/tests/`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused regressions | `pytest -q backend/tests/test_outlook_intake.py backend/tests/test_business_area_embedder.py backend/tests/test_leadership_restriction.py backend/tests/test_project_assignment.py backend/tests/test_project_inference.py` | Pass | 59 passed; 28 pre-existing deprecation warnings. |
| Static Python | `python3 -m py_compile ...` | Pass | All three changed service modules compile. |
| Patch hygiene | `git diff --check` | Pass | No whitespace errors. |
| Live database | `docs/ops/evidence/2026-07-24-alleato-brain-outlook-persistence/database-readback.json` | Pass | The live additive branch columns and five mappings are populated; 2,115 documents are dual-scoped during parallel run. |
| Independent review | `docs/ops/evidence/2026-07-24-alleato-brain-outlook-persistence/independent-review.md` | Approved | Three findings were corrected; final re-review found no remaining issues. |
| Verification contract | `npm run verify:contract ...` and strict handoff check | Pass | PASS is supported by declared evidence; strict review-queue verification passes. |

## Remaining Risk

- Finance remains fail-closed because no authorized membership has been seeded.
- Other ingestion callers remain project-only until their own verified slices.
- Historical RAG chunks continue normal lifecycle churn; the Phase 5 monitor
  must compare branch and legacy labels dynamically rather than freeze the
  initial 12,651 count.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
