# Task: Embed Reviewed FMDS Structures for RAG

Status: Complete
Owner: Codex S209
Created: 2026-07-20
Task ID: AAI-1231
Linear Issue: [AAI-1231](https://linear.app/megankharrison/issue/AAI-1231/embed-approved-fmds-table-and-figure-structures-for-rag)
Related Handoff: `docs/ops/handoffs/2026-07-20-S209-fmds-structured-rag-embeddings.md`

## Objective

Make every human-reviewed FMDS0834 April 2026 table and figure structure semantically retrievable with exact revision, source, candidate, and approval provenance while preserving the 225 native PDF embeddings.

## Scope

- Dedicated ASRS Supabase schema, embedding writer/backfill, revision coverage, and FMDS chat retrieval.
- Embed only content backed by an attributed approved visual-review event.
- Excluded: automatically approving pending candidates, activating the staging revision, editing FMDS0809, figure extraction, and deterministic rule-card promotion.

## Source of Truth

- Canonical runtime/data owner: dedicated ASRS Supabase project `vqnnvpnoitqhijkztyhq`.
- Existing shared primitives/services: `fmds_chunks`, `store_fmds_chunk_embeddings`, `match_staging_fmds_chunks`, `frontend/src/lib/fmds/fmds-chat.server.ts`, and `scripts/asrs/ingest_fmds0834.py`.
- Deprecated or parallel paths: legacy `fm_text_chunks` and `fm_table_vectors` are excluded.

Verification contract: Required

## Acceptance Criteria

- [x] Approved table/figure content is stored in a source-linked structured chunk table and embedded at 3072 dimensions.
- [x] Unapproved sources cannot be written to the structured embedding table.
- [x] Native and structured chunks are searched through the same revision-scoped retrieval contract.
- [x] Retrieval returns exact `source_type` and `source_id` so chat does not infer identity only from page proximity.
- [x] Coverage fails when a reviewed source lacks an embedded structured chunk.
- [x] Existing 225 native vectors remain present and unchanged.
- [x] Current eligible reviewed records are backfilled and retrieved by a live semantic query.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Add an ASRS migration for structured chunks, write guards, coverage, and combined retrieval.
- [x] Add an idempotent approved-source serializer and embedding backfill.
- [x] Update FMDS chat parsing and exact table/figure association.
- [x] Add focused tests for review gating, serialization, and source-aware retrieval.
- [x] Errors are specific and actionable.

Owned files: `infrastructure/asrs-supabase/supabase/migrations/*fmds_structured*`, `scripts/asrs/embed_reviewed_fmds_structures.py`, `scripts/asrs/verify_fmds0834.py`, `frontend/src/lib/fmds/fmds-chat*`, focused FMDS tests, and task/handoff/evidence/orchestration rows.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] ASRS migration is applied and remote-ledger verified.
- [x] Live readback proves approved-source embedding and combined vector retrieval.
- [x] Database coverage reports reviewed versus embedded counts for tables and figures.
- [x] Evidence artifacts are recorded and attached to AAI-1231.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: source is unreviewed, approval provenance is missing, candidate content is empty, revision is not staging, embedding dimensions differ from 3072, or reviewed/embedded coverage drifts.
- Detection path: guarded database functions, idempotent run report, coverage view, live retrieval verifier, and focused tests.
- Recovery path: keep the source pending or mark the structured chunk failed with its exact error; repair review/content/provider state and rerun without changing native chunks.

## Incident Learning

- Failure fingerprint: `rag.native-coverage-hides-structured-gaps`
- Root cause: vector coverage counted only `fmds_chunks`; visual-review candidates were stored separately and chat associated tables/figures by page rather than exact structured-source matches.
- Detection gap: no reviewed-source embedding coverage or exact source identity existed in the retrieval response.
- Prevention: add source-level coverage, guarded approved-only writes, and source-aware retrieval tests.
- Guardrail evidence: approved-only database guards, `fmds_structured_embedding_coverage`, idempotent backfill, focused serializer/retrieval tests, and live `verification.json` readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live baseline | Revision-scoped ASRS SQL | Pass | 225/225 native chunks embedded; 58 tables, 61 figures; only `fmds_chunks` has embedding columns. |
| Approved-only backfill | `backfill.json` and `idempotence.json` | Pass | 2/2 reviewed tables and 7/7 reviewed figures embedded; zero missing; rerun inserted/embedded zero. |
| Live semantic retrieval | `verification.json` | Pass | Exact table and two exact figure queries returned the expected source type, identifier, and citation; active retrieval excluded staging. |
| Database guard | unreviewed-source insert transaction | Pass | Trigger rejected an unreviewed FMDS source. |
| Migration ledger | `npx supabase migration list --db-url ... --workdir infrastructure/asrs-supabase` | Pass | `20260720233500` and `20260720235000` both show matching Local and Remote versions. |
| Python checks | unit tests plus `py_compile` | Pass | 5/5 serializer/review/provider tests passed; changed Python modules compile. |
| Frontend checks | focused Jest, ESLint, `typecheck:changed` | Pass | 133/133 focused tests passed; lint and changed-file type debt check passed. |
| Exact figure citation | focused route test and live HTTP readback | Pass | 2/2 route tests passed; reviewed Figure 2.2.1.4.1.1 redirected to its FMDS0834 page-017 evidence instead of the generic dashboard. |
| Live Alleato AI | `frontend-proof.md`, desktop/mobile screenshots | Pass | Typed FMDS plan returned 250 gpm for 60 minutes and cited Table 2.1.4.5.4, PDF page 12; persisted trace contains one exact reviewed structured match. |
| Linear evidence | AAI-1231 attachments and milestone comment `2902f781-6601-4a14-ae72-23434e0a12eb` | Pass | Desktop and mobile screenshots are viewable from the task. |
| Independent review | `independent-review.md` and verification contract | Pass | Initial figure citation P2 was repaired; re-review found no P0-P2 issues and `verify:contract --require-pass` passed. |
| Broader chat architecture verifier | `npm run rag:verify:chat-architecture` | Unrelated debt | Existing registry-derived tool approval/shared-secret/client-resume and legacy `needsApproval` findings are outside this task's FMDS-owned path. |

## Remaining Risk

- Only human-reviewed sources are eligible; pending review records will remain intentionally unembedded until approved.
- Figure extraction/review remains owned by a separate workstream.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.

Published implementation commit: `cdc26e2dd9` on `origin/main`.

Deferred review scope remains visible rather than silently promoted: 56 tables
and 54 figures stay Pending Review, the revision stays staging, database guards
prevent them from becoming authoritative, the FMDS review workflow owns the
next action, and the idempotent backfill is rerun after approvals.
