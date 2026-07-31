# Task: Purge Two Additional Non-Project Records

Status: Complete
Owner: Codex
Created: 2026-07-23
Task ID: LOCAL-2026-07-23-PURGE-NONPROJECTS-BATCH-3
Linear Issue: Unavailable; no Linear connector is installed in this session.
Related Handoff: N/A — single-session operation.

## Objective

Permanently remove Superior Beverae Exotec and Paradise Isle Geotech, including
their meetings, files, PM data, and AI/RAG knowledge, without affecting any
other project or shared master record.

## Scope

- Bind both targets to exact internal, job, and Acumatica identifiers.
- Normalize harmless trailing database whitespace while failing on duplicate
  normalized names.
- Inventory, rehearse, and delete project-owned application, RAG, and storage
  data.
- Preserve shared company/person masters and immutable audit tombstones.

## Source of Truth

- Canonical runtime/data owner: production PM Supabase, production RAG
  database, and Supabase Storage.
- Existing shared primitive: `scripts/ops/purge-projects.mjs`.
- Deprecated or parallel paths: the UI delete route archives only.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Both targets resolve uniquely with all identity fields.
- [x] Full deletion succeeds in a rollback rehearsal.
- [x] All exact project-folder storage files are reviewed and deleted.
- [x] Both projects and all owned meetings/data are absent.
- [x] Receipt-bound verification finds zero active residue.
- [x] Shared master records and audit evidence remain.
- [x] Independent review approves the evidence.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, and destructive-operation contracts are handled.

Owned files:

- `scripts/ops/purge-projects.mjs`
- `scripts/ops/__tests__/purge-projects.test.mjs`
- `scripts/ops/project-purge-targets-2026-07-23-batch-3.json`
- this task file and its evidence directory

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Production rollback rehearsal passes.
- [x] Production storage/app/RAG apply succeeds.
- [x] Final production verifier passes.
- [x] Evidence and independent review are recorded.
- [x] Task-owned files are published through `codex:finish`.

## Failure-Loudly Contract

- Cause surfaced as: missing/duplicate normalized name, identity mismatch,
  incorrect confirmation, storage residue, database constraint, or remaining
  project/document reference.
- Detection path: dry-run, storage, apply, and verify receipts.
- Recovery path: no database commit before a successful rehearsal and exact
  manifest-bound confirmation.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Two no-longer-required projects remained active; one had trailing
  whitespace in its stored name.
- Detection gap: Exact-name resolution previously queried before normalizing
  harmless database whitespace.
- Prevention: Trimmed-name database resolution plus duplicate detection,
  identity binding, rollback rehearsal, and receipt replay.
- Guardrail evidence: Nine focused tests, wrong-confirmation rejection,
  rollback rehearsal, manifest-bound receipts, and exact-document replay.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and destructive done gate captured before apply. |
| Target lookup | Production read-only query | Pass | Two unique matches: IDs 178 and 58. |
| Focused tests | `node --test scripts/ops/__tests__/purge-projects.test.mjs` | Pass | 9/9, including trailing-name whitespace. |
| Rehearsal | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-3/dry-run.json` | Pass | Complete deletion rolled back. |
| Storage | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-3/storage-delete.json` | Pass | Deleted 122 reviewed files; zero readback. |
| Apply | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-3/apply.json` | Pass | Deleted both projects, meetings, PM data, and RAG data. |
| Verify | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-3/verify.json` | Pass | Zero active residue across all checked stores. |
| Independent review | `docs/ops/evidence/2026-07-23-purge-nonproject-records-batch-3/independent-review.md` | Approved | No blocking findings. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ... --root . --require-pass` | Pass | All high-risk claims are evidence-backed. |

## Remaining Risk

- PM and RAG commits cannot share one distributed transaction; the guarded
  sequence remains safely rerunnable if the second commit fails.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred work is documented.
