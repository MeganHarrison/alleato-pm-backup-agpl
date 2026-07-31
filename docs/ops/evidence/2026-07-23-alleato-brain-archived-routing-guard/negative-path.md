# Routing negative-path evidence

Date: 2026-07-24
Task: ALL-11

The focused regression suite proves these fail-closed paths:

- An archived project with an active attribution rule remains unassigned.
- Preloaded attribution-rule and contact-signal caches are revalidated and
  cannot restore an archived target.
- A project archived after the long-lived assigner warms its project cache is
  excluded on the next assignment.
- `AssignmentTarget` rejects simultaneous `project_id` and
  `business_area_id`.
- An existing mapped project assignment remains project-scoped instead of
  being silently rewritten as a Business Area assignment.
- A Business Area mapping query failure returns `assignment_error` through the
  shared Graph adapter rather than falling back to the legacy container
  project.
- A destination below the configured Graph confidence threshold is cleared.

Command:

```bash
pytest -q backend/tests/test_project_assignment.py \
  backend/tests/test_project_inference.py \
  backend/tests/test_communication_project_backfill.py \
  backend/tests/test_outlook_intake.py
```

Result: 49 passed. The 22 warnings are existing FastAPI lifecycle and naive-UTC
deprecations outside this task's changed files.
