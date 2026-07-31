# Task: Daily Brief Fail-Closed Run Contract

Status: Complete
Owner: Codex S206
Created: 2026-07-20
Task ID: AAI-1214
Linear Issue: AAI-1214 — https://linear.app/megankharrison/issue/AAI-1214/make-the-daily-brief-pipeline-fail-closed-on-incomplete-intelligence
Related Handoff: `docs/ops/handoffs/2026-07-20-S206-daily-brief-run-contract.md`

## Objective

Make each scheduled Daily Brief an atomic Executive Intelligence Run: it becomes current only after the complete eligible source corpus is enumerated and every required downstream project-intelligence projection passes read-back verification.

## Scope

- Own the scheduled compiler, source-corpus enumeration, packet staging/promotion, required consumer outcome, focused tests, production execution, and canonical-route evidence.
- Reuse the existing Daily Brief packet, project projection RPC, task, and progress-report owners; do not create a parallel brief product or deployment.
- Do not change source ingestion ownership or invent missing source content.

## Source of Truth

- Canonical runtime/data owner: `scripts/intelligence/run-scheduled-daily-executive-brief.mjs` and `scripts/intelligence/daily-executive-brief.mjs`
- Existing shared primitives/services: `scripts/intelligence/daily-deep-read-consumers.mjs`, `public.intelligence_packets`, `public.apply_project_current_state_projection`
- Deprecated or parallel paths: any packet-existence-only success check; any current packet promoted before consumer completion

Verification contract: Required

## Acceptance Criteria

- [x] The eligible source corpus is fetched with deterministic pagination and an explicit completeness manifest.
- [x] The new packet remains staged until required consumers and read-backs succeed.
- [x] Rejected or incomplete project-state projection fails the entire run loudly.
- [x] The scheduler verifies a completed run receipt, not packet existence alone.
- [x] Exactly one successful packet is current; a failed run preserves the previous current packet.
- [x] Requested behavior is observable end to end on the production schedule path.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate success paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits: compiler, consumers, scheduler, focused tests, domain glossary, incident registry, task/handoff/control-plane docs.
- [x] Shared abstraction owns cross-cutting run-completion behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual production schedule-path readback proves the requested outcome.
- [x] A viewable screenshot of the canonical production Daily Brief route is attached to AAI-1214.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a specific incomplete-corpus, rejected-projection, missing-readback, or promotion failure with packet/run provenance.
- Detection path: focused contract tests plus the scheduled runner's non-zero exit and production run receipt.
- Recovery path: correct the failed boundary and rerun the same business date; the prior current packet remains available until success.

## Incident Learning

- Failure fingerprint: `intelligence.daily-brief-premature-success`
- Root cause: packet freshness/current state was committed before the full run contract was proven.
- Detection gap: the scheduler checked only packet existence/compiler version, corpus reads were capped, and rejected projection outcomes were counted rather than failed.
- Prevention: deterministic corpus completeness, staged packets, required consumer receipt/readbacks, and atomic promotion.
- Guardrail evidence: 33 focused contract tests, the failed-closed AI Gateway run, completed production packet `951dfc33-a793-4e25-ba00-e6fa9a264b96`, and independent verification PASS.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1214 | Pass | Scope and done gate captured before implementation. |
| Runtime localization | Compiler/consumer/scheduler boundary inspection | Pass | First divergence is premature packet success, before downstream proof. |
| Focused contracts | `node --test` for source corpus, scheduler, v3 generator/consumer | Pass | 33 tests passed; pagination, zero truncation, materialization, projection rejection, staged promotion, and provider fallback covered. |
| Live source acquisition | `--sources-only --date 2026-07-18` | Pass | 325 eligible/fetched/unique; 9 materialized; 316 explicitly outside the business-day window; 0 critical failures. |
| Provider failure gate | First full scheduled run | Pass (failed closed) | AI Gateway credit rejection exited non-zero; no packet/fanout writes occurred; prior current packet remained unchanged. |
| Provider fallback | Full scheduled run with configured direct OpenAI path | Pass | Packet `951dfc33-a793-4e25-ba00-e6fa9a264b96`; 27,932/27,932 characters; 0 truncations; 7/7 candidates; 1/1 project state; 5 tasks; completed current receipt. |
| Render fallback configuration | Individual Render env-var API update and GET readback | Pass | `OPENAI_API_KEY` is present on `alleato-daily-executive-brief-0600-et`; value was not printed. |
| Canonical browser route | `https://projects.alleatogroup.com/daily-briefs/951dfc33-a793-4e25-ba00-e6fa9a264b96` | Pass | Authenticated production route rendered the new packet; screenshot attached to AAI-1214 and stored under task evidence. |
| Incident registry | `node scripts/ops/learning-registry.mjs audit --staged` | Pass | 16 fingerprints valid. |
| Independent verification | `verification-manifest.json` and `verification-result.json` | Pass | Independent reviewer approved the complete-corpus, fail-closed, atomic-promotion, and canonical-route claims; 33/33 focused tests passed. |
| Publication | `codex:finish` plus explicit fast-forward push | Pass | Task-owned implementation published to `origin/main` at `0eb283976afd11580af3a39620fc1226ea5a4dc9`; local and remote hashes matched. |
| Render cron deployment | Existing service `crn-d827chojs32c73doj780`, deploy `dep-d9fd1k8jo6nc73df91og` | Pass | Existing cron is live on implementation commit `0eb283976afd11580af3a39620fc1226ea5a4dc9`; no new service or project was created. |
| Post-deploy browser proof | Canonical production route screenshot | Pass | Authenticated route re-opened after the cron deploy and the screenshot was recaptured from the same completed packet. |
| Forced production trigger | Render job `job-d9fd5nf41pts73duvee0` | Expected fail, fail-closed | Compiler staged packet `a1fe7411-ff5d-4e40-bff9-7a45a6a80971`; consumer RAG connection failed with `ENETUNREACH`; staged packet did not replace current. First divergence localized to consumer RAG direct-host configuration. |
| Consumer connectivity guard | Shared `RAG_DATABASE_CONNECTION_OPTIONS`; focused suite | Pass | Compiler and both consumer RAG boundaries use Supavisor normalization; 35/35 focused tests pass, including a call-site regression guard. |
| Corrected forced production rerun | Render job `job-d9fd9d3tqb8s73crquo0` | Pass | Job succeeded on deployed commit `8ebcc9dfc`; packet `110a6bd4-a5d4-4345-b9ea-7cd9e675e8f9` is current/fresh/completed with 325 corpus rows, 27,932/27,932 characters, 0 truncation, 5/5 candidates, 2/2 projections, 0 rejection, and 3 tasks replaced/inserted. |
| Independent packet/schedule readback | `verify_daily_executive_brief_schedule.mjs` | Pass | Live existing cron is active on `main`; latest canonical packet is `110a6bd4-a5d4-4345-b9ea-7cd9e675e8f9`. |
| Corrected browser proof | Authenticated canonical route | Pass | New packet opened at `https://projects.alleatogroup.com/daily-briefs/110a6bd4-a5d4-4345-b9ea-7cd9e675e8f9`; screenshot recaptured. |

## Remaining Risk

- Review-gated candidate rows can remain tied to a staged packet if a later app-database transaction fails. They cannot become current/accepted intelligence because canonical review paths scope them to the current packet. A cleanup policy is recommended, but it does not weaken the fail-closed publication contract.
- AI Gateway remains out of credits; the live cron now has a verified direct OpenAI fallback so this provider condition no longer silently prevents the Daily Brief.
- Forced production job `job-d9fd5nf41pts73duvee0` correctly failed closed after staging packet `a1fe7411-ff5d-4e40-bff9-7a45a6a80971`; the consumer-only RAG direct-host drift is resolved by the shared connection contract and verified by successful production rerun `job-d9fd9d3tqb8s73crquo0`.

## Final Status

- [x] All required checklist items are complete after the forced production rerun.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No required work is deferred; remaining non-blocking risks and the recommended follow-up are recorded above.
