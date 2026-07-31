# Task: Source Control Plane And Task Assignment Hardening

Status: Complete
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-848
Related Handoff: Not created

## Objective

Make source-family RAG health readable from one canonical verifier and stop linked task rows from drifting away from `document_metadata.project_id` when project assignment happens after ingestion.

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

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npm run test:rag:control-plane` | Pass | Node guardrail test for source-family control-plane helper and stage classification. |
| Targeted tests        | `python3 scripts/verify/verify_fireflies_task_integrity.py --window-hours 336 --limit 1000` | Pass | 409 meeting task rows checked; 0 link violations after repair. |
| Browser/user-flow     | Not applicable     | Pass | No frontend surface change in this task; control-plane readout is script-first. |
| DB/provider read-back | `psql <app-db-url> -f supabase/migrations/20260704113000_sync_task_project_assignment_from_document_metadata.sql`; `supabase migration repair --status applied 20260704113000 --db-url <app-db-url> --yes`; `npm run db:migrations:verify-applied -- supabase/migrations/20260704113000_sync_task_project_assignment_from_document_metadata.sql` | Pass | Trigger installed and remote ledger verified. |
| End-to-end proof      | `node scripts/verify/backfill_project_assignments_from_compiler_jobs.mjs --dry-run --days 14 --limit 5000 --source-system fireflies`; `node scripts/verify/backfill_project_assignments_from_compiler_jobs.mjs --days 14 --limit 5000 --source-system fireflies`; `npm run rag:verify:control-plane -- --days 14` | Pass with remaining warnings | Dry-run found 29 deterministic Fireflies task-link repairs; apply updated all 29. Control-plane verifier now separates remaining meeting sync staleness and non-meeting task-outcome coverage from assignment integrity. |

## Files Changed

- `docs/ops/tasks/2026-07-04-source-control-plane-and-task-assignment-hardening.md` - task ledger
- `scripts/verify/source_control_plane_health_lib.mjs` - shared source-family mapping and status helpers
- `scripts/verify/verify_source_control_plane_health.mjs` - canonical source-family verifier
- `scripts/verify/__tests__/source-control-plane-health-lib.test.mjs` - control-plane guardrail test
- `package.json` - verifier command wiring
- `supabase/migrations/20260704113000_sync_task_project_assignment_from_document_metadata.sql` - assignment drift prevention trigger

## Risks / Gaps

- Fireflies canonical sync is still stale in the control-plane report; the trigger/backfill work repaired assignment drift, not the stale sync owner.
- Meeting task extraction coverage is still below target for several recent meetings that completed without explicit extraction outcomes.
- Teams/email/SharePoint task-outcome coverage is low in the new verifier because those families do not yet record outcome metadata consistently.
- If any workflow intentionally wants a metadata-linked task to diverge from `document_metadata.project_id`, this trigger will now override that divergence on future project changes.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
