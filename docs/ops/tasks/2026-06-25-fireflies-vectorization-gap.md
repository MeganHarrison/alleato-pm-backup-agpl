# Fireflies Vectorization Gap

Date: 2026-06-25
Session: S91
Linear: AAI-640
Parent: AAI-636
Status: Partial - Recent Vectorization Recovered; Historical Backlog Remains

## Objective

Recover the Fireflies recent-meeting vectorization gap without creating a parallel pipeline or hiding failures. Fireflies ingestion must reach terminal vectorized state when parsing, embeddings, and task extraction succeed, while optional PM app insight-card projection failures remain visible and actionable.

## Scope

- Fireflies backlog root-cause analysis.
- Recent meeting vectorization verifier failure.
- Canonical Fireflies/full document pipeline behavior.
- Tests that prevent optional final projection failures from blocking embedding completion.
- Evidence updates in the production-finalization audit handoff.

## Done Checklist

- [x] Record live Fireflies backlog and recent missing-meeting evidence.
- [x] Identify root cause before editing implementation code.
- [x] Patch the canonical implementation only.
- [x] Add a regression guardrail.
- [x] Run targeted tests for the changed behavior.
- [x] Re-run the meeting vectorization verifier or record why it remains blocked.
- [x] Update audit task and handoff with evidence.
- [x] Update Linear with evidence.

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-error-analysis.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-reprocess-recent-missing.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-reprocess-final-missing.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/meetings-after-fireflies-final-fix.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-fireflies-fix.json`

Commands:

- `cd backend && .venv/bin/python -m pytest tests/test_meeting_signal_promotion.py tests/test_pipeline_orchestrator.py -q` - PASS, 13 passed.
- `npm run rag:verify:meetings` - PASS after repair, 75/75 recent eligible meetings with embedded chunks.
- `npm run rag:verify:source-lifecycle` - FAIL remains: Fireflies project assignment, Teams project assignment, Outlook project assignment, and generated task project assignment are below threshold.
- Linear update posted to AAI-640: `e4d240aa-a43f-47f8-810e-7d7b50c70703`.
- Commit pushed to `origin/main`: `300eb7bd1beb261b32cb10e07fb847900d5a25ef`.
- Render `alleato-backend` deploy `dep-d8uokcl7vvec73eifqog` reached `live` at `2026-06-25T20:07:40.304826Z`.
- Linear deployment update posted to AAI-640: `9920fdb1-cf21-42e3-accd-86c8237ca86d`.

## Blockers

### Historical Fireflies Error Backlog

- Current state after recent repair: `13225` Fireflies ingestion jobs remain in `error`.
- Root cause of dominant group: `12211` jobs were manually paused to stop DB overload on 2026-05-13 and require deliberate classification/drain, not blind retry.
- Detection gap: meeting coverage can pass while historical error volume still pollutes job health.
- Prevention step: add a bounded backlog-drain plan that separates manually paused, transient, non-vectorizable, and provider/auth failures before resetting any historical rows.

### Structured Extraction Provider Contract

- During live reprocessing, `gpt-5.4-mini`, `gpt-5.5`, and `gpt-5.4` repeatedly rejected `response_format=json_object`; fallback paths continued but some structured extraction returned non-JSON.
- Detection gap: meeting vector embeddings can pass while extracted tasks/insights quality degrades.
- Prevention step: move JSON-mode compatibility into a provider/model capability contract and add an extraction verifier that fails on non-JSON fallback rates above threshold.

## Failure-Loud Guardrail

This task fails loudly if Fireflies ingestion can silently skip embeddings, if PM app projection failures disappear from logs/results, or if the fix introduces a second Fireflies processing path instead of repairing the canonical pipeline.
