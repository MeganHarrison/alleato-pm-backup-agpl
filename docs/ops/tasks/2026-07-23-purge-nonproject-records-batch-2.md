# Task: Purge Eighteen Non-Project Records

Status: Complete
Owner: Codex
Created: 2026-07-23
Task ID: LOCAL-2026-07-23-PURGE-NONPROJECTS-BATCH-2
Linear Issue: Unavailable; no Linear connector is installed in this session.
Related Handoff: N/A — single-session operation.

## Objective

Permanently remove the eighteen user-identified non-project records and all
project-owned meetings, documents, financial data, and AI/RAG knowledge from
production without affecting similarly named projects or shared contacts.

## Scope

- Resolve every target by exact database name, internal ID, and job/Acumatica
  identity where present.
- Inventory and delete project-owned records in the application database, RAG
  database, and exact project storage folders.
- Include meetings, meeting items, transcripts, attachments, financial rows,
  directory memberships, documents, chunks, ingestion jobs, and derived AI
  knowledge associated with a target project.
- Preserve immutable audit tombstones and shared company/person master records.
- Exclude every project not listed in the manifest.

## Source of Truth

- Canonical runtime/data owner: production PM Supabase `public.projects`, its
  live foreign-key graph, the production RAG database, and Supabase Storage.
- Existing shared primitives/services:
  `scripts/ops/purge-projects.mjs`.
- Deprecated or parallel paths: the UI DELETE route archives and cannot prove
  a cross-store purge.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] All eighteen exact targets resolve uniquely before apply can begin.
- [x] The complete deletion sequence succeeds in a rollback rehearsal.
- [x] Apply requires the manifest-bound confirmation string.
- [x] All eighteen projects and all project-owned meetings/data are absent.
- [x] No non-audit app, RAG, document, or exact storage reference remains.
- [x] Shared contacts and historical audit evidence remain intact.
- [x] Failure-loudly behavior and independent review pass.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts
      are handled.

Owned files:

- `scripts/ops/project-purge-targets-2026-07-23-batch-2.json`
- this task file
- `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-2/`

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Production rollback rehearsal proves the full deletion path.
- [x] Production apply and post-commit readback prove the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Independent review approves the evidence.
- [x] Task-owned files are published to `origin/main` through the exact-file
      `codex:finish` publisher.

## Failure-Loudly Contract

- Cause surfaced as: exact target mismatch, missing/duplicate target,
  confirmation mismatch, dependency constraint, storage object, or remaining
  scoped reference.
- Detection path: dry-run/apply/verify JSON reports and the verification
  contract.
- Recovery path: no production commit occurs until the rollback rehearsal
  passes; failures identify the blocking relation and preserve rerunnability.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Historical test, temporary, or no-longer-required project records
  remained in the active production project catalog.
- Detection gap: Active-project cleanup required explicit business-owner
  review; archival alone did not remove meetings or AI knowledge.
- Prevention: Exact manifest binding, rollback rehearsal, cross-store residue
  checks, and mandatory apply-receipt replay.
- Guardrail evidence: Eight focused tests, wrong-confirmation rejection,
  rollback rehearsal, manifest-bound apply receipt, and exact-document replay.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Destructive scope and done gate captured before apply. |
| Target resolution | Production read-only query | Pass | Eighteen unique matches; three user labels normalized to their unique full database names. |
| Focused tests | `node --test scripts/ops/__tests__/purge-projects.test.mjs` | Pass | 8/8 safety tests passed. |
| Production rehearsal | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-2/dry-run.json` | Pass | Full database deletion rolled back; inventoried 191 meetings, 113 meeting series, 8,535 RAG documents, and 485 name-pattern storage candidates pending review. |
| Storage purge | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-2/storage-delete.json` | Pass | Manifest-bound receipt records 485 reviewed objects (412,936,884 bytes), five successful API batches, the candidate-set hash, and zero-object readback. |
| Production apply | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-2/apply.json` | Pass | Deleted eighteen projects, 18,174 directly counted app rows, 651 indirect financial children, and 40,882 RAG rows. |
| Independent readback | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-2/verify.json` | Pass | Zero active projects, non-audit app references, RAG references, exact document references, or storage objects. |
| Independent review | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-2/independent-review.md` | Approved | No blocking findings; reviewer reran the receipt-bound production verifier read-only. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ... --root . --require-pass` | Pass | Every high-risk claim is supported by declared evidence. |

## Remaining Risk

- The PM and RAG databases cannot share one distributed transaction. The purge
  commits RAG first so an app commit failure remains safely rerunnable while
  the target project rows still exist.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
