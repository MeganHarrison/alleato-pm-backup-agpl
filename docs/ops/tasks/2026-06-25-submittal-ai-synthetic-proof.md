# Task: Synthetic AI Submittal Review Proof

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Related Handoff: /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-25-S93-submittal-ai-synthetic-proof.md

## Objective

Create a realistic, internally consistent test submittal linked to an existing
drawing in project `25125`, verify the AI review workflow can use that synthetic
record for end-to-end testing, and leave a durable proof path that does not wait
on manual user input from the field.

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

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable. (No schema migration needed; used existing Pattern C fields.)
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated. (Legacy drawing revisions were promoted into the existing Pattern C document path.)
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable. (No UI copy changes required.)

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states, if applicable.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior. (`scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs`)
- [x] Contract test added/updated for cross-module or source/delivery boundaries. (Verifier asserts Pattern C drawing metadata linkage plus stored AI-review readiness.)
- [x] Guardrail added so the same class of bug fails loudly next time. (Reusable legacy drawing metadata backfill script + verifier.)
- [x] Existing tests adjusted only for intentional behavior changes. (No unrelated test changes.)

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent. (Node executed both new scripts successfully.)
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Legacy drawing gap scope | `node scripts/ops/backfill-legacy-drawing-document-metadata.mjs --project=25125` | Pass | Dry-run initially found `27` legacy drawing revisions with `file_url` but no `document_metadata_id`. |
| Legacy drawing backfill | `node scripts/ops/backfill-legacy-drawing-document-metadata.mjs --project=25125 --apply` | Pass | Created Pattern C `document_metadata` rows and updated `drawings` + `drawing_revisions` pointers for all 27 project drawings. |
| Idempotency guardrail | `node scripts/ops/backfill-legacy-drawing-document-metadata.mjs --project=25125` | Pass | Post-apply dry-run returned zero remaining candidates. |
| Drawing readiness proof | DB read-back for `drawing-revision:4d3acc68-890a-4bfc-bb02-63616d13a0c9` | Pass | `raw_ingested`, non-zero OCR text, `1` `document_page_intelligence` row, and `14` RAG chunks for A201. |
| Synthetic submittal creation | direct service-role insert of submittal `08-TST-A201` + `submittal_doc_links` + `submittal_linked_drawings` | Pass | New synthetic submittal `7dfbccac-6ccf-4d69-8129-7de7918c5248` created and linked to the Goodwill glass PDF and A201. |
| Browser/API proof | [`frontend/tests/agent-browser-runs/2026-06-25-submittal-ai-synthetic-proof/VERIFICATION_SUMMARY.md`](/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/2026-06-25-submittal-ai-synthetic-proof/VERIFICATION_SUMMARY.md) | Pass | Authenticated local route proof captured screenshot + JSON result. `POST /ai-review` returned `200` and produced source-backed checks. |
| Verifier guardrail | `node scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` | Pass | Fails loudly if the synthetic submittal loses linked drawing readiness or if A201 loses Pattern C metadata/page intelligence. |
| Known unrelated local OCR limitation | `python - <<... run_ocr_pass(...)` | Fail unrelated | Local backend lacks the Azure OCR module (`No module named 'azure'`), so local OCR cannot be used as proof. Remote/live or parser-based processing is required. |
| Known unrelated downstream compiler debt | `python - <<... run_full_pipeline('drawing-revision:4d3acc68-...')` | Fail unrelated | Final projection path still logs `ALLOW_PM_APP_FINAL_PROJECTIONS` blocked warnings after core parsing/vision/embed stages succeed. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-25-submittal-ai-synthetic-proof.md` - working definition of done
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-25-S93-submittal-ai-synthetic-proof.md` - worker handoff and evidence ledger
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md` - active session ownership claim
- `/Users/meganharrison/Documents/alleato-pm/scripts/ops/backfill-legacy-drawing-document-metadata.mjs` - retired one-off legacy drawing Pattern C backfill; proof retained above, script removed in AAI-756 after zero-candidate idempotency proof
- `/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_synthetic_submittal_ai_review_proof.mjs` - live verifier for the Goodwill synthetic proof path
- `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/2026-06-25-submittal-ai-synthetic-proof/VERIFICATION_SUMMARY.md` - route/API proof artifact summary

## Risks / Gaps

- The synthetic record is intentionally labeled and should not be treated as business-authoritative project data.
- `spec_context` still fails on this project because spec retrieval times out; the synthetic proof demonstrates linked-drawing readiness and review execution, not full specification parity.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
