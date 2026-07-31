# Task: Purge Seven Non-Project Records

Status: Complete
Owner: Codex
Created: 2026-07-23
Task ID: LOCAL-2026-07-23-PURGE-NONPROJECTS
Linear Issue: Unavailable; no Linear connector is installed in this session.
Related Handoff: N/A — single-session operation.

## Objective

Permanently remove the seven user-identified non-project records and their
project-owned data from the production application and RAG databases without
touching similarly named projects.

## Scope

- Resolve targets by exact name plus job number and integration identity where
  available.
- Inventory project dependencies in the application database, RAG database,
  and Supabase Storage before deletion.
- Physically delete the exact project rows and project-owned dependent data.
- Preserve immutable audit tombstones and global operational logs with their
  project reference cleared where the schema intentionally uses `ON DELETE SET
  NULL`.
- Exclude legitimate projects, shared companies/people, and unrelated source
  documents.

## Source of Truth

- Canonical runtime/data owner: production PM Supabase `public.projects` and its
  live foreign-key graph; production RAG database; Supabase Storage.
- Existing shared primitives/services:
  `frontend/src/app/api/projects/[projectId]/route.ts` (archive-only behavior)
  and the project creation audit contract.
- Deprecated or parallel paths: the UI DELETE route only archives and is not a
  complete purge path.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] All seven targets resolve uniquely before apply mode can run.
- [x] Dry-run evidence records IDs, integration identifiers, dependent-row
      counts, storage objects, and RAG rows.
- [x] Apply mode requires an exact manifest-bound confirmation string.
- [x] The seven projects no longer exist in `public.projects`.
- [x] No project-owned app, RAG, or storage data remains for their IDs.
- [x] Immutable deletion/creation evidence remains available without exposing
      an active project.
- [x] Failure-loudly behavior is covered by focused tests.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts
      are handled.

Owned files:

- `scripts/ops/purge-projects.mjs`
- `scripts/ops/project-purge-targets-2026-07-23.json`
- `scripts/ops/__tests__/purge-projects.test.mjs`
- this task and its evidence directory

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] A production dry run proves exact target resolution and dependency scope.
- [x] A production apply run succeeds transactionally.
- [x] Post-delete application, RAG, and storage readbacks prove the outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a specific target mismatch, duplicate exact match, missing
  dependency credential, remaining scoped row, or database constraint error.
- Detection path: dry-run/apply JSON artifact and post-delete verifier.
- Recovery path: no deletion occurs unless all targets resolve and confirmation
  matches; a failed transaction rolls back and reports the exact blocking
  relation.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Non-project records entered production through historical
  integrations and test/automation paths, while the user-facing delete action
  only archived projects.
- Detection gap: There was no exact-target, cross-store project purge tool or
  production residue verifier.
- Prevention: Manifest-bound confirmation, live dependency inventory,
  transaction-bound deletion, and cross-store readback.
- Guardrail evidence: eight focused tests, a wrong-confirmation failure check,
  a full rollback simulation, the committed apply report, and an independent
  post-commit deleted-state verifier.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Destructive scope and done gate captured before implementation. |
| User target evidence | Conversation screenshots | Pass | Seven names/job numbers explicitly selected by the user. |
| Focused tests | `node --test scripts/ops/__tests__/purge-projects.test.mjs` | Pass | 8/8; exact identifiers, duplicate/missing targets, confirmation binding, and mandatory manifest-bound receipt replay. |
| Confirmation guard | Apply with `--confirm=WRONG` | Pass | Failed before opening deletion transactions. |
| Production dry run | `docs/ops/evidence/2026-07-23-purge-nonproject-records/dry-run.json` | Pass | Resolved all seven; rollback simulation removed seven projects; 1,414 app references, 332 RAG documents, 2,556 document-reference matches, zero exact storage objects. |
| Production apply | `docs/ops/evidence/2026-07-23-purge-nonproject-records/apply.json` | Pass | Deleted seven projects, 26 indirect financial children, 964 directly counted app rows plus cascades, and 2,983 RAG rows; cleared 39 cost-ledger project IDs. |
| Independent readback | `docs/ops/evidence/2026-07-23-purge-nonproject-records/verify.json` | Pass | Zero active project rows, non-audit app references, RAG project references, or project-folder storage objects. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ... --root . --require-pass` | Pass | Declared evidence supports every high-risk acceptance claim. |
| Independent review | `docs/ops/evidence/2026-07-23-purge-nonproject-records/independent-review.md` | Approved | No remaining blocker; exact-document receipt replay is mandatory and regression tested. |
| Anonymous API probe | `GET /api/projects?search=...` | Expected auth boundary | Returned 401 without a user session; database readback is the verified production boundary. |

## Remaining Risk

- Historical `projects_audit` and `ai_tool_write_audits` tombstones intentionally
  retain the deleted numeric IDs. They cannot surface as active projects.
- The two databases cannot participate in one distributed transaction. The RAG
  transaction was deliberately committed first so an app-commit failure would
  remain safely rerunnable while the project records still existed. Both commits
  and the post-commit readback passed.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
