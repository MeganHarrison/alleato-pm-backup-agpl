# Task: Scope Outlook Intake Reads To One Project

Status: Ready for Integration
Owner: Codex S20260731-PLANE-INTAKE-API
Created: 2026-07-31
Task ID: AAI-PLANE-INTAKE-API
Linear Issue: Not requested; coordinated in the active Plane migration task.
Related Handoff: N/A

## Objective

Allow the authenticated admin Outlook Intake API to fetch one project's rows
without loading the global mailbox corpus, while preserving the existing
organization-wide response when no project filter is supplied.

## Scope

- `frontend/src/app/api/outlook-intake/route.ts`
- `frontend/src/app/api/outlook-intake/__tests__/route.test.ts`
- No client changes, permission changes, data mutations, or deployment.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/outlook-intake/route.ts`
- Existing shared primitives/services: `withApiGuardrails`,
  `assertAdminAccess`, `createOutlookIntakeServiceClient`
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] An authorized admin can pass `project_id=<positive integer>` and the
      Outlook query is scoped at the database boundary.
- [x] Omitting `project_id` preserves the existing global admin query.
- [x] Missing authentication still fails before the Intake service is queried.
- [x] Invalid, non-positive, or unsafe project IDs return a specific 400
      validation envelope and never reach the Intake query.
- [x] No data, permissions, or production state are changed.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Authentication and permission contracts remain unchanged.

## Integration and Verification

- [x] Targeted route tests pass.
- [x] Focused tests prove valid filter, invalid filter, omitted filter, and
      authentication behavior.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Local commit is recorded; publishing is explicitly excluded.

## Failure-Loudly Contract

- Cause surfaced as: `VALIDATION_ERROR` with
  `project_id must be a positive integer.`
- Detection path: focused Jest route test and HTTP 400 response envelope.
- Recovery path: omit `project_id` for the global list or supply an existing
  positive integer project ID.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The admin endpoint had no project filter, so the project Intake
  surface fetched the global Outlook corpus and filtered it only in the client.
- Detection gap: Existing route tests covered mailbox filters but not
  project-scoped reads or invalid project IDs.
- Prevention: A validated database-boundary filter plus focused auth and
  validation tests.
- Guardrail evidence: Learning-registry lookup found no matching project-scope
  performance fingerprint.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Authenticated production network trace | Pass | Tasks resolved with 235 rows while unfiltered Outlook stayed pending and returned 1,000 rows; only 21 belonged to project 31. |
| Task setup | This task file | Pass | Scope and High-risk verification gate captured before implementation. |
| Focused route tests | `npm --prefix frontend run test:unit -- --runInBand --runTestsByPath src/app/api/outlook-intake/__tests__/route.test.ts` | Pass | 14 tests passed, including scoped, omitted, invalid, unauthenticated, and non-admin denial cases. |
| Diff integrity | `git diff --check` | Pass | No whitespace errors. |
| Independent review | Coordinator-assigned High-risk review | Pass after follow-up | Review found the implementation correct and requested one missing denial regression. The added test proves a non-admin receives 403 before either service client is constructed. |
| Commit hook | `git commit -m "Scope Outlook intake reads by project"` | Deferred to integration | The broad project-map gate requires shared generated outputs for any API edit. Coordinator authorized a local `--no-verify` commit because this slice only adds a query parameter; integration owns `npm run map:project`, both generated map outputs, and the full gate after all API commits are combined. |

## Remaining Risk

- The Plane Intake client must opt into `project_id`; it is owned by a separate
  active workspace and is deliberately excluded here.
- The local commit intentionally skips hooks. At integration, regenerate and
  stage `docs/architecture/PROJECT-MAP.md` and
  `frontend/src/lib/app-surface/app-surface.generated.json`, then run the full
  commit gate once across the combined API changes.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
