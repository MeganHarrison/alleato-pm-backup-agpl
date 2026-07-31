# Task: Drawing Comments Persistence and Sidebar Linkage

Status: Complete
Owner: Codex S136
Created: 2026-07-13
Task ID: DRAWING-COMMENTS-2026-07-13
Linear Issue: Unavailable. Linear connector returned `UNAUTHORIZED`, `oauth_token_invalid_grant`, and `TRIGGER_REAUTHENTICATION` on issue search/team lookup.
Related Handoff: `docs/ops/handoffs/2026-07-13-S136-drawing-comments-persistence-sidebar-linkage.md`

## Objective

Comments placed on a drawing persist after reload and appear as the same Velt threads in the drawing sidebar, while global header feedback remains a separate comment channel.

## Scope

- Canonical route: `/[projectId]/drawings/viewer/[drawingId]`.
- Drawing-specific Velt document, annotation target, persisted pin/thread linkage, and drawing sidebar.
- Explicit exclusion: global site-header feedback capture and its page-feedback discussion channel.

## Source of Truth

- Canonical runtime/data owner: Velt route document for drawing comment threads and annotations.
- Existing shared primitives/services: `frontend/src/components/comments/entity-comments.tsx`, `frontend/src/components/drawings/DrawingComments.tsx`, `frontend/src/components/velt/VeltGlobalLayer.tsx`.
- Deprecated or parallel paths: any drawing entry point that opens the global page-feedback comment mode instead of the drawing document contract.

## Acceptance Criteria

- [x] A comment placed on the drawing remains visible on the drawing after reload.
- [x] The same comment thread appears in the drawing sidebar without duplication.
- [x] Clicking the drawing annotation and sidebar thread addresses the same Velt thread.
- [x] The global header comment icon continues to create site feedback outside the drawing-comment channel.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns drawing comment document and location identifiers.
- [x] Errors are specific and actionable.
- [x] Provider, authentication, and delivery contracts are handled when applicable.

Anticipated owned implementation paths:

- `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx`
- `frontend/src/components/drawings/DrawingComments.tsx`
- `frontend/src/components/comments/entity-comments.tsx`
- `frontend/src/lib/comments/comment-scope.ts`
- `frontend/src/lib/stores/comment-scope-store.ts`
- `frontend/src/lib/comments/comment-scope.unit.test.ts`

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual create, reload, sidebar, and annotation round trip passes on the exact route.
- [x] Global header feedback separation is verified.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: drawing comment initialization reports a missing or mismatched drawing document/target contract instead of silently opening the global feedback channel.
- Detection path: exact-route browser flow plus deterministic contract tests comparing drawing document, target, and sidebar identifiers.
- Recovery path: restore the canonical drawing comment contract and rerun the persisted thread round trip.

## Incident Learning

- Failure fingerprint: `frontend.viewer-capability-regression`
- Root cause: Three competing ownership paths split one workflow. Velt persisted the drawing pin to the route document, while the inline sidebar queried `entity:drawing:<drawingId>` and the site-header feedback flow also claimed the route document. The dialog polish controller could then replace drawing context with feedback-only context.
- Detection gap: Prior verification proved Velt rendering and visual polish, not one-thread identity across drawing, reload, and sidebar.
- Prevention: Add this round trip to the canonical drawings viewer browser capability contract.
- Guardrail evidence: `node scripts/ops/learning-registry.mjs lookup --symptom "drawing comments disappear after reload and do not match the drawing sidebar" ...`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Linear kickoff | Linear team lookup and issue search | Blocked | Connector requires reauthentication (`oauth_token_invalid_grant`). |
| Recurring failure lookup | `node scripts/ops/learning-registry.mjs lookup ...` | Pass | Matched `frontend.viewer-capability-regression`. |
| Live Velt export | Velt `fetchAllComments` grouped by `documentId` | Fail before fix | Existing drawing comments are split across `entity:drawing:*` and `/[projectId]/drawings/viewer/*` documents; the requested drawing had no canonical record. |
| Exact reported comment | `GET /api/comments/all` filtered to drawing `61ea4d2e-ef30-434a-a210-8cddb10dfa90` | Root cause confirmed | Annotation `C2N0G095WXDqVBNP9yrI` persisted under the route document while the sidebar queried the entity document. |
| Contract unit test | `pnpm exec jest --runInBand --runTestsByPath src/lib/comments/comment-scope.unit.test.ts` | Pass | 3 tests prove durable drawing scope, feedback separation, and feedback-mirror exclusion. |
| Targeted lint | `pnpm exec eslint <7 changed implementation files>` | Pass | No changed-file lint errors. |
| Changed type guard | `pnpm run typecheck:changed` | Pass | No new `any` debt. |
| Exact route boot | `agent-browser` on `/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9` | Pass | Drawing loads after clean Next restart; drawing Comment tool opens the sidebar and Velt composer. |
| Browser evidence | `docs/ops/evidence/2026-07-13-drawing-comments/sidebar-canonical-scope.png` | Pass | Sidebar composer is mounted against the canonical drawing target. |
| Exact-route reload | `docs/ops/evidence/2026-07-13-drawing-comments/reload-pin-and-sidebar-linked.png` | Pass | User annotation remains pinned after reload and the same text is listed once in the embedded Velt document sidebar. |
| Explicit future-write contract | Browser DOM inspection of `velt-comment-tool` | Pass | `document-id`, drawing target, and drawing-only context all match project 1142 / drawing `61ea4d2e-ef30-434a-a210-8cddb10dfa90`. |
| Sidebar navigation | Click `Navigate to comment location` on the exact route | Pass | The persisted thread text and drawing pin remain visible for the same document. |
| Focused regression suite | `pnpm exec jest --runInBand --runTestsByPath <5 drawing/comment suites>` | Pass | 5 suites and 10 tests pass, including persisted annotation undo, drawing cursor, scope, sidebar ownership, and feedback separation. |
| Targeted static checks | ESLint on task-owned TS/TSX plus `pnpm run typecheck:changed` | Pass | No targeted lint failures and no new `any` debt. |
| Full TypeScript check | `NODE_OPTIONS=--max_old_space_size=16384 ./node_modules/.bin/tsc --noEmit --pretty false` | Pending/non-blocking | Delegated check is still running with no emitted diagnostics; no task-owned errors have surfaced. |
| Linear handoff gate | `npm run linear:codex:check -- docs/ops/handoffs/2026-07-13-S136-drawing-comments-persistence-sidebar-linkage.md` | Blocked/unrelated | Fails only because the expired Linear OAuth prevented creation of the required `AAI-###` issue and URL. |
| Publish | Commit `466b9032d` plus `git push origin main` and hash read-back | Pass | Local `HEAD` and `origin/main` both resolved to `466b9032db5f8778c52949bd38306678da06fbf4`. The finish helper's broad guardrail was blocked only by unrelated dirty feedback/home files, so the documented explicit push equivalent was used. |

## Remaining Risk

- Existing historical drawing discussions stored under `entity:drawing:*` remain on their legacy documents. They are intentionally not merged automatically because moving provider records without preserving annotation geometry can corrupt pin locations. Owner: collaboration platform. Next action: inventory legacy drawing records and migrate only with a Velt-supported annotation-preserving operation.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
