# S129 Handoff: RAG Teams Alert Repair

Status: Pending Review - production complete; Linear posting blocked
Owner: Codex
Task: `docs/ops/tasks/2026-07-13-rag-teams-alert-repair.md`
Linear: Blocked - connector reauthentication required (`oauth_token_invalid_grant`).

## Intake Block

1) Session ID: S129
2) Task ID: rag-teams-alert-repair
3) Linear issue: AAI-000
4) Linear URL: https://linear.app/unavailable
5) Current status: Pending Review - production verified; Linear posting blocked by connector auth
6) Files changed (absolute paths):
   - /Users/meganharrison/Documents/github/project-management/backend/src/services/health/pipeline_alert_notifier.py
   - /Users/meganharrison/Documents/github/project-management/backend/tests/test_pipeline_alert_notifier.py
   - /Users/meganharrison/Documents/github/project-management/backend/src/services/intelligence/project_synthesizer.py
   - /Users/meganharrison/Documents/github/project-management/backend/tests/test_project_synthesizer_budget.py
   - /Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-13-rag-teams-alert-repair.md
   - /Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S129-rag-teams-alert-repair.md
7) Commands run and outcome (pass/fail counts):
   - PASS: focused notifier and synthesis tests, `18 passed`.
   - PASS: modified Python modules compile cleanly.
   - PASS: canonical Render notifier persistence/throttle production proof.
   - FAIL/DETECTED: first canonical synthesis run exited `1` after four projects because extraction consumed the projection budget; no UUID error remained.
   - PASS: final Render synthesis run wrote 10 packets and 10 current-state rows for 10 projects and exited successfully.
   - PASS: final alert run returned `pageWorthy=0`, `notified=0`, `teamsSent=false`, and `ledgerHealthy=true`.
   - PASS: final seven-day RAG stats show Teams zero backlog and project intelligence `51` fresh / `0` stale packets.
   - PASS: commits `c2754ccd0`, `6f6369bf5`, and `4de51881b` published to `origin/main`.
8) Evidence artifacts (screenshot/video/report/log paths):
   - docs/ops/tasks/2026-07-13-rag-teams-alert-repair.md
   - docs/ops/handoffs/2026-07-13-S129-rag-teams-alert-repair.md
   - Render deploys `dep-d9aaakd8nd3s73annudg`, `dep-d9aaake7r5hc73cdf01g`, and `dep-d9aafs6k1jcs73frl670`
9) Top 3 findings (frontend-visible issues first):
   - Teams ingestion was healthy; the message described stale project-page narratives.
   - Alert throttle state was not durable, so Teams delivery repeated every 15 minutes.
   - High-volume card extraction could starve page-critical packet/current-state writes under the shared projection cap.
10) Recommended next action (one line): Reauthenticate Linear, replace placeholder AAI-000, post the validated completion comment, and accept S129 in the review queue.
11) Handoff file path: docs/ops/handoffs/2026-07-13-S129-rag-teams-alert-repair.md
12) Migration ledger evidence: Not applicable; no migration files changed.

## Linear Updates

- Kickoff comment: Blocked - Linear connector rejected access with `oauth_token_invalid_grant`.
- Milestone comments: Blocked - no authenticated Linear issue/comment path is available.
- Completion/blocker comment: Production completion body is locally validated; posting remains blocked by `oauth_token_invalid_grant`.

## Scope

Restore project narrative freshness and make RAG alert delivery depend on a
durable throttle-ledger write, then verify both behaviors in production.

## Evidence Log

| Time | Action | Result |
| --- | --- | --- |
| 2026-07-13 | Read recent Archon Teams messages. | The same project narrative staleness alert repeats every 15 minutes. |
| 2026-07-13 | Ran seven-day RAG stats and direct DB freshness queries. | Teams ingestion is healthy; all 46 project-current-state rows are stale while synthesis packets are fresh. |
| 2026-07-13 | Read Render logs and deploy ledgers. | Synthesis cron is on an outdated deployment; notifier cannot write `system_alerts` because its RAG credential is not service-role authorized. |
| 2026-07-13 | Attempted Linear access. | Blocked by `oauth_token_invalid_grant`; no issue was fabricated. |
| 2026-07-13 | Added fail-closed alert reservation and synthesis exit-status guardrails. | Pass: Teams delivery is skipped after a ledger read/write failure; page-facing synthesis/projection errors now make the cron fail. |
| 2026-07-13 | Ran focused notifier and synthesis tests. | Pass: `15 passed`; modified Python modules compile cleanly. |
| 2026-07-13 | Repointed the alert and synthesis crons to the canonical repository, enabled autodeploy, and updated only their RAG service-role variable from the secure local source. | Pass: individual Render API updates returned `200`; no secret values were logged. |
| 2026-07-13 | Deployed both crons from canonical commit `c2754ccd0`. | Pass: both Render deploys reached `live`. |
| 2026-07-13 | Exercised the alert cron twice before synthesis recovery. | Pass: first run persisted the alert and delivered once; the repeat returned `notified=0`, `teamsSent=false`, `ledgerHealthy=true`. |
| 2026-07-13 | Read back the alert ledger directly. | Pass: exactly one active staleness row has durable throttle timestamps. |
| 2026-07-13 | Ran the canonical synthesis cron after the packet-ID repair. | Fail-loud: no UUID error; four packets/current-state rows were written, then six projects were blocked because card extraction had consumed the cumulative 100-row projection budget. |
| 2026-07-13 | Reserved page-critical narrative rows before high-volume extraction and continued L2 refresh after extraction-cap deferral. | Pass locally: `17 passed`; commit `6f6369bf5` is published to `origin/main`. Production rerun is pending. |
| 2026-07-13 | Observed the first reserved-budget run and canceled it after the document loop swallowed the run-level cap exception. | Detection gap confirmed; official Render cancel returned `204`, preventing further wasted extraction work. |
| 2026-07-13 | Made projection-cap errors escape the per-document retry boundary. | Pass locally: `18 passed`; fail-fast commit `4de51881b` is published and deploying. |
| 2026-07-13 | Ran final production synthesis on `4de51881b`. | Pass: 10/10 packets and 10/10 operating records; four extraction-only budget deferrals; no UUID error; cron exited successfully. |
| 2026-07-13 | Read back `project_current_state` directly. | Pass: all ten selected project IDs advanced between `09:05:13Z` and `09:09:36Z`. |
| 2026-07-13 | Ran notifier after narrative recovery and read back the ledger. | Pass: no page-worthy alert, no Teams delivery, healthy ledger; the single alert row is resolved. |
| 2026-07-13 | Ran final seven-day RAG stats. | Pass for requested lane: Teams zero backlog; project intelligence 51 fresh and 0 stale packets. |

## Changed Files

- `backend/src/services/health/pipeline_alert_notifier.py`
- `backend/tests/test_pipeline_alert_notifier.py`
- `backend/src/services/intelligence/project_synthesizer.py`
- `backend/tests/test_project_synthesizer_budget.py`
- `docs/ops/tasks/2026-07-13-rag-teams-alert-repair.md`
- `docs/ops/handoffs/2026-07-13-S129-rag-teams-alert-repair.md`

## Risks

- Provider credential values must never appear in logs or documentation.
- A manual synthesis rerun can create packet/card writes; use the existing
  bounded production cron and verify its configured projection limit.
- The shared checkout has extensive unrelated work; publish only exact
  task-owned files.

## Next Step

Reauthenticate the Linear connector, replace `AAI-000` with the real issue,
post the validated completion comment, and process the Pending Review row.

## Blocker Record

- Cause: Linear connector OAuth refresh grant is invalid.
- Detection gap: no authenticated issue/comment path was available during the task.
- Prevention: restore connector authentication and require a real AAI issue before review acceptance.
- Owner: workspace Linear connector administrator.
- Next action: reauthenticate, create/update the issue, and post the generated handoff comment.
