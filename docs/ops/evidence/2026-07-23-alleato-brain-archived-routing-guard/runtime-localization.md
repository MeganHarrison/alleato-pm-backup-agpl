# Archived-project routing runtime localization

Date: 2026-07-23
Linear issue: ALL-11

## Observed database state

Production Supabase readback found:

- project ID `1015`
- name `Varsity Brands`
- `archived = true`
- two active `title_keyword` attribution rules: `Varsity Brands` and `Varsity`

## Observed service state

The live project/rule rows were passed without modification into the real
`ProjectAssigner` implementation with the title
`Varsity Brands project update`.

Observed result:

```json
{
  "project_id": 1015,
  "method": "attribution_rule:title_keyword",
  "confidence": 0.985
}
```

## Localized boundary

Expected at the database-to-routing boundary: archived project `1015` and
rules targeting it are ineligible.

Observed at that boundary: the canonical loader projection omitted archival
state, and the assignment service selected the archived project.

Everything downstream of `ProjectAssigner` is excluded from the root cause:
Outlook, Teams, Fireflies, OneDrive, and communication backfills all consume
the already-invalid assignment result.

## Corrected boundary

The same live project/rule fixture was passed through the corrected
`ProjectAssigner`, alongside active project `31` so the full rule and fallback
pipeline executed.

Observed result:

```json
{
  "project_id": null,
  "method": "unassigned",
  "confidence": 0.0
}
```

The service also emitted:

```text
[ProjectAssigner] ignored 2 active attribution rule(s) targeting archived or unavailable projects
```

Preloaded rule and contact-signal caches were also exercised directly. The
corrected service revalidates both caches against the canonical active-project
set, drops archived or malformed targets, and emits a specific warning instead
of trusting stale process state. DB-loaded project snapshots refresh once per
assignment, so archiving a project after a long-lived process warms its cache
makes that project ineligible on the next assignment.

## Typed Business Area target

`ProjectAssigner.assign_scope()` now keeps the compatibility project-only API
intact while returning exactly one typed destination for migrated callers:

- a mapped container project becomes `business_area_id` plus an audit-only
  `legacy_project_id`;
- a real project remains `project_id`;
- unassigned content carries neither target;
- a dual target is rejected by the `AssignmentTarget` invariant;
- a mapping read failure raises a specific error and refuses the assignment.
- an existing historical project assignment remains a project assignment and
  is not silently remapped by the typed API.

Live readback verified the typed mapping contract used by the resolver:

| Legacy project | Business Area ID | Branch | Restricted |
| ---: | ---: | --- | --- |
| 60 | 3 | Finance | Yes |
| 89 | 5 | Marketing | No |
| 90 | 4 | Internal Operations | No |
| 756 | 1 | Leads | No |
| 767 | 2 | AI | No |

All five legacy container projects remain active during the comparison period;
`assign_scope()` converts their inferred destination before a migrated caller
writes a new record.

## Targeted regression checks

- `pytest -q backend/tests/test_project_assignment.py`:
  `22 passed`.
- `pytest -q backend/tests/test_project_assignment.py backend/tests/test_communication_project_backfill.py backend/tests/test_outlook_intake.py`:
  superseded by the Graph-adapter-inclusive command below.
- `pytest -q backend/tests/test_project_assignment.py backend/tests/test_project_inference.py backend/tests/test_communication_project_backfill.py backend/tests/test_outlook_intake.py`:
  `49 passed`.
- `python3 -m py_compile backend/src/services/ingestion/project_assignment.py backend/tests/test_project_assignment.py`:
  passed.
- `git diff --check -- <task-owned files>`:
  passed.

The test run reports existing FastAPI lifecycle and naive-UTC deprecation
warnings; no test failed and neither warning is owned by this slice.
