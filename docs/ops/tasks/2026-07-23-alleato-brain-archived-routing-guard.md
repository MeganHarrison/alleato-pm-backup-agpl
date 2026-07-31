# Task: Alleato Brain Routing Foundation

Status: Ready to Publish
Owner: Codex (session SBRAINROUTE)
Created: 2026-07-23
Task ID: ALL-11
Linear Issue:
[ALL-11](https://linear.app/alleato-group/issue/ALL-11/alleato-brain-phase-3-rewire-routing-permissions-and-ai-retrieval)
Related Handoff: `docs/ops/handoffs/2026-07-23-SBRAINROUTE-archived-routing-guard.md`

## Objective

Prevent every automatic project-assignment strategy from selecting an archived
project, and establish one typed project-or-Business-Area target for migrating
ingestion callers without changing existing project-only callers.

## Scope

- Canonical project/rule loading in
  `backend/src/services/ingestion/project_assignment.py`.
- Focused regression coverage in `backend/tests/test_project_assignment.py`.
- Business Area target conversion through the permanent
  `business_area_project_map`.
- Shared Microsoft Graph typed-target inference adapter.
- Excludes caller persistence migration, rule cloning, and branch-aware
  retrieval.

## Source of Truth

- Canonical runtime/data owner:
  `backend/src/services/ingestion/project_assignment.py`.
- Existing shared primitives/services: `ProjectAssigner._get_projects()` and
  `ProjectAssigner._get_attribution_rules()`.
- Deprecated or parallel paths: downstream Outlook, Teams, Fireflies, OneDrive,
  and backfill callers must continue delegating to `ProjectAssigner`.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Archived projects are excluded before title, contact, domain, content, or
      attribution-rule scoring.
- [x] Rules targeting an archived project cannot assign that project, even if
      the rule remains active in the database.
- [x] Existing assignments are not silently rewritten by this inference guard.
- [x] Active-project routing behavior remains covered and passing.
- [x] Runtime evidence proves the production failure before the fix and the
      isolated service behavior after the fix.
- [x] Mapped container projects resolve to a Business Area target with no
      simultaneous `project_id`.
- [x] Real projects remain project targets and unavailable mappings fail
      loudly instead of producing an unsafe typed assignment.
- [x] The Graph adapter preserves typed targets, clears low-confidence
      destinations, and fails closed when typed resolution raises.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database contract localized: production project 1015 is archived while
      two active attribution rules still target it.

## Integration and Verification

- [x] Targeted project-assignment tests pass.
- [x] The live archived-project fixture no longer produces an assignment when
      passed through the corrected service boundary.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and the publication receipt identifies
      `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a regression test fails with the archived project ID and
  assignment method returned by `ProjectAssigner`, or typed assignment raises
  a specific mapping/invariant error.
- Detection path:
  `pytest -q backend/tests/test_project_assignment.py`.
- Recovery path: inspect the canonical project/rule loaders; do not add
  downstream caller-specific exclusions.

## Incident Learning

- Failure fingerprint: `ingestion.archived-project-routing`
- Root cause: the canonical project and attribution-rule loaders did not fetch
  or enforce project archival state.
- Detection gap: no routing contract asserted that archived projects and their
  still-active rules were ineligible.
- Prevention: filter both canonical loaders, revalidate preloaded caches, and
  retain focused regression fixtures covering project-name, rule, and contact
  matches.
- Guardrail evidence:
  `backend/tests/test_project_assignment.py`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Live project/rule readback + real `ProjectAssigner` call | Fail reproduced | Archived project 1015 selected via title rule at 0.985 confidence. |
| Corrected service | Live project/rule fixture + corrected `ProjectAssigner` | Pass | Result is unassigned; two stale rules logged. |
| Focused regression | `pytest -q backend/tests/test_project_assignment.py` | Pass | 22 passed, including warmed-cache and existing-scope preservation cases. |
| Ingestion regression | Assignment, Graph adapter, communication backfill, and Outlook intake tests | Pass | 49 passed; only unrelated existing deprecation warnings. |
| Verification contract | Manifest, changed-boundary artifacts, and independent review | Pass | Initial findings were corrected; independent re-review approved with 49 tests passing. |
| Syntax | `python3 -m py_compile` on changed Python files | Pass | No syntax errors. |
| Documentation | Markdown lint, learning-registry audit, and `git diff --check` | Pass | Both coordinated workspaces pass. |

## Remaining Risk

- Outlook, Fireflies, OneDrive, and communication backfills still call the
  compatibility project-only API and must be migrated to `assign_scope()`.
- Branch-target rule cloning and AI retrieval scope remain unimplemented.
- Caller persistence migration is intentionally outside this publish boundary.
- Independent review is required before this High-risk slice is closed.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
