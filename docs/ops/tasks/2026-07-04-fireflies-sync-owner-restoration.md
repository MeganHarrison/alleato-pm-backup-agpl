# Task: Fireflies Sync Owner Restoration

Status: In Progress
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-848
Related Handoff: Not created

## Objective

Restore one authoritative live owner for Fireflies sync by verifying and, if needed, repairing the Render cron / backend path that should be writing current `source_sync_runs` rows for Fireflies.

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
- [ ] Database schema/types/migrations handled, if applicable.
- [ ] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [ ] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [ ] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [ ] End-to-end path wired through one owner, not separate disconnected pieces.
- [ ] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [ ] Guardrail added so the same class of bug fails loudly next time.
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | Not run            | Pending | No isolated lint/type target exists for this backend-only repair yet. |
| Targeted tests        | `cd backend && pytest tests/test_fireflies_action_items.py -q` | Pass | Added regression coverage for Unicode storage-path sanitization and the restored import path. |
| Browser/user-flow     | Not applicable     | Pending | Cron/backend owner work. |
| DB/provider read-back | Render API `GET /v1/services/crn-d8kq9fl8nd3s73bgt570`; `GET /v1/services/crn-d8kq9fl8nd3s73bgt570/events?limit=50`; `GET /v1/services/crn-d8kq9fl8nd3s73bgt570/deploys?limit=5`; `POST /v1/services/crn-d8kq9fl8nd3s73bgt570/resume`; `POST /v1/cron-jobs/crn-d8kq9fl8nd3s73bgt570/runs`; `psql "$RAG_DATABASE_URL" ... source_sync_runs` | Partial | Verified the cron was suspended, patched to `timeout 20m python3 scripts/run_fireflies_sync.py`, resumed it, observed a live deploy, observed one failed run with `nonZeroExit=2`, then a later run finishing `successful`. |
| End-to-end proof      | `python3 - <<'PY' ... FirefliesIngestionPipeline(...).sync_recent_transcripts(limit=1)` | Partial | Reproduced the live failure as `name 'unicodedata' is not defined`; after the import fix the run progressed into extraction/task rewrite instead of crashing at storage-path generation. |

## Files Changed

- `docs/ops/tasks/2026-07-04-fireflies-sync-owner-restoration.md` - task ledger
- `backend/src/services/ingestion/fireflies_pipeline.py` - restored Unicode filename sanitization import and tightened whitespace normalization
- `backend/tests/test_fireflies_action_items.py` - regression coverage for Unicode storage-path sanitization

## Risks / Gaps

- Live Render now reaches the native Fireflies command, but the currently live commit still predates the import fix until this patch is pushed and redeployed.
- The latest successful manual run on Render only proves the cron surface executes; `source_sync_runs` still shows fresh `warning` rows with transcript-level failures that need another post-deploy validation pass.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
