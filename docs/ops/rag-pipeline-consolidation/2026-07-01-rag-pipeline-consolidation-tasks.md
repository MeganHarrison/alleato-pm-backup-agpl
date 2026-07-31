# Task: RAG pipeline consolidation proposal

Status: In Progress
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-848 - https://linear.app/megankharrison/issue/AAI-848/implement-rag-pipeline-consolidation-with-fireflies-first-cutover

## Related Links

- Architecture proposal: [2026-07-01-rag-pipeline-consolidation-architecture-proposal.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-architecture-proposal.md)
- Implementation task doc: [2026-07-01-rag-pipeline-consolidation-implementation-tasks.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-implementation-tasks.md)
- Fireflies ownership map: [2026-07-01-fireflies-current-ownership-map.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-fireflies-current-ownership-map.md)
- Linear issue: [AAI-848](https://linear.app/megankharrison/issue/AAI-848/implement-rag-pipeline-consolidation-with-fireflies-first-cutover)

## Objective

Produce a repo-specific consolidation proposal for the AI/RAG pipeline that:

- selects one durable orchestration model
- defines the reporting and feedback surfaces operators need
- states the no-archived-code rule for pipeline implementations
- names what should be kept, replaced, migrated, and deleted before implementation begins

## Scope Checklist

- [x] Relevant Alleato complex-feature skill reviewed.
- [x] Current production architecture doc reviewed.
- [x] Current scheduler-owned runtime path reviewed.
- [x] Current admin source-sync and pipeline-health surfaces reviewed.
- [x] Current lifecycle contract reviewed.
- [x] Concrete proposal written in a checked-in document.
- [x] Linear issue created for implementation.
- [ ] Implementation cutover plan approved.

## Proposal Checklist

- [x] State the root cause in architecture terms, not only provider terms.
- [x] Choose a target orchestration model.
- [x] State whether `eve` is phase 1 or later.
- [x] Define the “one setup only” deletion rule.
- [x] Define the operator reporting surfaces needed on the frontend.
- [x] Explain what does and does not improve Codex/Claude troubleshooting visibility.
- [x] Identify the current files/surfaces that are closest to the future state.

## Acceptance Criteria

- The proposal names one production orchestration owner.
- The proposal defines how documents move from source arrival to task extraction.
- The proposal makes it explicit that retired pipeline implementations must not remain in the main repo.
- The proposal explains the human-readable operator views needed to inspect sync, chunking, embedding, project assignment, and task extraction.
- The proposal gives a migration order that avoids parallel long-lived setups.

## Files To Change

- `docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-architecture-proposal.md`
- `docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-tasks.md`

## Evidence

| Check | Artifact | Result | Notes |
| ----- | -------- | ------ | ----- |
| Current architecture reviewed | `docs/architecture/AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md` | Pass | Confirms the repo already intends one production architecture. |
| Current runtime owner reviewed | `backend/src/services/scheduler.py` | Pass | Confirms multi-owner in-process scheduling remains a central orchestration seam. |
| Current reporting surface reviewed | `frontend/src/app/(admin)/source-sync/page.tsx` | Pass | Confirms lifecycle flow UI already exists. |
| Current reporting surface reviewed | `frontend/src/components/ai-intelligence/source-sync-health-panel.tsx` | Pass | Confirms source health, stuck items, and lifecycle metrics already exist. |
| Current reporting contract reviewed | `frontend/src/app/api/admin/source-sync/_contracts.ts` | Pass | Confirms existing stage vocabulary and operator data model starting point. |
| Proposal created | `docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-architecture-proposal.md` | Pass | Checked-in proposal for implementation planning. |
| Implementation issue created | `AAI-848` | Pass | Active Linear issue for the implementation packet and Fireflies-first cutover. |

## Risks / Gaps

- Current admin reporting is useful but still derived from the existing mixed-ownership runtime; implementation must move those views onto the future canonical workflow ledger.
- The repository does not currently expose a `docs/ops/tasks/TASK-TEMPLATE.md` file even though AGENTS references one. Future process cleanup should restore a canonical template path.

## Final Status

- [x] Proposal document is written.
- [x] Evidence is recorded.
- [x] The no-archived-code rule is explicit.
- [ ] Implementation kickoff prerequisites are complete.
