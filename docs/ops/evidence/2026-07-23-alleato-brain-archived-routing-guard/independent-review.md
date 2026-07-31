# Independent review — Alleato Brain routing foundation

Reviewer: `/root/brain_routing_review` (independent reviewer agent)
Reviewed: 2026-07-24T02:34:55Z
Decision: APPROVED

## Review history

The first review returned `NEEDS_REWORK` with two findings:

1. A project archived after the long-lived assigner warmed its project cache
   could remain routable.
2. The typed API remapped an existing historical container-project assignment
   into a Business Area target.

The builder corrected both issues and added focused regressions. The reviewer
then reran the complete review and approved the corrected boundary with no
remaining findings.

## Independently verified outcomes

- DB-loaded project snapshots refresh once per assignment. The reviewer’s
  warmed-cache reproduction returned project 1015 before archival and no
  project after the underlying project was archived.
- Existing mapped project 60 remains
  `AssignmentTarget(project_id=60, business_area_id=None, method="existing")`.
- Archived project, attribution-rule, contact-signal, and preloaded-cache paths
  fail closed.
- The typed target enforces project-or-Business-Area exclusivity.
- The Graph adapter preserves typed targets, applies its confidence threshold,
  and fails closed on mapping errors.

## Independent command

```bash
pytest -q backend/tests/test_project_assignment.py \
  backend/tests/test_project_inference.py \
  backend/tests/test_communication_project_backfill.py \
  backend/tests/test_outlook_intake.py
```

Result: 49 passed, 22 existing unrelated deprecation warnings.

## Residual risk

Caller persistence migration is intentionally outside this publish boundary.
Unmigrated callers remain on the compatibility project-only API until their
Business Area writes receive focused verification.
