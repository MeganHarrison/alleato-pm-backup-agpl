# Task: Submittal AI Review Validation

Status: In Progress
Owner: Codex
Created: 2026-07-10
Linear Issue: AAI-1052 - https://linear.app/megankharrison/issue/AAI-1052/validate-and-deploy-submittal-ai-review-pipeline-repair

## Objective

Explain the current submittal AI reviewer in product terms, validate the OCR,
vision, linked-drawing, and review-readiness pipeline against the live repo and
available app data, repair any concrete blockers preventing reliable end-to-end
testing on real submittals, add a repeatable verifier that can choose
representative real submittals automatically, and deploy the backend repair to
Render with live read-back proof.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.
- [ ] Representative real-submittal sampling rule defined for repeatable verification.

## Implementation Checklist

- [x] Files/modules to change listed before edits. (`backend/src/services/pipeline/embedder.py`, `backend/tests/test_document_low_content_pipeline.py`, `scripts/verify/*`)
- [x] Database schema/types/migrations handled, if applicable. (Verification-only unless a defect requires repair.)
- [x] Provider/env/config changes handled through CLI/API/MCP when available. (Verification-first.)
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable. (No UI changes planned.)
- [ ] Repeatable verification entrypoint added for future real-submittal audits.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states, if applicable.
- [ ] Render deploy/read-back path verified against the live backend service.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior, or existing guardrail verifier rerun.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time, if a defect is found. (Existing coverage audit exposed the real-data text gap without code changes.)
- [x] Existing tests adjusted only for intentional behavior changes.
- [ ] Repeatable verifier covers both coverage-only and review-run proof paths.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent. (Targeted verifier scripts run; no code changes to lint.)
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.
- [ ] Render deploy completed and live backend read back.
- [ ] Representative real-submittal sample rerun with the repeatable verifier.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Architecture baseline | `docs/architecture/submittals-ai-review.md` | Pass | Confirms linked-drawings + AI-review split and shared service owner. |
| Contract verifier | `node scripts/verify/verify_submittal_ai_review_contract.mjs` | Pass | Shared route/service/schema contract still holds. |
| Synthetic proof verifier | `set -a; source .env; set +a; node scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | Pass | Synthetic Goodwill proof still returns `ready` with stored finish-conflict finding. |
| Goodwill text coverage audit | `set -a; source .env; set +a; node scripts/verify/verify_submittal_document_text_coverage.mjs --project-id 25125 --json --limit 500` | Pass | `4/4` linked documents searchable; no missing metadata. |
| Exol real-submittal text coverage audit (before repair) | `set -a; source .env; set +a; node scripts/verify/verify_submittal_document_text_coverage.mjs --submittal-id e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4 --json` | Partial | `1/3` submittal documents searchable; two Job Planner PDFs have zero searchable text despite `complete` / `embedded` status. |
| Root-cause trace | `backend/src/services/pipeline/document_parser.py`, `backend/src/services/pipeline/embedder.py`, `frontend/src/lib/submittals/ai-review/review-run-service.ts` | Pass | Parser writes `rag_document_metadata.content/raw_text`; embedder final upsert was repopulating those fields from empty app-table fields, which erased canonical text before the reviewer read it. |
| Focused backend regression test | `pytest backend/tests/test_document_low_content_pipeline.py -q` | Pass | New regression covers app-empty/RAG-present documents so the embedder cannot drop parser text on final upsert again. |
| Python syntax check | `python -m py_compile backend/src/services/pipeline/embedder.py backend/tests/test_document_low_content_pipeline.py` | Pass | Confirms the narrow backend repair is syntactically valid. |
| Live document repair | `set -a; source .env; set +a; PYTHONPATH=backend python - <<'PY' ... run_full_pipeline(metadata_id) ... PY` for `477bd674-63d8-4d9c-9350-34643566a1ec` and `0d050136-7493-4f6c-80be-0114b86ffbab` | Pass | Reparsed and re-embedded the two affected Exol PDFs with the fixed local pipeline code; both now have `rag_document_metadata.content/raw_text` length `8744`. |
| Exol real-submittal text coverage audit (after repair) | `set -a; source .env; set +a; node scripts/verify/verify_submittal_document_text_coverage.mjs --submittal-id e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4 --json` | Pass | `3/3` linked submittal documents searchable, zero missing text, zero missing metadata. |
| Canonical review service rerun | `cd frontend && ../node_modules/.bin/tsx --tsconfig tsconfig.json <<'TS' ... createSubmittalAIReviewService(...).runReview(876, 'e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4') ... TS` | Pass | Returned `status='ready'` with readiness `submittal_text=3/3`, drawings/OCR/vision/retrieval=`7/7 ready`, and stored source-backed pass/warning checks. |
| Stored review read-back | direct Supabase read-back of `submittals.ai_review_result`, `submittals.ai_review_ran_at`, and latest `submittal_ai_review_runs` row | Pass | Latest stored run `8c933738-5b13-4c05-a7ad-c35756f80d63` completed at `2026-07-10T19:23:11.06+00:00` with stored `status='ready'` and readiness summary `All review source layers are ready.` |
| Exol drawing readiness read-back | direct Supabase + RAG read-back for submittal `e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4` | Pass | All `7/7` linked drawings have OCR text, page intelligence, and document chunks. |
| Live GET API proof | browser-session `fetch('/api/projects/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4/ai-review')` | Pass | Returned `200` with `null` before first run, confirming no cached result yet. |
| Live POST API proof | browser-session `fetch('/api/projects/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4/ai-review', { method: 'POST' ... })` | Pass | Returned `200` with structured review result: `status='partial'`, `submittal_text=1/3`, drawings/OCR/vision/retrieval=`7/7 ready`, `spec_context=3/3`, and source-backed checks. |
| Browser route proof | `agent-browser --session submittal-ai-review ... /876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4` | Pass | Authenticated submittal detail page loaded, AI Review tab rendered, and after API run the panel showed `Re-run Review` plus reviewer-disposition controls. |
| Browser artifact | `/tmp/submittal-ai-review-exol.png` | Pass | Screenshot captured from the live local session after loading the Exol submittal AI Review surface. |
| Known tooling issue | `agent-browser auth login alleato-test-3001` | Fail unrelated | Saved-auth helper hit `ERR_ABORTED` / redirect timing issues; manual login within session succeeded. |
| Known local auth UX issue | local login redirect on `localhost:3001/auth/login` | Fail unrelated | Authenticated successfully, but the post-login redirect sometimes timed out and landed on the project shell instead of the deep-linked submittal route. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/backend/src/services/pipeline/embedder.py` - preserve parser-hydrated RAG metadata text/summary on final embedder upsert
- `/Users/meganharrison/Documents/alleato-pm/backend/tests/test_document_low_content_pipeline.py` - regression coverage for app-empty/RAG-present document text
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-10-submittal-ai-review-validation.md` - updated task status and root-cause evidence

## Risks / Gaps

- Real review quality still depends on all source layers being present for the same submittal. Imported rows can look healthy at the record level while still lacking searchable submittal-document text.
- The Exol real proof exposed a concrete pipeline bug: two Job Planner submittal attachments were parsed into chunks, but canonical RAG metadata text was dropped during embedder finalization, degrading the review from a likely specific compliance check into general human-review warnings.
- The live data repair used local pipeline execution against production-backed Supabase data for the two affected documents; the backend deployment still needs the code fix published so future reprocesses and new imports do not regress.
- Prior synthetic proof remains valuable for regression, but it does not prove that newly imported Job Planner submittal attachments are text-usable.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
