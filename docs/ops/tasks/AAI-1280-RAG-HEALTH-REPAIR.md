# Task: Repair remaining RAG source health issues

Status: In Progress
Owner: Codex S20260730-RAGHEALTH
Created: 2026-07-30
Task ID: AAI-1280-RAG-HEALTH-REPAIR
Linear Issue: Connector not invoked; this is the continuation of the user-requested active repair.
Related Handoff: `docs/ops/handoffs/2026-07-30-S20260730-RAGHEALTH-rag-health-repair.md`

## Objective

Make production RAG health describe only current executable owners, repair bounded active backlogs, and publish a complete Eve functionality and ownership catalog with live proof.

## Scope

- Source health aggregation, focused regression tests, production recompute/readback, and AI/RAG ownership documentation
- External Acumatica Generic Inquiry creation is explicitly excluded because the current provider endpoint does not expose the required data

## Source of Truth

- Canonical runtime/data owner: Eve at `agents/alleato-assistant`; durable document ordering/retry at `frontend/src/lib/rag-pipeline/process-document-workflow.ts`; source acquisition in Render services defined by `render.yaml`
- Existing shared primitives/services: `backend/src/services/health/source_sync_health.py`, `backend/src/services/integrations/microsoft_graph/`, `backend/src/services/acumatica_sync.py`
- Deprecated or parallel paths: legacy `graph_sync_state.source='teams_chat'`; deleted frontend assistant generators

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: active alert rows with exact current source/resource identities and actionable provider or backlog messages
- Detection path: authenticated `/api/health/source-sync`, targeted tests, and scoped retrieval proof
- Recovery path: run the named source owner or correct the named provider/configuration contract

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Canonical follow-up fingerprint: `rag.retired-source-health-owner-drift`
- Root cause: The health API accepted a retired Graph source identity that the standalone integration verifier already excluded.
- Detection gap: No regression test joined current executable source identities to live and snapshot health aggregation.
- Prevention: One retired-owner predicate covers both live Graph state and stored snapshots.
- Guardrail evidence: `backend/tests/test_source_sync_health.py`

The fingerprint is registered in canonical production at commit
`b0012343a7bd5b8f27eb05e5afd9df6917e4b7bf`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Council | `docs/ai-plan/councils/2026-07-30-rag-strategy-council-source-health-repair.md` | Accepted | First implementation slice selected. |
| Live localization | Authenticated `GET /api/health/source-sync` | Failed boundary identified | 77 returned critical rows use retired teams_chat; current owner is teams_chat_export. |
| Focused regression | `python -m pytest -q backend/tests/test_source_sync_health.py` | Pass in canonical production, 28 tests | Backup isolated function probes also pass; backup's full conftest has unrelated router-version drift. |
| Independent review | `C:\Users\KimiClaw\AppData\Local\Temp\AAI-1280-independent-review.md` | Approved | No findings across both health-owner repairs. |
| Live recompute | Authenticated production readback | Pass | Sources 344 to 61, alerts 289 to 5, retired Teams 77 to 0, Graph aggregate healthy at nine minutes. |
| Canonical release | Commits `7629c90f3381cac924c9730978a11cc2db60df9d`, `77909c04861c52de6964035cc40c54309973fbcb` | Pass | Render served the new behavior. |

## Remaining Risk

- SharePoint bootstrap, eligible vectorization, one Graph subscription, document
  promotion, and the Acumatica GI remain current operational work. Web-triggered
  Graph execution is correctly blocked by `BACKEND_API_ONLY`; this session has
  no Render API credential to run the owning crons directly.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
