# Task: Build FMDS 8-34 2026 Visual Review Queue

Status: Complete
Owner: Megan Harrison
Created: 2026-07-20
Task ID: AAI-1195
Linear Issue: [AAI-1195](https://linear.app/megankharrison/issue/AAI-1195/build-fmds-8-34-2026-visual-review-queue)
Parent: [AAI-1184](https://linear.app/megankharrison/issue/AAI-1184/stage-and-vectorize-fmds-8-34-april-2026-corpus)

## Objective

Create an auditable, complete review queue for all 58 table occurrences and the initially extracted 61 figure candidates in the staged FMDS 8-34 April 2026 corpus. Automated/OCR findings must remain candidate evidence; only an explicit reviewer event may change a source object to `reviewed`. Source review later proved one figure candidate was a table-cell false positive, leaving 60 real figures.

## Scope

- Owned database surface: review priority/reason fields, automated candidate records, append-only reviewer decisions, review queue view, and controlled approval function in the dedicated ASRS Supabase project.
- Owned implementation: isolated ASRS migration plus `scripts/asrs/` queue population and verification commands.
- Priority policy: Appendix B material-change families are Tier 1; remaining objects are Tier 2 because the revision includes editorial renumbering of figures and tables.
- Explicit exclusion: AI/chat route changes, 2026 activation, approval of engineering calculations, deletion or mutation of 2024 data, and silently promoting model/OCR candidates to reviewed facts.

## Acceptance Criteria

- [x] Every staged 2026 table and figure appears exactly once in the review queue.
- [x] Appendix B change families carry explicit Tier 1 reasons; all other items carry the revision-renumbering Tier 2 reason.
- [x] Every queue item retains its page/caption and rendered evidence path.
- [x] Automated/OCR candidates are stored separately and cannot approve a source object.
- [x] Approval is append-only, reviewer-attributed, and requires evidence notes.
- [x] Direct `needs_review` to `reviewed` updates fail without an approval event.
- [x] Active retrieval still excludes the staging revision and activation still fails.
- [x] The legacy 2024 corpus remains unchanged.

## Implementation Checklist

- [x] Create the isolated ASRS review migration with the Supabase CLI.
- [x] Apply it to the dedicated project and verify the remote migration ledger.
- [x] Add deterministic priority classification and idempotent queue population.
- [x] Add queue coverage and approval-guard verification.
- [x] Post kickoff, milestone, evidence, blockers, and next action to AAI-1195.

## Integration and Verification

- [x] Python/static checks pass.
- [x] Live readback proves 58 table items plus 61 figure items with no duplicates or omissions.
- [x] Representative Tier 1 items cover Table 2.1.4.5.4, transverse-flue/vertical-barrier families, top-loading families, and vertically enclosed families.
- [x] A transaction-scoped negative test proves unapproved direct promotion fails.
- [x] A transaction-scoped approval test proves an attributed event and source status change occur together, then rolls back.
- [x] A canonical screenshot is attached to AAI-1195.
- [x] Task-owned files and evidence are published to `origin/main` with exact remote readback.

## Failure-Loudly Contract

- Cause surfaced as: exact source type/ID/revision, missing evidence, missing reviewer, invalid transition, or coverage mismatch.
- Detection path: verifier compares source object counts and IDs with the review view, priority coverage, evidence paths, event history, revision status, and legacy counts.
- Recovery path: repopulate priorities idempotently; never bypass the approval function or activate with incomplete reviews.

## AI/OCR Boundary

The repository's required AI SDK skill is unavailable in this session. This slice therefore builds the durable review and audit contract and may reuse existing extraction evidence, but does not introduce a new vision-provider implementation. Any future visual-model candidate generator must write only to the candidate table and must not change `review_status`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1195 | Pass | Separate ownership and approval boundary recorded before database changes. |
| Migration ledger | `supabase --workdir infrastructure/asrs-supabase migration list --db-url "$SUPABASE_ASRS_DATABASE_URL"` | Pass | Local and remote include `20260720123946`. |
| Queue population | `scripts/asrs/populate_fmds_visual_review_queue.py` | Pass | 119 unique items, 119 candidates, 119 evidence paths, 111 Tier 1, and eight Tier 2. |
| Live verifier | `scripts/asrs/verify_fmds_visual_review_queue.py` | Pass | 58 tables, 61 figures, no duplicates, staging only, active retrieval zero, legacy chunks 43. |
| Direct promotion guard | Transaction-scoped SQL negative test | Pass | Direct status promotion rejected without an attributed approval event. |
| Controlled approval | Transaction-scoped `record_fmds_visual_review` test | Pass | Approval event and status transition occurred together and were rolled back. |
| Append-only history | Transaction-scoped event update test | Pass | Event mutation rejected and transaction rolled back. |
| Security advisors | `supabase db advisors --type security --level warn` | Pass with unrelated debt | No AAI-1195 findings; warnings are legacy migrated functions/policies and the pre-existing public vector extension. |
| Linear evidence | AAI-1195 comment `fece621b-6968-4698-8a67-849086d8a079` | Pass | Scope, commands, remaining work, and viewable screenshot attached. |

## Remaining Risk

- The queue is complete and every real table/figure now has an attributed review outcome; AAI-1234, AAI-1235, and AAI-1242 contain the source-review and correction evidence.
- Reviewed source extraction does not by itself authorize unsupported engineering calculations. The deterministic evaluator must continue returning Pending Review outside reviewed rule coverage.
- Corpus activation remains a separate revision-lifecycle decision.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Remaining engineering and activation boundaries are explicit.
