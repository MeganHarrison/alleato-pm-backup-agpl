# Task: Repair Executive Brief Cron RAG Connectivity

Status: Complete
Owner: Codex
Created: 2026-07-15
Task ID: AAI-1075
Linear Issue: AAI-1075 — https://linear.app/megankharrison/issue/AAI-1075/repair-executive-daily-brief-cron-rag-database-connectivity
Related Handoff: `docs/ops/handoffs/2026-07-15-S-executive-brief-cron-rag-connectivity.md`

## Objective

Repair the canonical Render Executive Daily Brief cron so the weekday run can
read the RAG database, compile the brief, and write today's
`intelligence_packets` row.

## Scope

- Own the shared Supabase connection normalization used by the Daily Brief compiler.
- Own the live Render cron deployment and one controlled rerun for 2026-07-15.
- Exclude unrelated frontend work and Teams delivery.

## Source of Truth

- Canonical runtime/data owner: Render cron `alleato-daily-executive-brief-0600-et` and `public.intelligence_packets` target `daily-executive-brief`.
- Existing shared primitives/services: `scripts/verify/app-db-connection.mjs`, `scripts/intelligence/daily-executive-brief.mjs`, `scripts/intelligence/run-scheduled-daily-executive-brief.mjs`.
- Deprecated or parallel paths: legacy daily recap generation and outbound Teams delivery.

Verification contract: Required

## Acceptance Criteria

- [x] The first failing boundary and root cause are recorded from live evidence.
- [x] RAG Supabase direct hosts are normalized to reachable regional poolers for scheduled runtime.
- [x] The cron exits non-zero with an actionable error if database connectivity still fails.
- [x] Today's canonical packet is written and read back from `intelligence_packets`.
- [x] The deployed controlled run crossed the repaired boundary and wrote the canonical packet; the one-off CLI status remained opaque and was canceled after the packet appeared.
- [x] Existing duplicate/idempotency protection remains intact.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared connection abstraction owns the fix; no service-specific host hack.
- [x] Focused tests cover the RAG connection normalization.
- [x] Live provider deployment is verified by read-back.

Planned files:

- `scripts/intelligence/daily-executive-brief.mjs`
- `scripts/verify/app-db-connection.mjs` tests or focused scheduler test
- `docs/ops/tasks/2026-07-15-executive-brief-cron-rag-connectivity.md`
- `docs/ops/handoffs/2026-07-15-S-executive-brief-cron-rag-connectivity.md`

## Integration and Verification

- [x] Targeted static/unit checks pass.
- [x] Live Render deployment and controlled cron rerun pass.
- [x] Canonical packet ledger read-back proves today's business date.
- [x] Evidence artifacts are recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: connection error includes the failing database boundary and host family/network condition.
- Detection path: Render cron logs, `npm run verify:executive-daily-brief-schedule`, and packet-ledger read-back.
- Recovery path: normalize the Supabase direct host to the regional pooler, deploy, rerun once, and confirm the packet row.

## Incident Learning

- Failure fingerprint: `operations.provider-runtime-drift`
- Root cause: the compiler explicitly disabled direct-host normalization for `RAG_DATABASE_URL`, so Render attempted an IPv6-only Supabase host and failed with `ENETUNREACH`.
- Detection gap: the schedule verifier checked service/config shape and packet freshness but did not execute the RAG connectivity path before the first scheduled run.
- Prevention: shared connection normalization for both app and RAG Supabase URLs plus a focused runtime connectivity test.
- Guardrail evidence: `node scripts/ops/learning-registry.mjs lookup --symptom "Executive Daily Brief cron ENETUNREACH Supabase IPv6 RAG database" --files scripts/intelligence/daily-executive-brief.mjs scripts/verify/app-db-connection.mjs` completed before implementation; `node scripts/ops/learning-registry.mjs audit --staged` is required at publish.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1075 | Pass | Scope and done gate captured before implementation. |
| Runtime localization | Render logs for 2026-07-15 10:00Z | Pass | First failing boundary is RAG DB connection: `ENETUNREACH` on IPv6; app packet write was never reached. |
| Post-deploy packet write | `docs/ops/evidence/2026-07-15-executive-brief-cron-rag-connectivity/postdeploy-runtime-readback.md` | Pass | Packet `e7cf0335-09e5-438c-8a74-f1e9185e0388` written for business date 2026-07-14 after the repaired image went live. |
| Live schedule verifier | `npm run verify:executive-daily-brief-schedule -- --expect-business-date 2026-07-14` | Pass | Active Render cron and canonical packet readback passed. |

## Remaining Risk

- Render reports `lastSuccessfulRunAt: null` for the cron service even though the controlled run wrote the packet; this provider metadata remains a monitoring gap and should be repaired in the scheduler verifier/alerting follow-up.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
