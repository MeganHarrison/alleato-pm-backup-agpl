# Task: Plane Intake action contracts

Status: Complete
Owner: Codex S20260731-PLANE-INTAKE-ACTIONS
Created: 2026-07-31
Task ID: AAI-PLANE-INTAKE-ACTIONS
Linear Issue: Tracked by the Plane-to-Alleato implementation program
Related Handoff: Parent task handoff

## Objective

Provide Plane-derived accept, decline, snooze, unsnooze, and duplicate-resolution
contracts that can be integrated into the replacement Intake page without
changing its existing page composition in this slice.

## Scope

- `frontend/src/features/plane-intake-actions/**`
- `frontend/src/app/api/plane-intake-actions/**`
- Focused tests and this task record
- Plane source attribution for this independently deliverable slice
- Excludes the existing Intake client, existing Outlook route, migrations,
  shared shell, and production

## Source of Truth

- Canonical runtime/data owner: `tasks` in the Alleato app Supabase project and
  `outlook_email_intake` through `createOutlookIntakeServiceClient`
- Existing shared primitives/services: `Button`, `Dialog`, `DropdownMenu`,
  `Calendar`, `requirePermission`, `serviceDb`
- Plane templates: `apps/web/core/components/inbox/content/inbox-issue-header.tsx`,
  `apps/web/core/components/inbox/modals/{decline-issue-modal,snooze-issue-modal,select-duplicate}.tsx`,
  and `apps/web/core/store/inbox/inbox-issue.store.ts` at revision
  `39856932cd6b9bd17eab0920506d628190b47af2`
- Deprecated or parallel paths: existing Ignore/Restore Outlook-only action is
  retained until the integration slice

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Task and Outlook sources support accept, decline, snooze, unsnooze, and
      duplicate resolution through a single static route.
- [x] Outlook acceptance creates one real task and is idempotent on retry.
- [x] Cross-database partial failure is compensated or fails with explicit
      recovery details.
- [x] Project permissions and Outlook admin access are enforced.
- [x] The Plane-derived interaction controller is independently reusable by the
      existing Intake client after its active ownership lease is published.
- [x] Failure-loudly behavior is defined.
- [x] Legacy or duplicate paths are explicitly deferred to integration.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled.

## Integration and Verification

- [x] Targeted contract and API route tests pass.
- [x] Independent review passes.
- [x] Route guardrail passes.
- [x] Integration into the running page is explicitly deferred because another
      published workspace owns `plane-intake-client.tsx`.
- [x] Task-owned files are committed locally for parent integration.

## Failure-Loudly Contract

- Cause surfaced as: a typed guardrail response naming the action, source, and
  failed persistence boundary.
- Detection path: focused route tests cover permission denial, validation,
  idempotent acceptance, compensation, and source-project mismatch.
- Recovery path: retry a compensated action; investigate the named task or
  Outlook persistence boundary if compensation itself fails.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: The endpoint uses a deterministic Outlook source key and explicit
  compensation instead of two untracked client mutations.
- Guardrail evidence: Focused route tests.

## Evidence

| Check              | Command / artifact                                                                                                                                                                | Result | Notes                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| Focused tests      | `npx jest --config jest.config.js --runInBand --runTestsByPath src/features/plane-intake-actions/contracts.unit.test.ts src/app/api/plane-intake-actions/__tests__/route.test.ts` | Pass   | 2 suites, 19 tests                                         |
| Targeted lint      | `npx eslint` on all task-owned TypeScript files                                                                                                                                   | Pass   | No warnings or errors                                      |
| Changed quality    | `npm run quality:changed`                                                                                                                                                         | Pass   | No new any debt, unsafe patterns, or route guardrail gaps  |
| Route safety       | `npm run check:routes`                                                                                                                                                            | Pass   | No dynamic route conflicts                                 |
| Diff integrity     | `git diff --check`                                                                                                                                                                | Pass   | No whitespace errors                                       |
| Independent review | `intake_actions_final_review`                                                                                                                                                     | Pass   | No blocking correctness, security, or concurrency findings |

## Remaining Risk

- The existing Intake page does not consume these independent components until
  its active ownership lease is published and the follow-up integration slice runs.
- JSON metadata updates are read-modify-write. This route is the sole intended
  writer for the `plane_intake` nested key.
- The claim-owner guard uses a PostgREST JSON-path filter. Its live Supabase
  behavior must be exercised during the parent integration checkpoint before
  production release.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred integration has a named owner and next action.
