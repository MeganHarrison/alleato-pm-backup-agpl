# Negative-path evidence

- `AssignmentTarget` enforces project-or-Business-Area exclusivity.
- Assigned Business Area source metadata without a positive
  `business_area_id` raises a specific `ValueError`; it is not treated as
  unassigned.
- Historical repair fails and reports the row when both project and Business
  Area scope are present.
- Typed inference mapping failures return no target and do not fall back to a
  mapped legacy container project.
- Learned `not_project` rule replay skips both project-scoped and
  Business-Area-scoped records, preventing silent scope erasure.
- Existing document scope wins over conversation consensus during re-sync.

Durable coverage is in:

- `backend/tests/test_outlook_intake.py`
- `backend/tests/test_business_area_embedder.py`
- `backend/tests/test_project_assignment.py`
- `backend/tests/test_project_inference.py`
