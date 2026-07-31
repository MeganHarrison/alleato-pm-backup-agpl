# Handoff: 2026-06-30 - Eve Project Intelligence Maintainer

## Intake Block

1) Session ID: S100
2) Task ID: `docs/ops/tasks/2026-06-30-eve-project-intelligence-maintainer.md`
3) Linear issue: AAI-774
4) Linear URL: https://linear.app/megankharrison/issue/AAI-774/implement-eve-project-intelligence-maintainer
5) Current status: Complete and live source lifecycle gate green.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer/**`; `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_project_intelligence_live_paths.mjs`; `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_project_intelligence_read_proof.mjs`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-30-eve-project-intelligence-maintainer.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-30-S100-eve-project-intelligence-maintainer.md`
7) Commands run and outcome (pass/fail counts): `npm install` pass with Node engine warning under default Node 22; `npm run typecheck` pass; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info` pass; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` pass 5/5 and 14/14 gates; `npm run rag:verify:project-intelligence-live-paths` pass; source lifecycle repair/backfills pass; `npm run rag:verify:source-lifecycle` pass at 2026-06-30T17:42:28.544Z; `npm run rag:verify:project-intelligence-read-proof` pass and exits cleanly.
8) Evidence artifacts (screenshot/video/report/log paths): Eve eval artifacts under `agents/project-intelligence-maintainer/.eve/evals/` (ignored local runtime output); command summaries recorded in this handoff.
9) Top 3 findings:
- Eve package compiles/discovers cleanly and evals pass 5/5 with read-only, approval-gated, and compact-output behaviors covered.
- Project Intelligence live-path guard had stale required-term pointers to moved docs stubs; it now validates required backend terms against the maintained architecture source while keeping moved stubs as existence checks.
- Live source lifecycle verification is green after repairs: Fireflies project-disposition ratio `1.0`, Fireflies embedded ratio `1.0`, packet read-back `current_packets=111`, `fresh_packets=98`.
10) Recommended next action (one line): Treat Eve maintainer implementation as complete; handle the two latest packet job `JSON could not be generated` failures as a separate reliability follow-up.
11) Handoff file path: `docs/ops/handoffs/2026-06-30-S100-eve-project-intelligence-maintainer.md`
12) Migration ledger evidence: N/A - implementation should avoid a migration unless persistent Eve run history becomes required.

## Linear Updates

- Kickoff comment: Posted by issue creation in AAI-774 with scope, branch, files expected, checks planned, and risks.
- Milestone comments: AAI-774 comment `b80c55ef-e67c-471e-851a-831ecfb6d393` posted with implementation evidence and DB verification blocker.
- Completion/blocker comment: AAI-774 comment `b80c55ef-e67c-471e-851a-831ecfb6d393`.

## Current Status

Implementation is complete for the isolated Eve package and has been cherry-picked onto local main. The package maintains Project Intelligence health, source coverage, stale packet detection, and approval-gated refreshes. It does not migrate Ask Alleato chat and does not duplicate the packet compiler.

Deterministic Eve evals now run through `npm run eval`, which sets `EVE_PROJECT_INTELLIGENCE_MOCK_MODEL=true` and uses fixture reports for read-only maintainer checks. Live model/tool evals remain available as `npm run eval:live`.

Live DB-backed verification is green. Repairs performed in this closeout:

- `npm run rag:backfill:source-lifecycle -- --days 2 --source-limit 1500` wrote 428 lifecycle rows and cleared project-disposition coverage.
- `RAG_DATABASE_WRITES_ENABLED=true npm run rag:backfill:fireflies-transcript-chunks -- --id=<source_id> --rebuild-existing=true --limit=1` repaired four Fireflies meeting transcript chunk/embedding gaps.
- Backend `enqueue_packet_refresh` plus `run_intelligence_compiler_batch` refreshed current packets; final read-back showed `current_packets=111`, `fresh_packets=98`, newest current packet `2026-06-30T17:42:00.031Z`.
- `npm run rag:verify:source-lifecycle` passed with an empty failures array at `2026-06-30T17:42:28.544Z`.

Non-gating note: packet_refresh_jobs still has old failed rows plus two latest failures with `JSON could not be generated`. The gate is green, but those two target-specific compiler failures should be cleaned up separately.

## Implementation Plan

### 1. Start With Required Tracking

- Create branch: `codex/eve-project-intelligence-maintainer`.
- Create task markdown from the closest current `docs/ops/tasks/*` pattern because `docs/ops/tasks/TASK-TEMPLATE.md` was not present.
- Create a Linear issue and record issue ID/URL in the task and this handoff.
- Post a Linear kickoff comment with scope, branch, files expected, checks planned, and risk.

### 2. Scaffold The Eve Package

- Add package root: `agents/project-intelligence-maintainer/`.
- Add explicit `eve` dependency there; do not rely on incidental root `node_modules`.
- Add:
  - `agent/agent.ts`
  - `agent/instructions.md`
  - `agent/lib/`
  - `agent/tools/`
  - `agent/schedules/`
  - `evals/evals.config.ts`
  - targeted `.eval.ts` files
  - README with local run, eval, and schedule dispatch commands

### 3. Agent Operating Contract

The instructions must require:

- Packet-first behavior.
- Fail-loudly reporting for stale packets, weak coverage, failed jobs, provider issues, or missing read-back.
- Separate reporting of `intelligence_packets.generated_at` and `intelligence_targets.last_signal_at`.
- No packet synthesis logic inside Eve.
- No mutation without explicit approval.
- No secret logging.
- Every failure includes cause, detection gap, prevention, owner path/table, exact failing command/API, and next action.

### 4. Shared Result Schema

Create a small shared schema in the Eve package:

- `status: "pass" | "warn" | "fail" | "blocked"`
- `checkedAt`
- `projectId`
- `targetId`
- `packetId`
- `latestSourceAt`
- `latestPacketAt`
- `ageHours`
- `sourceCoverage`
- `evidenceCount`
- `failedJobs`
- `cause`
- `detectionGap`
- `prevention`
- `ownerFiles`
- `nextActions`

Keep outputs compact. Redact tokens, DSNs, service-role keys, and any long source text.

### 5. Read-Only Tools First

Implement read-only Eve tools before any repair tool:

- `inspect_project_intelligence_targets`
- `check_packet_freshness`
- `check_source_coverage`
- `check_stale_project_data`
- `prove_packet_evidence`
- `summarize_maintainer_findings`

These tools should reuse existing contracts and scripts where possible:

- `frontend/src/app/api/admin/source-sync/status/route.ts`
- `scripts/verify/verify_project_intelligence_live_paths.mjs`
- `scripts/verify/verify_source_lifecycle_health.mjs`
- `scripts/verify/verify_project_intelligence_read_proof.mjs`
- existing Supabase service/RAG clients where package boundaries allow

### 6. Approval-Gated Repair Tools

Add repair tools only after read-only checks work:

- `refresh_project_packet`
- `refresh_stale_project_packets`
- `recompute_source_intelligence`
- `retry_failed_packet_jobs`

Every mutating tool must:

- Require Eve human approval.
- Reject unbounded scope by default.
- State expected write scope before execution.
- Use existing backend compiler/refresh paths.
- Read back `intelligence_packets`, source coverage, evidence counts, and failed jobs after execution.

Important existing guardrail: packet writes can be blocked by PM app final-projection guards. If the implementation needs bounded backend execution with `ALLOW_PM_APP_FINAL_PROJECTIONS=true`, document the exact command and read-back proof.

### 7. Schedule

Add one read-only schedule:

- Daily weekday Project Intelligence maintainer scan.
- Report only stale/degraded findings by default.
- No automatic mutation in v1.
- Use handler-form schedule so Slack/Linear delivery can be added later without changing the maintainer logic.

### 8. Evals

Add Eve evals that prove:

- Stale packet triggers warning/fail.
- Fresh packet with weak source coverage is not called healthy.
- Refresh requests require approval.
- Refresh result includes read-back proof.
- The agent calls maintainer tools instead of guessing from prompt text.
- Output stays compact and does not include large logs or secrets.

### 9. Verification

Run narrow checks in the main thread:

```bash
cd /Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer
npm install
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval
```

Run direct comparison checks from repo root:

```bash
cd /Users/meganharrison/Documents/alleato-pm
npm run rag:verify:project-intelligence-live-paths
npm run rag:verify:source-lifecycle
npm run rag:verify:project-intelligence-read-proof
```

Delegate expensive project-wide typecheck/build/predeploy checks to a cheaper sub-agent per repo rules.

## Exact Next Step

Create the branch and tracking artifacts:

```bash
cd /Users/meganharrison/Documents/alleato-pm
git status --short --branch
git switch -c codex/eve-project-intelligence-maintainer
```

Then create the task markdown and Linear issue before implementation files.

## Known Pitfalls

- Do not create a second Project Intelligence compiler inside Eve.
- Do not conflate packet timestamp with target signal timestamp.
- Do not call a packet healthy when source lifecycle or evidence proof is degraded.
- Do not run broad packet refreshes without approval and scope.
- Do not print Supabase service-role keys, database URLs, AI provider keys, or Render/Vercel secrets.
- Do not add UI unless explicitly requested; this slice is backend ops/control-plane only.
- Do not rely on the missing `docs/ops/tasks/TASK-TEMPLATE.md`; use a nearby current task file as the template.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
git status --short --branch
git switch -c codex/eve-project-intelligence-maintainer
sed -n '1,220p' /Users/meganharrison/.agents/skills/eve/SKILL.md
sed -n '1,220p' node_modules/eve/docs/README.md
sed -n '1,220p' node_modules/eve/docs/tools/overview.mdx
sed -n '1,220p' node_modules/eve/docs/tools/human-in-the-loop.md
sed -n '1,220p' node_modules/eve/docs/schedules.mdx
sed -n '1,220p' node_modules/eve/docs/evals/overview.mdx
```

## Evidence

- Project Intelligence packet loader: `frontend/src/lib/ai/intelligence/packet-service.ts`
- Project compiler guardrails: `backend/src/services/intelligence/compiler.py`
- Project packet refresh path: `backend/src/services/intelligence/project_intelligence.py`
- Source lifecycle status contract: `frontend/src/app/api/admin/source-sync/status/route.ts`
- Related verifiers:
  - `scripts/verify/verify_project_intelligence_live_paths.mjs`
  - `scripts/verify/verify_source_lifecycle_health.mjs`
  - `scripts/verify/verify_project_intelligence_read_proof.mjs`
