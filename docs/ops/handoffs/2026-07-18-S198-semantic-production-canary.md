# Handoff: 2026-07-18 — Semantic Collection Production Canary

## Intake Block

1) Session ID: S198
2) Task ID: AAI-1174
Task file: `docs/ops/tasks/2026-07-18-semantic-production-canary.md`
3) Linear issue: AAI-1174
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1174/add-semantic-production-canary-for-exhaustive-collection-analysis
5) Current status: Accepted — exact-revision production run `29664354220` passes 2/2 with zero warnings, exhaustive 30/30 source parity, complete bounded non-reasoning synthesis, current-run artifact, independent approval, and viewable Linear screenshot evidence.
6) Files changed (absolute paths): `/tmp/aai1174-canary.DIoCZV/frontend/src/app/api/ai-assistant/chat/handler-v2.ts`; `/tmp/aai1174-canary.DIoCZV/frontend/src/lib/ai/retrieval/meeting-collection.ts`; `/tmp/aai1174-canary.DIoCZV/frontend/src/lib/ai/retrieval/collection-synthesis.ts`; `/tmp/aai1174-canary.DIoCZV/frontend/src/lib/ai/retrieval/types.ts`; `/tmp/aai1174-canary.DIoCZV/frontend/src/lib/ai/retrieval/__tests__/meeting-collection.test.ts`; `/tmp/aai1174-canary.DIoCZV/frontend/src/lib/ai/retrieval/__tests__/collection-synthesis.test.ts`; `/tmp/aai1174-canary.DIoCZV/frontend/src/lib/meetings/transcript-content.ts`; `/tmp/aai1174-canary.DIoCZV/frontend/src/lib/meetings/__tests__/transcript-content.test.ts`; `/tmp/aai1174-canary.DIoCZV/scripts/verify/verify_ai_assistant_eval_suite.mjs`; `/tmp/aai1174-canary.DIoCZV/scripts/verify/collection-audit-lib.mjs`; `/tmp/aai1174-canary.DIoCZV/scripts/verify/__tests__/collection-audit.test.mjs`; `/tmp/aai1174-canary.DIoCZV/docs/ops/evals/collection-analysis-production-canary.json`; `/tmp/aai1174-canary.DIoCZV/.github/workflows/ai-collection-production-canary.yml`; `/tmp/aai1174-canary.DIoCZV/package.json`; `/tmp/aai1174-canary.DIoCZV/docs/ops/tasks/2026-07-18-semantic-production-canary.md`; `/tmp/aai1174-canary.DIoCZV/docs/ops/handoffs/2026-07-18-S198-semantic-production-canary.md`; `/tmp/aai1174-canary.DIoCZV/docs/ops/evidence/2026-07-18-semantic-production-canary/full-typecheck-report.md`; `/tmp/aai1174-canary.DIoCZV/docs/ops/evidence/2026-07-18-semantic-production-canary/local-canary-pass.md`; `/tmp/aai1174-canary.DIoCZV/docs/ops/evidence/2026-07-18-semantic-production-canary/runtime-localization.md`; `/tmp/aai1174-canary.DIoCZV/docs/ops/orchestration/session-board.md`
7) Commands run and outcome (pass/fail counts): local canary PASS 2/2; production canaries `29663445379` and `29664010710` each FAIL 1/2 and localize progressively deeper final-synthesis boundaries; final production canary `29664354220` PASS 2/2 with zero warnings at 80,116 / 82,654 ms; collection audit Node tests PASS 6/6; collection synthesis Jest PASS 5/5; focused suite PASS 22/22 before the corrective tests; targeted ESLint PASS 0 errors; actionlint/YAML/JSON/syntax/diff checks PASS; full frontend typecheck FAIL on 248 unrelated existing errors with zero errors in task-owned retrieval/synthesis/transcript files.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-18-semantic-production-canary/runtime-localization.md`; `docs/ops/evidence/2026-07-18-semantic-production-canary/local-canary-pass.md`; `docs/ops/evidence/2026-07-18-semantic-production-canary/production-canary-run-29663445379.md`; `docs/ops/evidence/2026-07-18-semantic-production-canary/production-canary-run-29664010710.md`; `docs/ops/evidence/2026-07-18-semantic-production-canary/production-canary-pass.md`; `docs/ops/evidence/2026-07-18-semantic-production-canary/production-canary-run-29664354220.png`; `docs/ops/evidence/2026-07-18-semantic-production-canary/production-canary-artifact-29664354220.png`; successful production artifact `ai-collection-production-canary-29664354220` (`8435318622`).
9) Top 3 findings (frontend-visible issues first): semantic collection analysis fails closed on missing, invented, or uncertain candidate adjudications; the planner is the sole raw-language interpretation boundary and exact-phrase title rescues are removed; deterministic final reduction now uses a bounded non-reasoning model after two production failures localized and proved the prior reasoning-model nondeterminism.
10) Recommended next action (one line): let the Monday 11:30 UTC monitor enforce the persisted contract; investigate only if it fails loudly with a current-run artifact.
11) Handoff file path: `docs/ops/handoffs/2026-07-18-S198-semantic-production-canary.md`
12) Migration ledger evidence: N/A — no database schema change planned.

Verification manifest: `docs/ops/evidence/2026-07-18-semantic-production-canary/verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-18-semantic-production-canary/verification-result.json`

## Linear Updates

- Kickoff comment: `a7dfc796-658d-4bbc-9b43-c62301a1e12b`.
- Production localization comments: `cc53cbad-f700-46ce-b4a3-da334fe9bb0f`; `7cdb94d3-8514-445a-8342-114ec8cfe6e4`.
- Final acceptance comment with embedded screenshots: `31643ba9-1384-40ae-afbd-c02950e5fd19`.
- Screenshot attachments: `c6514e91-433c-4467-954b-52de0b724204`; `fb871f5a-c42c-477b-b150-7fff3b4b3dee`.

## Source Contracts

- Production host: `https://projects.alleatogroup.com`
- Chat endpoint: `/api/ai-assistant/chat`
- Persistence owner: `public.chat_history`
- Scheduler: GitHub Actions
- Parent failure fingerprint: `ai.collection-analysis-source-free-fallback`

## Root Cause, Detection Gap, Prevention

- Cause: the production fix is correct, but no recurring execution proves the semantic planner and exhaustive coverage contract remain live after future deploys.
- Detection gap: existing live eval infrastructure does not expose deterministic collection coverage/source equality assertions, and its default corpus is absent.
- Prevention: explicit focused suite, shared deterministic audit evaluator, weekly authenticated production execution, latency budget, and durable artifacts.

## Runtime Localization

- Observed boundary: both prompts enumerated the same 1,913 authorized meetings, and the missing record was present in both candidate sets and passed the generic compiled-query alignment check. The direct plan's literal full-phrase title rescue included it; the paraphrase relied on the batched semantic selector, which omitted it.
- Confirmed contract defect: the selector returns only a list of selected IDs. In an exhaustive request, an absent ID is therefore ambiguous between a deliberate exclusion and a model omission, yet the executor counts both as safely excluded.
- Durable repair: make every candidate ID a required key in the generated schema with an `include`, `exclude`, or `uncertain` value. Array omission/duplication is structurally impossible; missing, unexpected, or uncertain adjudications fail loudly; no subject words or synonyms are added.
- Ownership defect found by replay: the planner compiled both prompts into explicit employee-performance criteria, but the downstream selector also received the raw user phrase. That bypass let wording re-anchor classification on a short ambiguous title. The selector now consumes only the planner-owned canonical semantic criteria at deterministic temperature zero.
- Canonical ownership repair: remove deterministic exact-phrase title and phrase-family membership overrides. The semantic adjudicator owns inclusion; generic repeated-title family evidence is built before compiled alignment and keeps a semantically included family consistent. Empty transcript headings are no longer treated as complete transcripts.
- Synthesis detection gap found by replay: full 30-source retrieval could persist `collection_synthesis.status=failed` with `No output generated.` while the evaluator only checked that the object existed. The audit now requires `status=complete`; final collection reduction uses the bounded non-reasoning `openai/gpt-4.1-mini` stage and persists the exact model, execution mode, output/timeout bounds, evidence size, and extraction/final timing.

## Current Risks

- Exhaustive synthesis is expensive; run the semantic pair weekly rather than daily.
- Run `29663445379` proved that provider-default reasoning can make final reduction nondeterministically slow; the corrective policy is low reasoning, 4,096 output tokens, and a 90-second stage timeout, persisted and asserted by the canary.
- Run `29664010710` proved low reasoning can still hit the 90-second stage bound; final reduction now uses `openai/gpt-4.1-mini` in an asserted non-reasoning mode while retaining output and timeout bounds.
- Run `29664354220` passes 2/2 with zero warnings at 80,116 / 82,654 ms; the remaining operational risk is selector/model-provider latency, enforced weekly by the current-run monitor.
- GitHub Actions has all five canary-specific database, anonymous-auth, and test-user secret names; values were never printed.
- No AI SDK skill package exists in this repository; local installed AI SDK UI-message stream documentation is the fallback contract source.
