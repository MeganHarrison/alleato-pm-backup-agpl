# Task: Review Remaining FMDS0834 Figures

Status: Complete
Owner: Codex S212
Created: 2026-07-21
Task ID: AAI-1235
Linear Issue: [AAI-1235](https://linear.app/megankharrison/issue/AAI-1235/review-remaining-fmds0834-figures-and-embed-approved-structures)
Related Handoff: `docs/ops/handoffs/2026-07-21-S212-fmds0834-figure-review.md`

## Objective

Review every real FMDS0834 April 2026 figure against its exact source image,
remove the proven table-cell false positive, publish only source-faithful
structured figure facts and vectors, and prove the frontend and RAG preserve
the exact revision, figure, page, and review provenance.

## Scope

- Owned runtime state: FMDS0834 figure rows, candidates, attributed review
  events, and structured embeddings for revision
  `65306e47-c25a-4397-92a0-c44c03903d0f` in the dedicated ASRS project.
- Owned implementation: revision-locked review replay, exact figure serializer,
  caption-token ingestion guard, expected-count correction, focused tests, and
  AAI-1235 evidence.
- Explicit exclusions: FMDS0809, previously reviewed table decisions, repair of
  43 changes-requested tables, rule-card activation, corpus activation, and
  professional-engineer approval of a real sprinkler design.

## Source of Truth

- Canonical runtime/data owner: dedicated ASRS Supabase project
  `vqnnvpnoitqhijkztyhq`, FMDS0834 revision `2026-04`, source PDF SHA-256
  `c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed`.
- Existing shared primitives/services: `record_fmds_visual_review`,
  `insert_fmds_structured_chunks`, `store_fmds_structured_chunk_embeddings`,
  `scripts/asrs/embed_reviewed_fmds_structures.py`, the FMDS figure evidence
  endpoint, and the canonical `/fm-global` figures tab.
- Deprecated or parallel paths: FMDS0809 and legacy FM Global rows are not valid
  sources for this review; raw vector similarity is not the deterministic
  configuration-calculation authority.

Verification contract: Required

## Acceptance Criteria

- [x] All 60 real figures have source-image-approved structured proposals in a
  revision/SHA/crop-fingerprinted ledger.
- [x] Boundary symbols, measurements, labels, connectors, decisions, and source
  inconsistencies were preserved rather than normalized silently.
- [x] Exactly 60 real figure rows remain; all are reviewed and each has one
  active source-matched candidate and a latest attributed approval event.
- [x] The page-43 table-cell false positive is removed only after proving it has
  zero review-event and structured-chunk dependencies.
- [x] All reviewed figures have structured embeddings and exact-source
  retrieval; native 225/225 chunks and staging isolation remain unchanged.
- [x] Canonical frontend proof shows the resulting review state and exact source
  evidence/citation behavior.
- [x] Failure-loudly behavior is defined and no ambiguous source is activated.

## Implementation Checklist

- [x] Files/modules to change are listed before repository edits.
- [x] Reuse the canonical review and embedding functions instead of introducing
  a second persistence path.
- [x] Add the idempotent transactional figure-review runner and durable ledger.
- [x] Add the exact-source caption-token guard and correct expected figure count
  from 61 to 60 with focused regression coverage.
- [x] Extend the shared structured-figure serializer with reviewed summary,
  facts, measurements, decisions, relationships, entities, labels, references,
  interpretation limits, and deterministic section-family metadata.
- [x] Errors are specific and actionable, and every live mutation is read back.

Owned files: `scripts/asrs/review_fmds0834_figures.py`,
`scripts/asrs/ingest_fmds0834.py`, `scripts/asrs/fmds_corpus_config.py`,
`scripts/asrs/embed_reviewed_fmds_structures.py`, focused tests under
`scripts/asrs/tests/`, `docs/ops/tasks/2026-07-21-fmds0834-figure-review.md`,
`docs/ops/handoffs/2026-07-21-S212-fmds0834-figure-review.md`, and
`docs/ops/evidence/2026-07-21-fmds0834-figure-review/**`.

## Integration and Verification

- [x] Two-model vision review plus remediation/adjudication covers 60/60 real
  figures and the ledger fingerprints all source crops.
- [x] Offline structured serialization creates 155 unique chunks and all six
  representative semantic-retrieval cases find the expected family in top 5.
- [x] Live read-only preflight proves 61 current rows, 60 real sources, one
  isolated false positive, seven historical approvals, and native 225/225.
- [x] Focused unit/static checks pass after repository integration.
- [x] Transactional apply and idempotent replay pass.
- [x] Structured embedding coverage and live semantic retrieval pass.
- [x] Authenticated frontend evidence is captured and attached to AAI-1235.
- [x] Verification manifest and independent review pass.
- [x] Task-owned files and evidence are published to `origin/main` with exact remote readback.

## Failure-Loudly Contract

- Cause surfaced as: wrong revision/SHA/status, changed source identity, a review
  event newer than the ledger, candidate fingerprint mismatch, false-positive
  dependencies, non-unique active candidate, native-vector drift, embedding
  dimension/provider failure, or missing exact-source retrieval provenance.
- Detection path: offline ledger validator, live preflight, one-transaction apply,
  database review guards, postflight coverage queries, semantic evaluation, and
  authenticated canonical-route proof.
- Recovery path: roll back all database writes, preserve the source as pending,
  regenerate only the mismatched candidate against the exact crop, then rerun
  the idempotent workflow.

## Incident Learning

- Failure fingerprint: `rag.native-coverage-hides-structured-gaps`
- Root cause: a permissive `Figure|Fig.` caption matcher interpreted one table
  cell beginning with the word `Figure` as a figure, while native 225/225 vector
  coverage obscured the difference between source text and reviewed structures.
- Detection gap: the expected figure count was derived from permissive extraction
  rather than source-image review, and reviewed-figure structure coverage was
  not separately required.
- Prevention: exact source hash, revision-specific accepted caption token
  (`Fig.`), corrected count 60, immutable candidate/event provenance,
  exactly-one-active-candidate postflight, structured coverage, and exact-source
  retrieval checks.
- Guardrail evidence: review runner, ingestion regression test, ledger validator,
  post-apply verification, and semantic evaluation artifacts.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1235 and this task file | Pass | Scope and done gate captured before repository or database writes. |
| Source identity | Source PDF and live ASRS revision readback | Pass | Exact revision and SHA; status remains staging. |
| Vision review | `fmds0834-figure-review-ledger.json` | Pass | 60/60 approved, zero title corrections, portable entry hash `be34d8ffb19d21d7b95f9a8bf2eb8ebc9671df56482cb2d85da3c9a501ada6f9`. |
| Boundary review | Figure proposals for 2.2.1.4.2.1 and 2.2.1.5.1 | Pass | Preserves `≥1.5`, `<1.5`, `≤0.5`, and `>10 ft` exactly. |
| False-positive localization | Live read-only dependency query | Pass | Page-43 table cell has one candidate, zero events, and zero structured chunks. |
| Pre-apply validation | `preapply-live-validation.json` | Pass | 61 live rows, 60 real, native 225/225, zero AAI-1235 approvals before apply. |
| Offline embedding eval | quarantined `fmds0834-figure-embedding-cache.json` | Pass | 155 chunks, 3072 dimensions, 6/6 retrieval cases; cache intentionally excluded from Git. |
| Transactional review apply | `figure-review-apply.json` | Pass | 60 approvals applied, false row/candidate deleted, 60 exact latest approvals, native 225/225 unchanged. |
| Review idempotence | `figure-review-idempotence.json` | Pass | 60 already applied, 0 new approvals on replay. |
| Embedding dry run | `embedding-dry-run.json` | Pass | 75 reviewed sources, 177 chunks: 22 table plus 155 figure chunks. |
| Embedding apply | `embedding-apply.json` | Pass | Structured coverage 15/15 reviewed tables and 60/60 figures. |
| Embedding idempotence | `embedding-idempotence.json` | Pass | 0 inserted, 0 embedded; coverage remained complete. |
| Focused checks | Jest and ESLint | Pass | Jest 7/7; targeted ESLint passed for the balanced retrieval owner and regression test. |
| Live RAG | `live-figure-retrieval.json` | Pass | 6/6 figure families; balanced 12-source context includes the former rank-13 vertical-barrier figure at rank 11; active retrieval returns 0 staging rows. |
| Frontend | `fmds0834-reviewed-figures-frontend.png` and Linear attachment `6c18fdc9-9f43-47fe-95a7-1752d9c4b89f` | Pass | Canonical `/fm-global` Figures tab shows FMDS0834 2026-04 staging, 60 rows, and reviewed state. |
| Independent review | focused citation/retrieval verdict | Pass | Exact figure source IDs resolve through the scoped evidence endpoint and fail loudly on 404/500. |
| Remote publication | retrieval `2004610ff8234e4cc7a544da371aa1f1a064dd11`; evidence `4c42ea8762e01df4aa831c40ebe3dfa038df1394` | Pass | Retrieval guardrail and binary-safe evidence bundle published to `origin/main` and read back. |

## Remaining Risk

- Vercel AI Gateway returned HTTP 402 requiring a positive Gateway balance,
  including BYOK. The request path and credential were accepted; direct OpenAI
  fallback completed all vectors. Gateway billing/team alignment remains an
  operational follow-up, not a corpus-coverage blocker.
- The shared checkout still contains unrelated concurrent-session changes, but
  task publication was verified directly against `origin/main`; no task-owned
  file or evidence remains unpublished.
- The former 43 changes-requested tables were corrected, approved, embedded,
  and independently verified under AAI-1242. Corpus activation remains a
  separate revision-lifecycle decision.

## Final Status

- [x] All task-owned implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred table repair and activation work have explicit owners/scope.
- [x] Task-owned publication and `origin/main` remote readback are complete.
