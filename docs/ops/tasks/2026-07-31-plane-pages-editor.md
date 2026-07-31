# Task: Plane Pages editor template

Status: Complete
Owner: S20260731-PLANE-PAGES-EDITOR
Created: 2026-07-31
Task ID: AAI-PLANE-PAGES-EDITOR
Linear Issue: Parent Plane migration program
Related Handoff: Parent Plane migration task

## Objective

Provide an independently integrable Plane-derived page editor with block
editing, page title/content editing, version history, comments, and a typed
adapter boundary for the secure notes API.

## Scope

- `frontend/src/features/plane-pages-editor/**`
- This task file
- Excludes routes, existing Plane Pages, notes APIs, migrations, shared shell,
  and production deployment.

## Source of Truth

- Canonical visual source: Plane revision
  `39856932cd6b9bd17eab0920506d628190b47af2`
- Existing shared primitives/services: `@/components/ui/button`,
  `@/components/ui/textarea`
- Deprecated or parallel paths: existing
  `frontend/src/features/plane-pages/plane-page-editor.tsx` remains unchanged

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Page title and block content are editable with keyboard-first block entry.
- [x] Comments and version history use a progressively disclosed side panel.
- [x] Saving, commenting, resolving, and restoring use a typed adapter.
- [x] Adapter failures are specific, visible, and preserve local edits.
- [x] Plane copyright, license, source revision, and modified-source notice are
  present in the feature tree.
- [x] Focused unit tests pass.
- [x] Independent review passes.

## Implementation Checklist

- [x] Files/modules to change were listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Production authentication, permissions, and delivery are explicitly out
  of scope until the secure API adapter is integrated.

## Integration and Verification

- [x] Targeted static and interaction tests pass.
- [x] Component interaction tests prove edit, save, retry, comment, resolve,
  history restore, and keyboard save behavior.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated test-runner failure is recorded below.
- [x] Task-owned files are committed locally for parent integration.

## Failure-Loudly Contract

- Cause surfaced as: an alert containing the adapter error and recovery action.
- Detection path: focused interaction tests for failed save and comment paths.
- Recovery path: retry without discarding title or block edits.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: typed adapter contract plus failure-preservation tests.
- Guardrail evidence: eight focused Vitest tests plus the surface complexity
  audit.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Exact isolated ownership and exclusion list recorded. |
| Editor interactions | `npx vitest run src/features/plane-pages-editor/__tests__/plane-pages-editor.test.tsx --config src/features/plane-pages-editor/vitest.config.ts --pool threads --maxWorkers 1 --no-file-parallelism --reporter verbose --testTimeout 10000` | Pass, 8/8 | Covers editing, block creation/type, save, retry with preserved draft, comments, version restore, Ctrl+S, denied document load, non-blocking secondary-data failure, and accurate successful-save state when secondary refresh fails. |
| Adapter contract | `npx vitest run src/features/plane-pages-editor/__tests__/memory-adapter.test.ts --config src/features/plane-pages-editor/vitest.config.ts --environment node --pool threads --maxWorkers 1 --no-file-parallelism --reporter verbose` | Pass, 2/2 | Defensive copies, version creation, and specific missing-record error. |
| Feature lint | `npx eslint src/features/plane-pages-editor --no-cache` | Pass | Zero errors and zero warnings after shared-primitive cleanup. |
| Surface audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass, 3/3 | Block editor, panel, and editor pass. |
| Known runner debt | `npm run test:unit -- --runInBand --runTestsByPath ...` | Unrelated harness failure | Repo resolves Jest runtime 30.4.x with `jest-environment-jsdom` 30.2 and fails before UI test collection with `clearMocksOnScope is not a function`; per-feature Vitest proves the boundary. |
| Independent review | Read-only reviewer | Approved | Initial review found main-document/secondary-data coupling and a false save-error path. Both were removed, protected by two passing regression tests, and independently approved on re-review. |

## Remaining Risk

- The production secure notes API does not yet expose block, version, or comment
  persistence. Parent integration must supply that adapter and verify
  project-scoped permissions.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred production integration names the owner and next action.
