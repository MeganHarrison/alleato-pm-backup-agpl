# Task: Prepare FMDS 8-34 2026 Review Batch 1

Status: Blocked/Deferred
Owner: Megan Harrison
Created: 2026-07-20
Task ID: AAI-1198
Linear Issue: [AAI-1198](https://linear.app/megankharrison/issue/AAI-1198/prepare-fmds-8-34-2026-review-batch-1)
Parent: [AAI-1195](https://linear.app/megankharrison/issue/AAI-1195/build-fmds-8-34-2026-visual-review-queue)

## Objective

Produce a source-complete review packet for the first nine April 2026 material-change objects without approving them: Table 2.1.4.5.4, the seven transverse-flue objects in family 2.2.1.4, and Figure 2.2.1.5.1 for the new vertical-barrier condition.

Reviewer feedback on 2026-07-20 established that raw extraction diagnostics are not a usable approval surface. The packet must lead with a clean, source-bound proposed transcription or review-fact list and move malformed machine extraction to a technical appendix.

## Reviewer-Interface Correction

- [x] Replace malformed machine-grid output with a clean proposed transcription for both tables.
- [x] Show the logical source columns, merged categories, thresholds, values, and paired units explicitly.
- [x] Give each figure a concise list of source facts and callouts to verify.
- [x] Surface source-consistency questions where prose and drawing operators differ.
- [x] Add explicit `Approve as transcribed`, `Correct`, and `Reject` decision fields to every object.
- [x] Move native text, extraction diagnostics, and stored candidate JSON to a technical appendix.
- [x] Regenerate and visually verify the HTML, PDF, screenshot, manifest, and private-storage packet.
- [x] Replace the AAI-1198 attachments and post corrected reviewer instructions.

## Scope

- Owned source pages: PDF pages 12 and 17-21 of `/Users/meganharrison/Downloads/FMDS0834 - 2026.pdf`.
- Owned output: full-page evidence, source-localized crops, page-native text, table-grid diagnostics, existing candidate output, discrepancy flags, packet manifest, and reviewer checklist.
- Owned database writes: additional deterministic/native candidate records only, if generated.
- Explicit exclusion: review approval, `review_status` mutation, rule-card creation, activation, AI/chat changes, and treating extraction output as engineering fact.

## Acceptance Criteria

- [x] The packet contains exactly nine review objects and six unique source pages.
- [x] Every object includes identifier, source type, page, caption/title, full-page image, localized crop, native text, and current candidate evidence.
- [x] Both tables include explicit grid/row/column and merged-cell diagnostics.
- [x] Every object receives a deterministic discrepancy state: `no_structural_discrepancy_detected`, `manual_validation_required`, or `extraction_incomplete`.
- [x] Packet output clearly states that it is not an approval.
- [x] Packet generation did not mutate review status; subsequent user decisions are recorded separately through the controlled workflow.
- [x] The 2026 revision remains staging and active retrieval remains empty.

## Implementation Checklist

- [x] Create an idempotent batch-packet generator under `scripts/asrs/`.
- [x] Reuse the stored rendered evidence and source PDF; do not introduce a new vision-provider path.
- [x] Generate machine-readable manifest, reviewer checklist, HTML packet, and PDF packet.
- [x] Store any new deterministic extraction comparison as candidate-only evidence.
- [x] Add a verifier for nine-object coverage and source-status isolation.
- [x] Post kickoff, milestone, evidence, blockers, and next action to AAI-1198.

## Integration and Verification

- [x] Python/static checks pass.
- [x] Local visual inspection confirms the HTML/PDF packet is readable and crops correspond to the named source objects.
- [x] Pre-review ASRS readback confirmed nine packet objects, zero committed approvals, and unchanged review statuses.
- [x] A canonical packet screenshot and packet PDF are attached to AAI-1198.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing source item, page mismatch, crop outside page, absent evidence object, empty native text, table grid mismatch, or any review-status mutation.
- Detection path: packet verifier compares the live queue, PDF manifest, generated artifacts, candidate records, review events, revision status, and active retrieval state.
- Recovery path: regenerate only the affected object packet; never approve or activate from incomplete evidence.

## AI/OCR Boundary

The required AI SDK skill remains unavailable. This slice uses native PDF geometry, text, and existing PyMuPDF evidence only. It prepares evidence for a qualified reviewer and does not claim that deterministic extraction resolves the engineering meaning of a table or figure.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1198 | Pass | Nine-object batch and no-approval boundary recorded before implementation. |
| Generator static check | `python3 -m py_compile scripts/asrs/generate_fmds_review_batch_1.py scripts/asrs/verify_fmds_review_batch_1.py` | Pass | Generator and fail-closed verifier compile. |
| Packet generation | `python3 -u scripts/asrs/generate_fmds_review_batch_1.py ... --packet-pdf .../review-packet.pdf` | Pass | 9 objects, 6 pages, 2 tables, 7 figures; all require manual validation. |
| Browser artifact | `agent-browser` local HTML screenshot and PDF render | Pass | Source crop, clean proposal, verification checklist, and decision form appear together; a visual false-positive angle discrepancy was removed before publication. |
| Live safety baseline | `python3 -u scripts/asrs/verify_fmds_review_batch_1.py ...` | Pass | Before review: 9 queue items needed review; 0 review events; 0 active chunks; 43 legacy chunks. |
| Controlled review decision | Event `c0e9c627-4b55-478b-8d5d-2994fa3555cb` | Pass | Table 2.1.4.5.4 approved as transcribed by Megan Harrison; live queue readback is `reviewed` / `approved`. |
| Reviewer-interface contract | `verification.json` | Pass | Version 2026-07-20.3: 2 clean table transcriptions, 7 figure-fact reviews, 2 source-consistency questions, 2 recorded decisions, and 7 open decision forms. |
| Private evidence storage | `verification.json` | Pass | 16 storage objects checked: 9 crops, 6 full pages, and corrected reviewer PDF. |
| Linear evidence | AAI-1198 attachments `cff69443-6e14-45c4-87a2-77917abe00cf`, `3c2b2105-08f8-4bcd-859d-a0f5f87cf323` | Pass | Current progress screenshot and PDF linked; superseded packet attachments deleted. |
| Publication | `git status --short --branch`; `git ls-files -u`; `git diff --name-only --diff-filter=U` | Blocked/Deferred | No unresolved index conflicts; the shared checkout is on unrelated branch `codex/accounting-dashboard-dark-style`, is ahead 21/behind 1, and contains many other sessions' staged and unstaged changes. |

## Remaining Risk

- The clean table proposals still require qualified confirmation against the authoritative crop.
- Figure meaning and dimensional callouts require qualified engineering review.
- The shared checkout's unrelated branch and multi-session dirty state block safe publication from this task.
- Exactly 1.5 in. and the vertical-barrier 1.5 in./0.5 in. equality boundaries require explicit reviewer decisions.

## Review Progress

| Object | Decision | Reviewer | Scope |
| --- | --- | --- | --- |
| Table 2.1.4.5.4 | Approved | Megan Harrison | Clean source transcription only |
| Table 2.2.1.4.2.1 | Approved | Megan Harrison | Clean source transcription with the final Section 2.2.1.5 reference preserved verbatim |
| Figure 2.2.1.4.1.1 | Approved | Megan Harrison | Gross transverse flue-space width is the horizontal open distance between containers or trays |
| Remaining 6 figures | Pending | — | No decision recorded |

## Deferred Publication

- Cause: the shared checkout is on unrelated branch `codex/accounting-dashboard-dark-style`, is ahead 21/behind 1, and contains many other sessions' staged and unstaged changes. Current readback confirms there are no unresolved index conflicts.
- Detection gap: concurrent-session branch and publication ownership were not clean before this batch began.
- Prevention: require a clean `main` publication owner or an isolated task worktree before the next `codex:finish` handoff.
- Owner: repository session leader / owner of the current accounting branch and shared staged state.
- Next action: accept or relocate the unrelated session work, move the ASRS task-owned files to a clean `main` publication context, run `npm run codex:finish -- --files ...`, and verify `HEAD == origin/main`.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Deferred work includes cause, detection gap, prevention, owner, and next action.
