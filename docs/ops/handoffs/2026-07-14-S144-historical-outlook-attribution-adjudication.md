# S144 Handoff: Historical Outlook Attribution Adjudication

## Intake Block

1) Session ID: S144
2) Task ID: AAI-1067
3) Linear issue: AAI-1067
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1067/adjudicate-historical-outlook-attribution-conflicts-for-operational
5) Current status: Accepted
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/scripts/repair/adjudicate_outlook_attribution_conflicts.mjs`; `/Users/meganharrison/Documents/github/project-management/scripts/verify/verify_outlook_conversation_attribution_consistency.mjs`; S144 task, handoff, orchestration, report, and ledger paths
7) Commands run and outcome (pass/fail counts): live write passed; 180-day verifier passed across 4,942 rows and 3,184 identities with zero conflicts and two exceptions; idempotent dry-run passed with zero writes; 2/2 static parsing checks passed
8) Evidence artifacts (screenshot/video/report/log paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-14-historical-outlook-attribution-adjudication/REPORT.md` and `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-14-historical-outlook-attribution-adjudication/ledger.json`
9) Top 3 findings (frontend-visible issues first): 14 original episodes repaired; two source-backed exclusions retained; one connected McLane identity repaired after the guard exposed it
10) Recommended next action (one line): accept this corpus gate, then run the Operational Loss Baseline with the ledger exclusions applied
11) Handoff file path: `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-14-S144-historical-outlook-attribution-adjudication.md`
12) Migration ledger evidence: N/A unless implementation introduces a migration

## Linear Updates

- Kickoff comment: `d9a5f1da-196a-4426-a471-a280875de8b2`
- Milestone comments: Posted (`b448c793-4906-4db8-8385-f0f5bb6c0481`)
- Completion/blocker comment: Posted (`7467e91f-3d52-44f0-b5a2-5a25f853ee28`)

## Current Status

Accepted. The live database and downstream intelligence cleanup were published
to `origin/main` at `acafafc7fa`.

## Exact Next Step

Run the Operational Loss Baseline with both ledger exclusions enforced.

## Known Pitfalls

- A thread can legitimately mention multiple projects.
- Old project IDs may be duplicates/aliases, not independent active projects.
- `ai_manual_review` is not safe to override without source evidence.
- Parent emails and their attachments can legitimately belong to different
  projects; the Homestead/Ulta attachment boundary is preserved in the ledger.

## Evidence

- Parent repair: `docs/ops/evidence/2026-07-14-outlook-conversation-attribution-repair/REPORT.md`
- Adjudication report: `docs/ops/evidence/2026-07-14-historical-outlook-attribution-adjudication/REPORT.md`
- Ledger: `docs/ops/evidence/2026-07-14-historical-outlook-attribution-adjudication/ledger.json`

## Live Results

- 28 intake rows repaired with AAI-1067 attribution history.
- 4 attachment rows, 24 retrieval documents, and 62 chunks corrected.
- 13 candidates reset to `needs_review` on the correct targets.
- 10 unreviewed contaminated cards removed; no tasks or reviews referenced them.
- Two exceptions remain: mixed-project Checks and missing-project Shawnee.

## Failure / Recovery

- Cause: the first write used an uncast parameter inside `jsonb_build_object`.
- Detection gap: the dry-run did not execute the update statement.
- Prevention: the write statement now casts the project ID and the transaction
  rollback plus idempotent rerun path are recorded in the report.
- Owner files: `scripts/repair/adjudicate_outlook_attribution_conflicts.mjs`.
- Relation: task-related and corrected before final verification.
