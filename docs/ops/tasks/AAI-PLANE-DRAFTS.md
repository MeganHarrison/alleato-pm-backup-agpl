# Task: Plane Drafts Workspace Template

Status: Complete
Owner: S20260731-PLANE-DRAFTS
Created: 2026-07-31
Task ID: AAI-PLANE-DRAFTS
Linear Issue: Existing Plane-to-Alleato program; no separate issue requested
Related Handoff: N/A

## Objective

Create the Plane-derived Drafts workspace template on top of Alleato's real,
authenticated, user-scoped persisted work-in-progress owner without adding a
parallel table, localStorage store, or route.

## Scope

- `frontend/src/features/plane-drafts/**`
- Plane Drafts header, search, list rows, empty/loading states, inline editor,
  copy, finalize, archive, and delete interactions.
- Existing `/api/ai-assistant/workspace` and
  `/api/ai-assistant/workspace/[artifactId]` contracts only.
- Defer shared route and sidebar wiring to the coordinator's integration slice.

## Source of Truth

- Database contract:
  `frontend/src/types/database.types.ts` table `workspace_artifacts`.
- API owner: `frontend/src/app/api/ai-assistant/workspace/**`.
- Service owner:
  `frontend/src/lib/ai/services/workspace-artifact-service.ts`.
- Plane source: `makeplane/plane`
  `39856932cd6b9bd17eab0920506d628190b47af2`; exact paths are recorded in the
  feature's `source-reference.md`.

Delivery lane: Standard

Verification contract: Optional

## Data Contract Gate

- `workspace_artifacts` persists `user_id`, optional `project_id`,
  `artifact_type`, title, JSON content, status, version, context, tags, and
  timestamps.
- The list API authenticates with `getApiRouteUser` and calls `listArtifacts`
  with the current user ID.
- The service applies `.eq("user_id", userId)` to reads and writes and supports
  `status="draft"` plus optional project scope.
- Existing POST, artifact PATCH, archive, and DELETE routes supply every
  mutation required by this template.

## Acceptance Criteria

- [x] Drafts load from the authenticated, user-scoped persisted owner.
- [x] Optional project scope uses the existing API query contract.
- [x] Users can create, edit, copy, finalize, archive, and explicitly confirm
      permanent deletion.
- [x] Search covers title, visible content, and artifact type.
- [x] Loading, empty, and specific error states are visible.
- [x] Plane attribution and exact source paths are preserved.
- [x] No page-level route, sidebar, schema, API, or global portal change is
      included.

## Implementation Checklist

- [x] Canonical data, API, and mutation owner inspected before UI code.
- [x] Files/modules to change are listed before edits.
- [x] Shared `apiFetch` owns browser request/error behavior.
- [x] No database, authentication, permission, provider, or deployment contract
      changes.
- [x] Failure-loudly behavior has focused coverage.

## Integration and Verification

- [x] Focused model and template contract checks pass.
- [x] Formatting and patch-integrity checks pass.
- [x] Evidence is recorded.
- [x] Task-owned files are committed locally.

## Failure-Loudly Contract

- Cause surfaced as: a visible destructive alert for load/mutation failures and
  an inline validation message when a title is missing.
- Detection path: focused adapter tests, source-contract test, strict lint, and
  coordinator-owned browser proof after route integration.
- Recovery path: retry the failed action; no optimistic removal occurs before
  the persisted API succeeds.

## Incident Learning

- Failure fingerprint: `plane-drafts-parallel-local-store`
- Root cause: a visual-only Drafts template could otherwise invent local state
  despite Alleato already owning persisted, user-scoped work-in-progress
  artifacts.
- Detection gap: visual parity alone cannot prove persistence, ownership, or
  user isolation.
- Prevention: the feature's URL/model tests lock the existing API contract and
  the task evidence records the schema/API boundary inspected before UI work.
- Guardrail evidence: model adapter coverage plus rendered persisted-owner
  update and load-failure coverage.

## Evidence

| Check               | Command / artifact                                                                                                        | Result | Notes                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Data contract       | `database.types.ts`, workspace API routes, workspace artifact service                                                     | Pass   | Real user-scoped persisted owner and mutations confirmed before implementation.  |
| Plane source        | Local filtered clone at commit `39856932cd6b9bd17eab0920506d628190b47af2`                                                 | Pass   | Header, root, row, loader, and empty-state templates inspected directly.         |
| Model adapter       | `npx jest --runInBand --runTestsByPath src/features/plane-drafts/plane-drafts-model.unit.test.ts`                         | Pass   | 5/5 URL, content preservation, nested preview, search, and timestamp tests pass. |
| Rendered owner flow | `npx vitest run --config src/features/plane-intake/vitest.config.ts src/features/plane-drafts/plane-drafts-page.test.tsx` | Pass   | 2/2 project-scoped load/update and failure-loudly tests pass.                    |
| Formatting          | `npx prettier --write src/features/plane-drafts ../docs/ops/tasks/AAI-PLANE-DRAFTS.md`                                    | Pass   | Task-owned files formatted.                                                      |
| Patch integrity     | `git diff --check`                                                                                                        | Pass   | No whitespace errors.                                                            |
| Commit guards       | Repository commit hook                                                                                                    | Pass   | Strict lint, no-new-debt, route, and non-production route-budget checks pass.    |

## Noise Gate

- Primary user: an authenticated Alleato user returning to unfinished work.
- Primary job: find, resume, copy, finalize, archive, or delete a persisted
  draft.
- Tier 1 content: title, preview, project identifier, type, updated time, and
  row actions.
- Hidden until requested: the editor and permanent-delete confirmation.
- Removed: dashboard summaries, stat cards, decorative wrappers, duplicate
  calls to action, and invented properties unavailable from the canonical
  owner.
- Primary action: Draft work.
- Failure loudly: persisted API errors remain visible and records stay in place
  until the server mutation succeeds.

## Remaining Risk

- The template has no route by design. Authenticated desktop/mobile browser
  proof and sidebar activation belong to the shared integration checkpoint.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is recorded.
- [x] Publication and route wiring are explicitly deferred.
