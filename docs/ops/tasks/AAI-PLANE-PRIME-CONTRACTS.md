# Task: Plane-derived Prime Contracts replacement

Status: In Progress
Owner: S20260731-PLANE-PRIME-CONTRACTS
Created: 2026-07-31
Task ID: AAI-PLANE-PRIME-CONTRACTS
Linear Issue: Not requested; local parallel implementation slice
Related Handoff: N/A

## Objective

Provide a new Plane-derived project Prime Contracts work surface that uses the
existing authenticated, Supabase-backed Prime Contract contracts without
changing the legacy Prime Contracts routes.

## Scope

- New Plane-derived Prime Contracts list, server-backed search/status filter,
  responsive record peek, canonical create/detail links, number/title editing,
  and delete behavior.
- Reuse `use-prime-contracts.ts`, existing project Contracts APIs, existing
  create/detail pages, and `PermissionGate` as the only data, mutation, form,
  and permission owners.
- Excludes shared Plane dispatcher/access/sidebar wiring, legacy Prime Contracts
  routes, API handlers, schema, migrations, production publishing, and
  destructive production testing.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/hooks/use-prime-contracts.ts`
- Existing shared primitives/services:
  `frontend/src/app/api/projects/[projectId]/contracts/**`,
  `frontend/src/app/(main)/[projectId]/prime-contracts/{new,[contractId]}/**`,
  `frontend/src/components/domain/permissions/PermissionGate.tsx`
- Plane template source:
  `apps/web/core/components/issues/issue-layouts/list/{default,list-group,block}.tsx`
  and `apps/web/core/components/issues/peek-overview/header.tsx` at Plane
  revision `39856932cd6b9bd17eab0920506d628190b47af2`
- Deprecated or parallel path:
  `frontend/src/app/(main)/[projectId]/prime-contracts/page.tsx` remains intact
  until replacement verification and deliberate cutover.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] List/search/status filter use the canonical guarded query hook.
- [x] Create and full-detail actions route to existing owner pages.
- [x] Number/title edits and delete use canonical mutation hooks.
- [x] Write actions use the existing `contracts:write` permission gate.
- [x] Loading, empty, load-error/retry, and mutation-error states are explicit.
- [ ] Shared Plane dispatcher and navigation expose Prime Contracts.
- [ ] Authenticated desktop and mobile browser evidence is captured.
- [ ] Production is published and verified by the integration owner.
- [x] Legacy route retirement is explicitly deferred until replacement proof.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared hooks, API routes, permission gate, and existing form pages retain
      their canonical ownership.
- [x] Errors are specific and actionable.
- [x] Existing RLS/authentication enforcement is preserved at the API boundary.
- [x] Plane copyright, SPDX headers, revision mapping, and `/auth/source`
      corresponding-source path are retained.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [ ] Authenticated direct-route browser readback proves the requested outcome.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are locally committed.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: inline load failure with server-provided message and Retry;
  inline mutation failure naming the attempted operation.
- Detection path: focused unit test plus authenticated browser inspection of
  the integrated Plane Prime Contracts route.
- Recovery path: retry the list request or repeat the failed mutation after the
  API/RLS condition is corrected.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check          | Command / artifact                                                                                                           | Result  | Notes                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| Task setup     | This task file                                                                                                               | Pass    | Scope and done gate captured before implementation.    |
| Model behavior | `npx jest --runInBand --runTestsByPath src/features/plane-prime-contracts/plane-prime-contracts-model.unit.test.ts`          | Pass    | 1 suite, 2 tests.                                      |
| Focused lint   | `npx eslint src/features/plane-prime-contracts --quiet`                                                                      | Pass    | Zero errors in task-owned TS/TSX.                      |
| Formatting     | `npx prettier --check src/features/plane-prime-contracts ../docs/ops/tasks/AAI-PLANE-PRIME-CONTRACTS.md`; `git diff --check` | Pass    | Task-owned source and task record.                     |
| Browser proof  | Pending integration                                                                                                          | Pending | Shared route and nav wiring are deliberately deferred. |

## Remaining Risk

- Shared dispatcher/access/sidebar wiring is outside this isolated slice.
  Integration owner must add the surface segment and navigation entry before
  local or production verification.
- Canonical mutation hooks inherit their existing toast behavior. This surface
  also renders a specific inline failure, but sanitizing shared toast content
  remains owned by the canonical hook.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred routing, browser proof, publication, and legacy-route retirement
      identify their owner and next action.
