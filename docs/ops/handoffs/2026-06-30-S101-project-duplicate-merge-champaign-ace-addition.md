# Handoff: 2026-06-30 - Project duplicate merge: Champaign Ace Addition

## Intake Block

1) Session ID: S101
2) Task ID: AAI-839
3) Linear issue: AAI-839
4) Linear URL: https://linear.app/megankharrison/issue/AAI-839/merge-duplicate-project-data-from-champagne-ace-addition-il-into
5) Current status: Pending Review
6) Files changed (absolute paths):
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-30-project-duplicate-merge-champaign-ace-addition.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-30-S101-project-duplicate-merge-champaign-ace-addition.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md
   - /Users/meganharrison/Documents/alleato-pm/scripts/ops/merge-project-duplicates.mjs
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/dry-run.txt
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/execute.txt
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/post-merge-dry-run.txt
7) Commands run and outcome (pass/fail counts):
   - pass=6 fail=2
   - pass: live project row lookup, FK inventory, dry-run merge, live execute merge, post-merge dry-run, `node --check`
   - fail: first dry run missed string-typed project IDs; second dry run hit `intelligence_packets_one_current_per_target` before the guardrail was added
8) Evidence artifacts (screenshot/video/report/log paths):
   - docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/dry-run.txt
   - docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/execute.txt
   - docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/post-merge-dry-run.txt
9) Top 3 findings (frontend-visible issues first):
   - The duplicate row `1028` was a sparse shell tied to closed Acumatica project `8530`, while canonical row `1008` carried the active metadata and current user-facing footprint.
   - The only live project-owned rows on `1028` were `acumatica_project_budgets` (96), `project_attribution_rules` (5), `project_documents` (2), `document_attribution_candidates` (3), duplicate `project_roles` (3), and one duplicate `intelligence_target`.
   - The intelligence-target merge needed a guardrail: duplicate current packets had to be demoted to `snapshot` before reparenting or the unique current-packet constraint would fail.
10) Recommended next action (one line):
    - Accept the handoff, then decide whether to add a recurring duplicate-project detector for near-name Acumatica sync collisions.
11) Handoff file path:
    - docs/ops/handoffs/2026-06-30-S101-project-duplicate-merge-champaign-ace-addition.md
12) Migration ledger evidence:
    - No migration planned currently.

## Linear Updates

- Kickoff comment: Posted to AAI-839
- Milestone comments: None beyond final evidence update
- Completion/blocker comment: Posted to AAI-839; issue moved to `In Review`

## Current Status

Live merge executed successfully. Source project `1028` is archived, target
project `1008` now owns the moved rows and alias, and post-merge verification
shows zero remaining FK references on the source.

## Exact Next Step

Wait for review acceptance or open a follow-up issue for automatic duplicate-project detection.

## Known Pitfalls

- The source row still keeps its legacy Acumatica identity (`8530`) and company linkage because the merge archived it instead of deleting it.
- A future duplicate merge can fail on target-level unique constraints unless the operation demotes duplicate `intelligence_packets` and resolves same-name `project_roles`.
- The canonical row `1008` already had a stale-looking `archived_at` timestamp while `archived=false`; this was observed in read-back but not changed.

## Resume Commands

```bash
node scripts/ops/merge-project-duplicates.mjs --source 1028 --target 1008
node scripts/ops/merge-project-duplicates.mjs --source 1028 --target 1008 --execute
node --check scripts/ops/merge-project-duplicates.mjs
```

## Evidence

- Dry run: `docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/dry-run.txt`
- Execute: `docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/execute.txt`
- Post-merge verification: `docs/ops/evidence/2026-06-30-project-duplicate-merge-champaign-ace-addition/post-merge-dry-run.txt`
