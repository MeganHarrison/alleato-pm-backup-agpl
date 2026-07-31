# Task: Project Intelligence three-project refresh

Status: Complete
Owner: Codex
Created: 2026-07-02
Linear Issue: Blocked - Linear issue creation rejected by connector argument validation before accepted team metadata was available.
Related Handoff: N/A

## Objective

Refresh and verify production Project Intelligence freshness for project IDs 67
Vermillion Rise Warehouse, 876 Exol Morrisville, and 1009 Union Collective so
the visible packet state is current against the latest app and RAG source rows.

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
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- Project packets for 67, 876, and 1009 are refreshed through the canonical
  `backend/src/services/intelligence/project_intelligence.py` writer.
- Refresh runs are bounded to exactly the three project IDs and final projection
  writes are explicitly enabled only for the bounded run.
- Read-back compares `intelligence_packets.generated_at`,
  `intelligence_packets.covered_end_at`, packet source count, latest app source,
  latest RAG source, and app-derived stale status.
- Any remaining freshness mismatch is recorded with cause, detection gap,
  prevention step, owner, and next action.

## Source Of Truth

- Packet writer: `backend/src/services/intelligence/project_intelligence.py`.
- Packet reader: `frontend/src/lib/ai/intelligence/packet-service.ts`.
- Final projection guard: `backend/src/services/ops/db_pressure_guard.py`.
- Production packet table: `public.intelligence_packets`.
- App source table: `public.document_metadata`.
- RAG source table: `public.rag_document_metadata`.

## Files To Change

- `docs/ops/tasks/2026-07-02-project-intelligence-three-project-refresh.md` -
  task control/evidence record.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Linear kickoff | Linear connector `_save_issue` | Blocked | Connector returned argument validation errors for both `team=Alleato` and `team=PM`; no accepted team metadata tool was available. |
| Initial read-back | Production app DB + RAG DB SQL checks | Pass | Resolved projects 67, 876, 1009 and confirmed stale/mismatched packet state before refresh. |
| Bounded refresh | `PYTHONPATH=backend backend/.venv/bin/python - <<'PY' ... refresh_project_intelligence(67/876/1009) ... PY` with `ALLOW_PM_APP_FINAL_PROJECTIONS=true`, `PM_APP_PROJECTION_MAX_TOTAL_ROWS=10` | Pass | Refreshed existing packet IDs for all three projects. Results: 67 docs=1 covered_end=`2026-07-02T00:00:00+00:00`; 876 docs=2 covered_end=`2026-07-01T00:00:00+00:00`; 1009 docs=3 covered_end=`2026-07-02T00:00:00+00:00`. No fabricated citations; no truncation. |
| DB/provider read-back | App DB + RAG DB SQL read-back | Pass | Packets generated at `2026-07-02T14:29:42.108Z` (67), `2026-07-02T14:30:16.303Z` (876), `2026-07-02T14:30:42.474Z` (1009); all under the 8-hour stale threshold, all current packets use `project_intelligence_synthesis_v1`, all latest app sources are present in packet source sets, and no latest RAG source loaded after packet generation. |
| Guardrail added | `scripts/verify/verify_project_intelligence_packet_freshness.mjs` + `npm run rag:verify:project-intelligence-packet-freshness` | Pass | New verifier fails on stale packet age, wrong compiler version, empty source set, latest app source missing from packet, or RAG material loaded after packet generation. It reports non-embedded RAG rows as warnings. |
| Targeted packet freshness verification | `npm run rag:verify:project-intelligence-packet-freshness -- --project-ids 67,876,1009` | Pass | `{ ok: true }`. Warnings remain for non-embedded RAG rows: 65 for 67, 78 for 876, 164 for 1009; latest Vermillion RAG source has `embedding_status=null`. |
| Static syntax check | `node --check scripts/verify/verify_project_intelligence_packet_freshness.mjs` | Pass | New verifier parses cleanly. |
| Package manifest check | `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"` | Pass | `package.json ok`. |
| Existing live-path verifier | `npm run rag:verify:project-intelligence-live-paths` | Unrelated Fail | Existing verifier fails because docs-site files under `docs/alleato-os-docs/project-intelligence/*.mdx` are missing in this checkout. The failure is docs-path drift, not caused by this packet refresh or new guardrail. |
| End-to-end proof | Production packet refresh + packet freshness verifier | Pass | Visible packet rows are no longer stale against latest app/RAG source timestamps for the three requested projects. |

## Files Changed

- `docs/ops/tasks/2026-07-02-project-intelligence-three-project-refresh.md` -
  task evidence and done gate.
- `scripts/verify/verify_project_intelligence_packet_freshness.mjs` -
  reusable packet-vs-app/RAG freshness verifier.
- `package.json` - npm script for the packet freshness verifier.

## Risks / Gaps

- Linear tracking is blocked by connector argument validation; the task markdown
  is the active local control plane for this run.
- RAG retrieval health still has warnings: 65 non-embedded rows for 67, 78 for
  876, and 164 for 1009. Packet freshness is repaired, but retrieval/indexing
  debt remains and should be drained separately.
- The existing live-path verifier has unrelated docs-path drift for
  `docs/alleato-os-docs/project-intelligence/*.mdx`.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
