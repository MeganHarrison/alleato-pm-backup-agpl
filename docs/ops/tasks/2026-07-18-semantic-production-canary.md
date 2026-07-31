# Task: Semantic Production Canary for Collection Analysis

Status: Complete
Owner: Codex
Created: 2026-07-18
Task ID: AAI-1174
Linear Issue: AAI-1174 — https://linear.app/megankharrison/issue/AAI-1174/add-semantic-production-canary-for-exhaustive-collection-analysis
Related Handoff: `docs/ops/handoffs/2026-07-18-S198-semantic-production-canary.md`

## Objective

Run a scheduled authenticated production canary that submits semantic collection-analysis variants and fails from persisted coverage, source, or latency evidence instead of response prose or keyword rules.

## Scope

- Extend `scripts/verify/verify_ai_assistant_eval_suite.mjs` to accept an explicit focused suite and expose persisted source records to deterministic scoring.
- Add a shared collection-audit evaluator using the existing flat `scripts/verify/*-lib.mjs` convention with focused Node tests.
- Add the tracked focused suite under `docs/ops/evals/` and one canonical package command.
- Add a scheduled/manual GitHub Actions workflow that targets `https://projects.alleatogroup.com` with configured secrets and publishes machine-readable artifacts.
- Repair the semantic selector contract revealed by the canary: exhaustive selection must return one explicit include/exclude/uncertain adjudication for every discovered candidate instead of treating an omitted ID as an implicit exclusion.
- Enforce the planner as the single raw-language interpretation boundary; downstream selection consumes only its canonical semantic criteria, and collection synthesis uses a dedicated bounded model stage with persisted timing.
- Record task and handoff evidence under `docs/ops/`.
- Explicit exclusion: no subject-specific synonym lists, phrase branches, database schema, or user-facing UI changes. Synthesis scope is limited to the generic execution-policy defect proven by the production canary; no subject-specific synthesis instructions are added.
- Explicit exclusion: do not reconstruct or silently replace the missing legacy full-suite corpus; the focused suite must be selected explicitly.

## Source of Truth

- Canonical runtime/data owner: production `/api/ai-assistant/chat` plus persisted `public.chat_history.metadata` and `sources`.
- Existing shared primitives/services: `scripts/verify/verify_ai_assistant_eval_suite.mjs`, Supabase auth refresh, AI SDK UI-message SSE protocol, GitHub Actions scheduling and artifact upload.
- Deprecated or parallel paths: Vercel Cron is not used because the existing verifier already owns authenticated chat execution and DB readback; the missing default eval-suite JSON remains separate repository debt and must fail loudly.

Verification contract: Required

## Acceptance Criteria

- [x] Scheduled and manual execution use the canonical production chat endpoint and configured test-user authentication.
- [x] At least two semantically equivalent prompt variants run without phrase-specific evaluator assertions.
- [x] Persisted audit requires `collection_coverage.exhaustive === true`, `failed === 0`, `retrieved === matched`, `matched >= 1`, and canonical source count equal to retrieved count.
- [x] Persisted architecture and provider path prove `retrieval-planner-v2` / `semantic-collection-analysis` ownership.
- [x] Every discovered candidate has an explicit semantic adjudication; missing or uncertain decisions fail the exhaustive request instead of silently shrinking the corpus.
- [x] Raw user wording is interpreted once by the collection planner and is not reintroduced into downstream candidate classification.
- [x] A privacy-safe canonical-source fingerprint is identical across the semantic variants.
- [x] Persisted `collection_synthesis.status` is `complete`; a retrieved collection with failed/no-output synthesis fails the canary.
- [x] Latency warning and hard-failure budgets are explicit; exceeding the maximum makes the workflow fail.
- [x] A compact machine-readable artifact records session ID, assistant row ID, coverage audit, source audit, duration, and exact failures without transcript content.
- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Planned task-owned files:

- `scripts/verify/verify_ai_assistant_eval_suite.mjs`
- `scripts/verify/collection-audit-lib.mjs`
- `scripts/verify/__tests__/collection-audit.test.mjs`
- `frontend/src/lib/ai/retrieval/meeting-collection.ts`
- `frontend/src/lib/ai/retrieval/types.ts`
- `frontend/src/lib/ai/retrieval/collection-synthesis.ts`
- `frontend/src/lib/ai/retrieval/__tests__/meeting-collection.test.ts`
- `frontend/src/lib/ai/retrieval/__tests__/collection-synthesis.test.ts`
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/lib/meetings/transcript-content.ts`
- `frontend/src/lib/meetings/__tests__/transcript-content.test.ts`
- `docs/ops/evals/collection-analysis-production-canary.json`
- `.github/workflows/ai-collection-production-canary.yml`
- `package.json`
- `docs/ops/tasks/2026-07-18-semantic-production-canary.md`
- `docs/ops/handoffs/2026-07-18-S198-semantic-production-canary.md`
- task evidence under `docs/ops/evidence/2026-07-18-semantic-production-canary/`
- `docs/ops/orchestration/session-board.md`
- `docs/ops/orchestration/review-queue.md`

## Integration and Verification

- [x] Deterministic passing and failing evaluator fixtures pass.
- [x] Targeted syntax, JSON, and workflow checks pass.
- [x] Actual production suite readback proves both semantic variants.
- [x] Scheduled workflow is dispatched and its status/artifacts are read back.
- [x] Evidence artifacts are recorded and linked from Linear.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: non-zero verifier exit with explicit invariant, auth, HTTP, persistence, source, or latency failure text.
- Detection path: GitHub Actions job status, step summary, uploaded `results.json`/`summary.md`, and Linear verification comment.
- Recovery path: inspect the failed case's session ID and persisted assistant row, localize the first failing boundary, then fix the owning runtime rather than adding prompt phrases.

## Incident Learning

- Failure fingerprint: `ai.collection-analysis-source-free-fallback`
- Root cause: AAI-1166 established that phrase-oriented routing could produce an unaudited source-free answer.
- Detection gap: no recurring production execution asserted the persisted exhaustive-coverage and canonical-source invariants.
- Prevention: scheduled semantic variants scored from persisted collection coverage, provider ownership, canonical sources, bounded synthesis policy, and latency.
- Guardrail evidence: focused tests; failure-localization runs `29663445379` and `29664010710`; successful exact-revision production run `29664354220`; redacted artifact `8435318622`; and viewable Linear screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1174 | Pass | Scope and done gate captured before implementation. |
| Observed output shape | Production session `33785cb8-d18c-48c6-9893-059b7d702f74` | Pass | 1,913 enumerated; 31 matched/retrieved; 0 failed; exhaustive true; 31 canonical sources. |
| Reuse audit | Existing eval runner and missing default suite lookup | Pass | Reuse runner through explicit `--suite`; do not create a parallel chat client. |
| Selector localization | `runtime-localization.md` | Pass | Raw wording bypass, batch-decision ambiguity, false source, and empty-transcript boundary localized from persisted sessions. |
| Focused tests | Node audit 5/5; Jest 22/22; targeted ESLint | Pass | Covers audit pass/fail/parity, required adjudication, raw-prompt isolation, family consistency, synthesis gating, empty transcript headings, and failed-selector adjudication telemetry. |
| Local canary | `local-canary-pass.md` | Pass | Both semantic variants resolve the same 30 canonical sources with complete synthesis inside 240 seconds. |
| Full frontend typecheck | `full-typecheck-report.md` | Unrelated fail | 248 existing errors; zero in task-owned retrieval/synthesis/transcript files, and nine old `handler-v2.ts` sites outside this patch. |
| GitHub secret readback | `gh secret list --repo The-Alleato-Group/project-management` | Pass | All five required `AI_EVAL_*` names exist; no values were printed. |
| First production workflow | `production-canary-run-29663445379.md` | Expected guardrail fail | Both variants proved 30/30 source parity and complete persisted synthesis; the direct case exposed a 230,815 ms final synthesis call caused by inherited medium reasoning and missing model-execution bounds. |
| Bounded synthesis production workflow | `production-canary-run-29664010710.md` | Expected guardrail fail | The direct case completed in 88,978 ms; the semantic case failed cleanly at the 90-second final-stage timeout, proving a bounded reasoning model was still nondeterministic. |
| Non-reasoning synthesis regression | Collection synthesis Jest 5/5; collection audit Node tests 6/6; targeted ESLint | Pass | Final reduction now uses the established `openai/gpt-4.1-mini` non-reasoning model, retains 4,096 output/90-second bounds, and persists model/mode for canary enforcement. |
| Final production workflow | `production-canary-pass.md`; run `29664354220`; artifact `8435318622` | Pass | 2/2, zero warnings, 80,116 / 82,654 ms, 30/30 canonical source parity, complete bounded non-reasoning synthesis, exact `cb3641ffd` revision. |
| Screenshot completion gate | `production-canary-run-29664354220.png`; `production-canary-artifact-29664354220.png`; Linear attachments `c6514e91-433c-4467-954b-52de0b724204` and `fb871f5a-c42c-477b-b150-7fff3b4b3dee` | Pass | Authenticated canonical GitHub run/artifact APIs show the exact successful run, head SHA, artifact identity, and matching revision. |
| Independent review | `independent-review.md` | Pass | Initial review plus both corrective deltas approved with no blocking finding. |
| Verification contract | `verification-manifest.json` + `verification-result.json` | Pass | All required claims bind to screenshots, action logs, focused regressions, and independent approval. |

## Remaining Risk

- Each exhaustive canary consumes substantial model context and one semantic decision call per candidate. The weekly schedule limits spend; the 120-second warning, 240-second hard budget, 90-second final-stage abort, and current-run artifact sentinel make latency or provider regression fail loudly.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action. (N/A — no required work deferred.)
