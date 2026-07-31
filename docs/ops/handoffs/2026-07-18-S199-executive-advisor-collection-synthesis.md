# Handoff: 2026-07-18 — Executive-Advisor Collection Synthesis

## Intake Block

1) Session ID: S199
2) Task ID: AAI-1182
3) Linear issue: AAI-1182
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1182/replace-robotic-collection-summaries-with-an-executive-advisor
5) Current status: Blocked/Deferred — provider billing credit required for final production proof
6) Files changed (absolute paths): `/private/tmp/aai1182-final/frontend/src/lib/ai/retrieval/collection-planner.ts`; `/private/tmp/aai1182-final/frontend/src/lib/ai/retrieval/meeting-collection.ts`; `/private/tmp/aai1182-final/frontend/src/lib/ai/retrieval/collection-synthesis.ts`; `/private/tmp/aai1182-final/frontend/src/app/api/ai-assistant/chat/handler-v2.ts`; focused tests; collection canary/audit; task, handoff, evidence, learning, feedback, and orchestration artifacts.
7) Commands run and outcome (pass/fail counts): PASS 7 focused Jest suites / 85 tests; PASS collection audit 10/10; PASS targeted ESLint; PASS `pnpm run typecheck:changed`; PASS feedback-ledger validation; PASS learning-registry audit; FAIL full TypeScript check on 248 unrelated existing errors with zero task-owned diagnostics; production canaries listed below.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-18-executive-advisor-collection-synthesis/`; clean v11 screenshot `production-executive-advisor-v11.png`; exact-v12 provider failures in `canary-29747218168/` and `canary-29747777926/`.
9) Top findings: vocabulary gating was the first retrieval defect; cohort context required isolated inclusion verification; raw prompt wording and a trapped single-draft correction loop caused advisor instability; the exact v12 proof is now blocked before retrieval by provider billing on both configured paths.
10) Recommended next action (one line): authorize a Vercel AI Gateway credit purchase, redeploy `39fd46203fb7d0f85ce327e4d29c517773f4388c`, rerun both canary prompts, recapture the v12 screenshot/trace, and invoke a new clean-context reviewer.
11) Handoff file path: `docs/ops/handoffs/2026-07-18-S199-executive-advisor-collection-synthesis.md`
12) Migration ledger evidence: N/A — no database schema change.

## Linear Updates

- Kickoff comment: `35048dd0-016c-4788-b221-ad45f581d175`
- Milestone comment: `d02d89b8-0391-4a04-b0a1-49c2b9f318a4`
- Provider blocker comment: `491d1527-b135-401d-a5e7-f04c7128eb37`
- Completion comment: Pending final production approval.

## Production Evidence

- `29743080777`: identical 31-source fingerprint; one v10 prompt passed and the exact terse prompt failed voice 4/5.
- `29744367670`: both v11 cases aborted at 280 seconds; control trace localized the execution-budget defect.
- `29745945203`: both cases finished under 240 seconds, exhaustively adjudicated 1,915 live records, selected the identical 31-source fingerprint, then failed the strict advisor gate after four serial rewrites.
- `29747218168`: exact v12 run blocked before retrieval by zero Vercel AI Gateway credits.
- `29747777926`: exact v12 direct-provider fallback blocked before retrieval by OpenAI `429 insufficient_quota`.
- Primary production provider configuration was restored to `AI_PROVIDER_PATH=vercel_gateway` after the fallback check.

## Cause, Detection Gap, Prevention

- Cause: collection membership and final counsel lacked durable typed ownership; subsequent strict judging revised one local draft repeatedly; final v12 validation is externally blocked by exhausted provider billing.
- Detection gap: the original quality score measured source activity instead of decision usefulness, no parity canary compared semantic paraphrases, and provider credit exhaustion surfaced only when the final exact run began.
- Prevention: typed vocabulary-free enumeration, independent inclusion verification, evidence-constrained retries, canonical advisor objectives, parallel best-candidate judging with unchanged thresholds, exact-production parity/latency canaries, persisted trace identity, and explicit provider-path readback.

## Current Blocker

The Vercel CLI supports `vercel buy credits gateway <amount>`, but purchasing credits is a financial action and was not executed without explicit authorization. Both available provider paths have been proven unavailable for completions. The task remains open and must not be described as complete.
