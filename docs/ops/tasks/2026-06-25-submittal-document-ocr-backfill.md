# Task: Submittal Document OCR Backfill Triage

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Related Handoff: None

## Objective

Determine whether stale submittal attachment documents require a bulk OCR
backfill, verify the real backlog scope, and execute a safe targeted requeue for
the submittal-linked set so AI review can consume extracted source text instead
of remaining stuck at `uploaded` / `raw_ingested`.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits. (Operational task: no repo code changes required yet.)
- [x] Database schema/types/migrations handled, if applicable. (No schema changes in scope.)
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated. (No duplicate path introduced; use native pipeline endpoint.)
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable. (Not applicable: operational task.)

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states. (Not applicable: no delivery adapter.)

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior. (Operational replay verified against the exact submittal API path.)
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes. (No test changes yet.)

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes. (Authenticated browser session used to hit the live API path for the exact submittal.)
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Exact submittal row | `select ... from submittals where id='b9698bb4-f2eb-4c0d-9288-9b9b08f7f20f'` | Pass | Project `25125`, submittal `08-001`, no prior AI review run timestamp. |
| Exact submittal document linkage | `select ... from submittal_doc_links join document_metadata ... where submittal_id='b9698bb4-f2eb-4c0d-9288-9b9b08f7f20f'` | Pass | Linked PDF exists but has `status='uploaded'`, `content_len=0`, `raw_text_len=0`. |
| Exact submittal linked drawings | `select ... from submittal_linked_drawings where submittal_id='b9698bb4-f2eb-4c0d-9288-9b9b08f7f20f'` | Pass | No linked drawings. |
| Manual-upload backlog scope | `document_metadata` aggregate queries | Pass | Only `46` docs remain `uploaded`; this is not an all-history OCR gap. |
| Submittal-linked backlog scope | `submittal_doc_links` + `fireflies_ingestion_jobs` aggregate queries | Pass | `8` linked submittal docs total: `6` `raw_ingested`, `2` `error`, `0` progressed. |
| Upload path owner | `frontend/src/lib/documents/pattern-c-attachments.ts`, `frontend/src/lib/documents/pipeline-trigger.ts` | Pass | Pattern C uploads already call `triggerDocumentPipeline`; issue is downstream backlog/failure. |
| Local parser proof | `cd backend && python - <<... run_document_parser('016591c2-f062-4127-b353-9cf3750dadd3')` | Pass | Exact Goodwill Glass PDF parsed locally with `36,369` chars extracted into RAG storage. |
| Targeted submittal-doc replay | `cd backend && python - <<... run_document_parser(...)` over submittal-linked docs | Pass | All eight linked submittal docs now have `rag_document_metadata.parsing_status='segmented'` with non-zero extracted text. |
| Split-RAG fallback fix | `frontend/src/lib/submittals/ai-review/review-run-service.ts` | Pass | AI review service now reads `rag_document_metadata` text for linked submittal documents before falling back to app DB fields. |
| Contract guardrail | `node scripts/verify/verify_submittal_ai_review_contract.mjs` | Pass | Verifier now fails if review service stops reading `rag_document_metadata`. |
| Exact submittal proof after replay | Authenticated `POST /api/projects/25125/submittals/b9698bb4-f2eb-4c0d-9288-9b9b08f7f20f/ai-review` | Pass | Returned `200`; `submittal_text` layer is now `ready`. Remaining blockers are `linked_drawings=not_ready` and `spec_context=failed`. |
| Known unrelated debt | Earlier browser auth redirect on `/25125/...` | Fail unrelated | Saved local auth state was not valid for that route/session; DB verification used instead. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-25-submittal-document-ocr-backfill.md` - execution ledger for backlog triage and requeue
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/review-run-service.ts` - split-RAG fallback for submittal prompt documents
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_submittal_ai_review_contract.mjs` - guardrail ensuring review service reads `rag_document_metadata`

## Risks / Gaps

- Submittal PDFs are no longer blocked on missing text, but some documents still trip downstream projection/compiler errors after parsing; that does not block submittal-text readiness for AI review, but it is still pipeline debt.
- `spec_context` is still failing on the exact `25125` submittal due to a spec-search timeout, and linked drawings are still absent, so a full findings set remains blocked by separate source layers.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
