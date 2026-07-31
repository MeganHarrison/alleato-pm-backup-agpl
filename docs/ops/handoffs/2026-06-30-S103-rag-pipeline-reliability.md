# Handoff: 2026-06-30 - RAG Pipeline Reliability

## Intake Block

1) Session ID: S103
2) Task ID: `docs/ops/tasks/2026-06-30-rag-pipeline-reliability.md`
3) Linear issue: AAI-779
4) Linear URL: https://linear.app/megankharrison/issue/AAI-779/make-rag-pipeline-reliability-consistently-green
5) Current status: Complete; full RAG gate is green, provider-credit runway has a warning only.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/backend/src/services/health/ai_provider_health.py`; `/Users/meganharrison/Documents/alleato-pm/backend/tests/test_ai_provider_health.py`; `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_render_ai_gateway_health.mjs`; `/Users/meganharrison/Documents/alleato-pm/docs/ai-plan/councils/2026-06-30-rag-strategy-council-pipeline-reliability.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/plans/2026-06-30-rag-pipeline-green-plan.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-30-rag-pipeline-reliability.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-30-S103-rag-pipeline-reliability.md`.
7) Commands run and outcome (pass/fail counts): `npm run rag:verify:source-lifecycle` pass; `npm run rag:verify:meetings` pass; `npm run rag:verify:source-specific` pass; `npm run rag:verify:render-ai` pass with AI Gateway warning; `PYTHONPATH="$PWD/backend:$PWD/backend/src" backend/.venv/bin/python -m pytest backend/tests/test_ai_provider_health.py -q` pass, 5 tests.
8) Evidence artifacts (screenshot/video/report/log paths): This handoff; `docs/ai-plan/councils/2026-06-30-rag-strategy-council-pipeline-reliability.md`; `docs/ops/plans/2026-06-30-rag-pipeline-green-plan.md`.
9) Top 3 findings:
- Current ingestion/vectorization/source-specific gates are green.
- Provider runway is green with warning: AI Gateway balance is `$4.8289`, below the `$5.00` warning floor and above the `$1.00` hard floor.
- Existing backend AI provider cron did not distinguish warning runway from hard provider failure; it only probed one successful token.
10) Recommended next action (one line): Top up/configure AI Gateway autorecharge to clear the warning, but do not treat current `$4.8289` as RAG-down.
11) Handoff file path: `docs/ops/handoffs/2026-06-30-S103-rag-pipeline-reliability.md`
12) Migration ledger evidence: N/A.

## Linear Updates

- Kickoff: AAI-779 created as urgent parented work item.
- Progress: AAI-779 comment `25ffc53a-6f06-4c2d-bef2-e018c81c0b22` posted with code changes, command evidence, blocker, detection gap, prevention, and next action.
- Correction: AAI-779 comment `d01d19ca-d31f-48bc-963e-f0355b3b7944` posted with warning-vs-failure correction and full green-gate evidence.

## Current Status

The RAG pipeline is green in the current snapshot. The live provider state is a
warning, not a hard failure: AI Gateway credits are `$4.8289`, which is below
the `$5.00` warning floor and above the `$1.00` hard floor. Direct OpenAI is
also configured.

The backend provider health cron now checks the AI Gateway credit floor after a
successful one-token provider probe. Credits below the hard floor return
`status=down`, `reason=low_credits`, and a non-zero cron exit path. Credits
below the warning floor stay green with an explicit warning.

## Provider Warning Detail

Cause: AI Gateway credit balance is below the warning floor but above the hard
failure floor.

Detection gap: `scripts/verify/verify_render_ai_gateway_health.mjs` caught the
low balance, but the original hard failure threshold matched the displayed `$5`
balance too tightly. `$4.8289` was wrongly treated as blocked even though the
provider is still usable and direct OpenAI is configured.

Prevention: split provider runway into a `$5.00` warning floor and a `$1.00`
hard failure floor, and keep the backend cron credit probe so true exhaustion
still fails loudly.

Owner: Provider billing/runway for AI Gateway; code owner for
`backend/src/services/health/ai_provider_health.py`.

Next action: top up/configure AI Gateway autorecharge to clear the warning.

## Verification

| Check | Command | Result |
| ----- | ------- | ------ |
| Source lifecycle | `npm run rag:verify:source-lifecycle` | Pass |
| Meeting vectorization | `npm run rag:verify:meetings` | Pass |
| Source-specific RAG | `npm run rag:verify:source-specific` | Pass |
| Render/provider runway | `npm run rag:verify:render-ai` | Pass with warning: AI Gateway balance `$4.8289` below `$5.00` warning floor |
| Provider health regression | `PYTHONPATH="$PWD/backend:$PWD/backend/src" backend/.venv/bin/python -m pytest backend/tests/test_ai_provider_health.py -q` | Pass: 5 passed |
| Render env read-back | Render API env-var read-back for `srv-d8271ohj2pic739klb7g` | Pass: `AI_GATEWAY_MIN_CREDITS_USD=1`; `AI_GATEWAY_WARN_CREDITS_USD=5` |

Note: the same pytest command with system `python3` failed before test
collection because the host environment lacks `python-multipart`; the project
virtualenv contains the expected backend dependencies.
