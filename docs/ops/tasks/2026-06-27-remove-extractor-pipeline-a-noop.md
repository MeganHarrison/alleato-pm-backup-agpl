# Task: Remove Extractor Pipeline A No-Op Writer

Status: Completed
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-755 - https://linear.app/megankharrison/issue/AAI-755/remove-remaining-pipeline-a-extractor-no-op-writer
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Remove the remaining deprecated Pipeline A no-op writer from the active
meeting extractor and correct stale docs that still described Stage 3 as
writing the retired legacy insights-table output. The final production path is Pipeline B:
tasks plus source signal candidates promoted into packet-first `insight_cards`.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementation reviewed.
- [x] Existing shared services/helpers identified before removing code.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed path identified.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Proof Checklist

- [x] Prove current import/reference surface before deletion.
- [x] Prove route/API reachability before deletion.
- [x] Prove provider schedule/cron/job ownership before deletion.
- [x] Prove database-write ownership before deletion.
- [x] Delete only candidates with active-path proof.
- [x] Record retained replacement paths before deletion.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Deprecated `_upsert_insight` no-op removed from the extractor.
- [x] Stale extractor docstring updated to the final Pipeline B write path.
- [x] Stale orchestrator Stage 3 description updated to the final write path.
- [x] Progress ledger updated.
- [x] Errors remain specific and actionable; no silent fallback added.

## Integration Checklist

- [x] Canonical meeting signal ownership remains `source_signal_candidates` and
      `insight_cards`.
- [x] Fireflies/meeting extraction still creates project tasks through the
      existing `_upsert_task` path.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Static scan proves `_upsert_insight` no longer exists in active backend
      source except historical/proof docs.
- [x] Focused meeting signal tests pass.
- [x] Touched backend modules pass syntax check.
- [x] Changed-file typecheck/checks are delegated to a subagent where relevant.

## Verification Checklist

- [x] Static/lint check run, or explicitly delegated.
- [x] Targeted backend tests run.
- [x] Relevant AI/RAG verifier run or recent passing bundle recorded.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Initial reference proof | `rg -n "_upsert_insight|upsert_insight|Pipeline A|project_issue_summary|project_health_dashboard|insight" backend/src/services/pipeline/extractor.py backend/src/services/pipeline backend/src/services/ingestion backend/tests frontend/src/lib/ai/tools/project-tools.ts` | Pass | `_upsert_insight` existed only as an unused no-op in `extractor.py`; active meeting signal write path uses `_safe_promote_meeting_signals`. |
| Route/API reachability proof | `rg -n "run_extractor|_promote_meeting_signals|_safe_promote_meeting_signals" backend/src backend/tests scripts` | Pass | `run_extractor` remains reachable through the pipeline orchestrator/admin/replay paths; deletion does not remove active extractor entry points. |
| Provider schedule proof | Architecture/task evidence | Pass | No provider schedule calls `_upsert_insight`; scheduled ingestion runs the pipeline/orchestrator and retained extractor entrypoint. |
| Database-write ownership proof | Code inspection | Pass | Final writes are `_upsert_task` for tasks and `_safe_promote_meeting_signals` for signal candidates / insight-card promotion. |
| Deleted symbol scan | `rg -n "_upsert_insight|DEPRECATED: legacy Pipeline A writer|Stores the enriched, embedded results|structured extraction → insights" backend/src/services/pipeline backend/src/services/ingestion backend/tests docs/ops/tasks/2026-06-27-remove-extractor-pipeline-a-noop.md` | Pass | No deleted no-op writer remains in active backend source; only proof-doc references and `_upsert_insight_card_from_candidate` remain. |
| Focused backend syntax | delegated sub-agent `019f09a6-5f4c-77d2-a9fb-c3baac15dda6`: `backend/.venv/bin/python -m py_compile backend/src/services/pipeline/extractor.py backend/src/services/pipeline/orchestrator.py` | Pass | Touched backend modules compile. |
| Focused backend tests | delegated sub-agent `019f09a6-5f4c-77d2-a9fb-c3baac15dda6`: `backend/.venv/bin/python -m pytest backend/tests/test_meeting_signal_promotion.py backend/tests/test_pipeline_orchestrator.py -q` | Pass | `14 passed`; warnings are existing dependency/FastAPI lifecycle warnings, not related to AAI-755. |
| Compact AI/RAG verifier bundle | delegated sub-agent `019f09a1-b599-7cd1-af7b-a6d33f10f299` | Pass | Chat architecture, source-specific, source-lifecycle, meetings, retrieval-contract, Graph subscriptions, and Microsoft assistant health all passed after `4225e8f18`. |

## Files To Change

- `backend/src/services/pipeline/extractor.py`
- `backend/src/services/pipeline/orchestrator.py`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/tasks/2026-06-27-remove-extractor-pipeline-a-noop.md`

## Risks / Gaps

- This slice removes a no-op compatibility symbol. If any out-of-repo stale
  importer referenced the private helper, it will fail loudly instead of hiding
  an inactive production write path.

## Blockers

None currently.
