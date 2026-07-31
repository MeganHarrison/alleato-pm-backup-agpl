# Handoff: 2026-07-26 — Weekly training resource finder cron

## Intake Block

1) Session ID: S228
2) Task ID: ALL-23
3) Linear issue: ALL-23
4) Linear URL: https://linear.app/alleato-group/issue/ALL-23/t9-weekly-cron-optional-in-app-trigger
5) Current status: Complete
6) Files changed (absolute paths): the registered S228 training contracts,
   selector/runner, tests, `render.yaml`, architecture note, and evidence files.
7) Commands run and outcome (pass/fail counts): Python compile passed; focused
   pytest passed 27/27; YAML parse and Render Blueprint validation passed; live
   dry run and triggered cron run passed.
8) Evidence artifacts (screenshot/video/report/log paths): task, verification
   manifest/result, Render service/run readback, and Supabase queue readback.
9) Top 3 findings (frontend-visible issues first): no frontend surface is
   required; the live cron added one relevant review row; live logs exposed and
   tests now prevent unrelated deep/free courses from passing eligibility.
10) Recommended next action (one line): review the two relevant free resources
    in the existing Training review queue.
11) Handoff file path:
    `docs/ops/handoffs/2026-07-26-S228-training-resource-finder-weekly-cron.md`
12) Migration ledger evidence: N/A — ALL-23 changes no schema.

## Linear Updates

- Kickoff comment: https://linear.app/alleato-group/issue/ALL-23/t9-weekly-cron-optional-in-app-trigger#comment-914afbdb
- Completion comment: https://linear.app/alleato-group/issue/ALL-23/t9-weekly-cron-optional-in-app-trigger#comment-21859855

## Independent Review

- Reviewer: `/root/training_finder_review`
- Initial decision: Needs Rework — missing Supabase configuration escaped before
  the finder error boundary and produced a traceback.
- Remediation: shared finder repository construction now emits
  `TRAINING_RESOURCE_CONFIGURATION_FAILED`; direct unset-environment execution
  returns structured `TRAINING_WEEKLY_RUN_FAILED` JSON and exits 1.
- Final decision: `APPROVED` after focused re-review on 2026-07-26.
- Live relevance remediation: `APPROVED` after the reviewer confirmed the new
  construction-role plus explicit scheduled-topic phrase policy.

## Dry-Run And Baseline Evidence

- Rotation policy: `weekly-role-rotation-v1`, anchored Monday 2026-01-05 UTC.
- Replay date: 2026-07-26; selected week start 2026-07-20, rotation index 4,
  assistant-superintendent / look-aheads-pull-planning.
- Canonical-project dry run: completed, 8 searched, 1 eligible would-insert, 7
  rejected, 0 inserted, 0 failed.
- Queue baseline: one prior finder-created row, resource
  `8b3e2279-7fcd-4c50-8d15-5e9d507bde94`, still `review` and `free`.
- Wrong-project guardrail proof: a stale VS Code history Supabase URL/key pair
  produced `TRAINING_TAXONOMY_LOOKUP_FAILED` with PostgREST `PGRST205` and a
  non-zero exit. Cause: noncanonical local credentials. Detection gap: history
  files do not identify the project lifecycle. Prevention: derive the current
  URL from repository `.env`, reveal the matching service-role key through the
  Supabase management API, and verify Render's project ref before triggering.

## Release Evidence

Task file:
`docs/ops/tasks/2026-07-26-training-resource-finder-weekly-cron.md`

Verification manifest:
`backend/src/services/training/__verification__/weekly-cron.verification-manifest.json`

Verification result:
`backend/src/services/training/__verification__/weekly-cron.verification-result.json`

Migration ledger evidence: N/A — this slice changes no migration.

## Live Render And Queue Evidence

- Cron service: `crn-d9j77bbtqb8s739t4gog`
- Schedule/runtime: Monday 13:15 UTC, Docker, starter, branch `main`, auto-deploy.
- First deploy: `dep-d9j77bjtqb8s739t4hjg`, live on
  `e09579c246fd5be7ec89c507ef84f46bced7fb7f`.
- Required env readback: Tavily, current-project Supabase URL, and service-role
  keys exist and are non-empty; URL project ref is `lgveqfnpkxvzbnnwuled`.
- Triggered run: `crn-d9j77bbtqb8s739t4gog-1785099321`, successful.
- Run result: assistant-superintendent / look-aheads-pull-planning, commit mode,
  8 searched, 1 accepted, 1 inserted, 7 rejected, 0 failed.
- Queue row: `1ad37217-dbda-4888-a216-26da7082cfe1`, `review`, `free`, `video`,
  `deep-dive`, `field`; active assistant-superintendent and
  look-aheads-pull-planning links confirmed.
- Live-log guardrail finding: unrelated Terraform and Oracle SQL results had
  passed the old eligibility policy and were stopped only by the one-row cap.
  A first broad-term correction then admitted a generic construction-business
  course because it contained `planning`. After inspecting the actual provider
  evidence, the final candidate requires explicit normalized relevance phrases
  for all six scheduled topics.
- Cleanup: invalid resource `5f5b3988-b7d9-4494-9303-10ea5870a0ae` moved from
  `review` to recoverable `archived`; it was never published.
- Learning fingerprint: `ai.training-resource-topic-relevance-drift`; registry
  lookup and strict audit pass.
- Final publication: `4050c73444b8a02f9ab83857a8716c7cd4df5928`.
- Final cron deploy: `dep-d9j7d2nlk1mc739vt4a0`, live on that exact commit.
- Final triggered run: `crn-d9j77bbtqb8s739t4gog-1785099970`,
  `successful`; 0 inserted, 2 duplicate, 6 rejected, 0 failed.
- Live relevance proof: Terraform, Oracle SQL, and generic OneNote results were
  rejected with `irrelevant_result`.
- Final queue readback: two relevant finder resources remain `review`; one
  invalid hardening candidate remains recoverably `archived`; none published.
- Linear state readback: ALL-23 is `Done`.
