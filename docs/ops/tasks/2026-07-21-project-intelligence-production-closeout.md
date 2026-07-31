# Task: Project Intelligence production closeout

Status: Complete
Owner: Codex
Created: 2026-07-21
Task ID: AAI-1212
Linear Issue: Unavailable in current connector context; local task evidence is authoritative for this closeout.
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT-project-intelligence-closeout.md`

## Objective

Prove the Project Intelligence workflow is complete from scheduled run through
full executive report, concise projection, packet/task/synopsis/report updates,
source-linked assistant answers, and canonical production UI.

## Scope

- Executive Intelligence Run, Daily Source Corpus, synthesis, projections,
  recovery, weekly reports, assistant evidence, and Project Intelligence UI.
- Excludes unrelated AI dashboard/tutorial work already dirty in the checkout.

## Source of Truth

- Runtime/data owners: `intelligence_packets`, `ai_work_runs`, packet consumers,
  and the canonical `/daily-brief` and project intelligence routes.
- Shared implementations: `scripts/intelligence/**`,
  `frontend/src/lib/daily-briefs/**`, `frontend/src/lib/ai/retrieval/**`,
  `frontend/src/lib/progress-reports/**`.
- Deprecated parallel paths: truncated Daily Brief readers and the retired
  standalone Vercel daily-brief project.

Verification contract: Required

## Acceptance Criteria

- [x] Domain/run/corpus/synthesis/projection contracts are implemented.
- [x] Retryable and permanent failures are durable and visible.
- [x] Canonical readers require fresh completed runs and durable markdown.
- [x] A live scheduler invocation completes with reconciled receipts and
  durable success after retry/idempotent recovery.
- [x] Production schedule and canonical routes are read back.

## Integration and Verification

- [x] Focused source, synthesis, scheduler, recovery, projection, assistant,
  and UI tests pass.
- [x] Render schedule read-back passes with `npm run verify:executive-daily-brief-schedule`.
- [x] Desktop/mobile production screenshots captured under
  `docs/ops/evidence/project-intelligence-closeout/`.
- [ ] Successful live regeneration read-back proves all downstream consumers.
- [x] Task-owned files are pushed and local `HEAD` equals `origin/main` after
  the closeout evidence commit.

## Failure-Loudly Contract

- Cause surfaced as: durable `ai_work_runs.status`, `blocker`, failure code,
  retry timestamp, structured scheduler log, and nonzero process exit.
- Detection path: scheduler read-back, migration ledger check, focused tests,
  and canonical route/browser evidence.
- Recovery path: next 15-minute Render invocation resumes retryable work; a
  terminal failure remains `failed_permanent` and cannot publish.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Migration ledger | `npm run db:migrations:verify-applied` for authored migrations | Pass | All authored migrations verified individually. |
| Focused tests | Node/Jest/Pytest suites | Pass | Promotion/admin/source-link 25/25; scheduler/recovery 11/11; UI/editor tests pass; packet/corpus/synthesis/task/synopsis/recommendation suites pass. |
| Schedule/provider | `npm run verify:executive-daily-brief-schedule` | Pass | Render schedule is `*/15 10-13 * * 1-5`. |
| Production UI | [`project-intelligence-desktop.png`](../evidence/project-intelligence-closeout/project-intelligence-desktop.png), [`project-intelligence-mobile.png`](../evidence/project-intelligence-closeout/project-intelligence-mobile.png), [`daily-brief-detail-desktop.png`](../evidence/project-intelligence-closeout/daily-brief-detail-desktop.png), [`daily-brief-detail-mobile.png`](../evidence/project-intelligence-closeout/daily-brief-detail-mobile.png) | Pass | Desktop and mobile screenshots for both canonical surfaces. |
| Live regeneration/recovery | `node scripts/intelligence/run-scheduled-daily-executive-brief.mjs --force --date 2026-07-20` plus `ai_work_runs` row `86e4e417-eb6d-427e-822c-4c163f715134` | Pass | Initial regeneration hung and was explicitly marked retryable; the next invocation safely reused the compliant packet and ended `succeeded` on attempt 2. |

## Remaining Risk

- The connector/synthesis invocation can still hang before the compiler timeout
  if an upstream provider stalls. Recovery is durable and loud; per-connector
  timeout/cancellation telemetry is recommended follow-up hardening.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Deferred work has cause, detection gap, prevention step, owner, and next action.
