# Task: Remove Outlook Legacy Mirroring Gates

Status: Completed
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-709 - https://linear.app/megankharrison/issue/AAI-709/remove-outlook-legacy-mirroring-gates
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Delete disabled Outlook ingestion-side legacy mirroring gates after proving the
production Outlook path is raw intake plus canonical RAG enrichment, not
optional Graph sync writes into legacy `project_emails`, legacy
`email_attachments`, or legacy email-link document side paths.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared services/helpers identified before removing code.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Proof Checklist

- [x] Prove canonical Outlook raw intake/RAG owner before deletion.
- [x] Prove legacy env gates and write paths before deletion.
- [x] Prove frontend `project_emails` and `email_attachments` readers are outside this deletion slice.
- [x] Record deletion candidates in evidence before removal.
- [x] Delete only candidates with active-path proof.
- [x] Record retained Outlook paths and why they remain.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Legacy Outlook mirroring env gates removed.
- [x] Legacy project email mirroring write path removed from Graph sync.
- [x] Legacy project attachment mirroring write path removed from Graph sync.
- [x] Legacy link extraction/write path removed from Graph sync.
- [x] Current docs/verifiers no longer point at deleted env gates as active candidates.
- [x] Errors are specific and actionable; no silent fallback added.

## Integration Checklist

- [x] Canonical Outlook raw intake remains the only new-email capture owner.
- [x] Canonical Outlook intake attachments remain operational.
- [x] RAG `document_metadata` and `rag_document_metadata` email rows still compile through the same path.
- [x] Project assignment/vectorization status projection remains intact.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract/docs guardrail updated for public/current architecture.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted backend tests run.
- [x] Backend compile check run.
- [x] Relevant Outlook/Graph/RAG verifier run.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Candidate inventory | docs/ops/evidence/2026-06-25-ai-rag-production-finalization/outlook-legacy-mirroring-removal-aai-709.md | Pass | Deletion candidates, retained frontend readers, and current production owner recorded before code edits. |
| Current reference scan | `rg -n "OUTLOOK_SYNC_LEGACY..." backend/src frontend/src scripts/verify package.json render.yaml docs/...` | Pass | Legacy env gates are only in `backend/src/services/integrations/microsoft_graph/outlook.py` plus finalization docs/evidence. |
| Prior provider proof | docs/tasks/2026-06-23-global-emails-freshness-investigation.md | Pass | `OUTLOOK_SYNC_LEGACY_PROJECT_EMAILS` was not set on checked services; newer intake rows lacked `project_email_id`. |
| Deleted symbol scan | delegated sub-agent: `rg -n "OUTLOOK_SYNC_LEGACY_ATTACHMENTS\|OUTLOOK_SYNC_LEGACY_LINKS\|OUTLOOK_SYNC_LEGACY_PROJECT_EMAILS\|..." backend/src/services/integrations/microsoft_graph/outlook.py backend/tests/test_outlook_intake.py` | Pass | Zero matches for removed gates/helpers/legacy ID contracts. |
| Backend compile | delegated sub-agent: `backend/.venv/bin/python -m py_compile backend/src/services/integrations/microsoft_graph/outlook.py backend/tests/test_outlook_intake.py` | Pass | Syntax/import check passed. |
| Focused backend tests | delegated sub-agent: `backend/.venv/bin/python -m pytest backend/tests/test_outlook_intake.py -q` | Pass | 20 passed; non-fatal warnings only. |
| Outlook/RAG source contract | service/test symbol scan plus updated `AI-RAG-ARCHITECTURE.md` | Pass | Current source has one Outlook ingestion owner: intake plus canonical RAG enrichment. |
| Unrelated failures | delegated sub-agent report | Pass | No failures. Non-fatal pytest warnings from requests, FastAPI `on_event`, and `datetime.utcnow()` deprecations only. |

## Files To Change

- `backend/src/services/integrations/microsoft_graph/outlook.py`
- `backend/tests/test_outlook_intake.py`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-candidate-inventory-aai-705.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/outlook-legacy-mirroring-removal-aai-709.md`

## Risks / Gaps

- `project_emails` and `email_attachments` still have frontend readers. This
  slice removes disabled Graph sync mirroring only; table/read-route migration
  belongs to a separate frontend/API migration slice with browser evidence.
- The checkout contains unrelated dirty frontend files; this slice must stage
  and publish only AAI-709-owned files.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
