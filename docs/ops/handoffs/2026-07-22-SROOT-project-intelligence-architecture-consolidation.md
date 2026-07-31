# Handoff: 2026-07-22 — Project Intelligence architecture consolidation

## Intake Block

1) Session ID: SROOT-PROJECT-INTELLIGENCE-ARCH
2) Task ID: AAI-1032
3) Linear issue: AAI-1032
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1032/deepen-project-intelligence-pipeline-content-source-module
5) Current status: Complete — architecture consolidated, final controlled run passed, canonical screenshots attached
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/project-intelligence/`; `/Users/meganharrison/Documents/github/project-management/backend/Dockerfile.executive-brief`; `/Users/meganharrison/Documents/github/project-management/package.json`; `/Users/meganharrison/Documents/github/project-management/docs/architecture/PROJECT-INTELLIGENCE.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/project-intelligence-runbook.md`; task/handoff
7) Commands run and outcome (pass/fail counts): ownership tests 2/2 pass; scheduler tests 9/9 pass; Node phase 65/65 pass; backend phase 51/51 pass; publication checks pass; first controlled regeneration was a successful no-op; second executed the full corpus and failed closed before publication; third proved failure persistence but exposed an unsupported `json_object` provider contract; fourth reached runtime validation and exposed non-strict schema drift; focused checks pass and the strict full JSON Schema passes a live adversarial provider probe
8) Evidence artifacts (screenshot/video/report/log paths): `/tmp/project-intelligence-architecture-review.html`; `docs/ops/evidence/2026-07-22-project-intelligence-architecture-consolidation/{daily-brief-desktop,daily-brief-mobile,daily-brief-detail-desktop,daily-brief-detail-mobile}.png`; compiler/consumer runtime evidence
9) Top 3 findings (frontend-visible issues first):
   - Render's canonical Daily Brief cron copies root `scripts/` and invokes a root compiler.
   - Backend also owns separate project-synthesis and domain-packet cron entrypoints.
   - Existing docs identify the packet-to-operating-record seam, but no executable ownership guard enforces it.
10) Recommended next action (one line): monitor the next normal 6:00 AM ET run; investigate only if the now-persistent scheduler/packet receipts fail.
11) Handoff file path: `docs/ops/handoffs/2026-07-22-SROOT-project-intelligence-architecture-consolidation.md`
12) Migration ledger evidence: N/A — no schema migration in this slice.

## Linear Updates

- Kickoff/milestone evidence: recorded in this handoff and task evidence ledger.
- Completion comment: Linear comment `4299f619-16f7-48a0-abf6-44a1fa59d2c9` with four viewable screenshot attachments.

## Current Status

The Project Intelligence architecture consolidation is complete. The runner, shared compiler owners, backend final writers, packet repository, projection fan-out, read-only web adapters, strict provider schema, documentation, controlled run, Render readback, and canonical browser proof are published and verified.

Focused Node owners now exist and are integrated for model transport, executive synthesis, project operating records, packet persistence, consumer receipt validation, and governed projection fan-out. The shared backend compiler delegates PM-app final writes and packet-item persistence to the canonical Project Intelligence package. The frontend canonical packet/API adapters remain read-only and preserve the full-report/detail versus concise-summary/landing route split.

### Tracked baseline adoption record

Two tracked files contained unowned one-line archive-cleanup changes before this phase:

- `project-intelligence/core/compile-daily-executive-brief.mjs`: default evidence root changed from `docs/ops/evidence/2026-07-07-manual-daily-executive-brief` to `tmp/evidence/2026-07-07-manual-daily-executive-brief`.
- `project-intelligence/projections/daily-deep-read-consumers.mjs`: default evidence root changed from `docs/ops/evidence/2026-07-07-daily-deep-read-consumers` to `tmp/evidence/2026-07-07-daily-deep-read-consumers`.

The checkout gate cannot quarantine tracked work. Recovery procedure: restore only those exact lines to the recorded Git baseline, claim both exact paths under AAI-1032, then reapply the two preserved changes under the lease before any architectural integration. No other content is removed or rewritten during recovery.

## Exact Next Step

Observe the next normal 6:00 AM ET run. The cron is active on `main` with auto-deploy enabled; scheduler failures and incomplete publication now remain visible rather than producing a successful no-op.

## Known Pitfalls

- Do not stage unrelated dirty paths or touch active FMDS/ASRS leases.
- Do not claim that a directory tree alone consolidates ownership; the guard must fail on duplicate cron/runtime paths.

## Resume Commands

```bash
node scripts/ops/checkout-session-gate.mjs status
rg -n "alleato-daily-executive-brief|project-synthesis-sweep|domain-packet-compiler" render.yaml
```

## Evidence

- `backend/Dockerfile.executive-brief:1-18`
- `render.yaml:675-732,765-775`
- `project-intelligence/runner/run-scheduled-daily-executive-brief.mjs`
- `project-intelligence/core/ownership-contract.mjs`
- `project-intelligence/runner/__tests__/ownership-contract.test.mjs`
- `/tmp/project-intelligence-architecture-review.html`
- `docs/architecture/content-source-and-operating-record-design.md`
- Node phase gate: 65/65 pass.
- Backend ownership gate: 51/51 pass with `backend/.venv/bin/python`; the first `/usr/bin/python3` invocation failed at collection because macOS Python 3.9 cannot parse the backend union type syntax.
- `docs/architecture/project-intelligence-workflow.svg`
- First controlled regeneration returned `skipped: true` / `scheduler_run_already_succeeded` against run `c4150e6d-5100-444e-9ba3-439a3e19fff9` attempt 13 and therefore did not execute the compiler or consumers.
- Root cause: explicit `--regenerate` bypassed the existing-packet check but was then suppressed by the ordinary scheduler recovery policy. `resolveSchedulerExecutionDecision` now overrides that policy only for explicit regeneration; focused scheduler tests pass 8/8.
- Second controlled run executed 616 enumerated rows and materialized 222 sources / 1,925,612 reconciled characters with zero source failures. It correctly withheld publication after five structured responses failed JSON parsing, then exposed a terminal-failure SQL timestamp/text mismatch that left scheduler attempt 14 `running`.
- Structured calls now use the AI Gateway-supported `json_schema` format backed by `brief-v3-response-schema.mjs` and retain bounded provider/finish-reason/length diagnostics on parse failure. Failure persistence explicitly casts retry/completion/update parameters to `timestamptz`. Focused checks pass 20/20.
- A live provider compatibility probe using the complete Brief v3 response schema returned `finishReason=stop` and all required top-level keys before the next full controlled run.
- The next full run reached runtime validation but failed because the non-strict provider schema allowed more than three watchouts plus non-slug claim IDs and prevention keys. The canonical schema now uses strict mode and encodes those runtime constraints; a live adversarial probe confirmed enforcement.
- The strict-schema run completed the full read and synthesis artifacts, then failed closed at packet persistence because the extracted repository had dropped the canonical Supabase TLS pool configuration. `buildPacketDatabaseConfig` now owns that contract; repository tests pass 3/3 and a live connection probe returned `{ "ok": 1 }`.
- Final controlled run passed: packet `c1474a3d-d6cd-4741-b2e5-c24bfc061240`, generated `2026-07-22T14:25:08.045Z`, business date `2026-07-21`, current/fresh/completed; scheduler attempt 18 succeeded.
- Full-source receipt: 618 enumerated rows; 222 materialized sources; 1,925,612 source characters exactly equal model-input characters; zero failures/truncations.
- Consumer receipts: 30 candidates; 18/18 current-state rich updates; 25 consolidated tasks plus 5 decision signals; 11/11 progress reports; completed packet promotion.
- Canonical proof: `https://projects.alleatogroup.com/daily-brief` and `https://projects.alleatogroup.com/daily-briefs/c1474a3d-d6cd-4741-b2e5-c24bfc061240`; summary/detail desktop/mobile screenshots attached to AAI-1032.
- Live Render verification: cron `alleato-daily-executive-brief-0600-et` is active, unsuspended, tracks `main`, has auto-deploy enabled, and its live revision contains all task commits.
