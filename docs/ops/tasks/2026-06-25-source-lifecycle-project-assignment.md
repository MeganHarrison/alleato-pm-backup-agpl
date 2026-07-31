# Source Lifecycle Project Assignment

Date: 2026-06-25
Session: S91
Linear: AAI-639
Parent: AAI-636
Status: Complete for AAI-639 Gate; Broader Finalization Continues

## Objective

Recover the source lifecycle health gate for project assignment and generated task assignment without forcing ambiguous sources into incorrect projects. The production contract is: assign deterministically when confidence is high, mark non-project/internal items explicitly, and route ambiguous project-like items to manual review with auditable lifecycle state.

## Scope

- Source lifecycle verifier project-assignment semantics.
- Fireflies, Teams, and Outlook source project disposition coverage.
- Generated task project linkage, especially task rows whose source document already has a project.
- Existing backfill/review ledgers; no parallel assignment system.

## Done Checklist

- [x] Create task markdown before implementation.
- [x] Inspect the current source lifecycle verifier contract.
- [x] Prove the failing source-family ratios and samples from saved verifier evidence.
- [x] Prove generated task assignment gaps and separate stale propagation from truly ambiguous work.
- [x] Patch only the canonical verifier/backfill path if needed.
- [x] Run dry-run before any data-changing backfill.
- [x] Apply bounded data repair only where source evidence is deterministic.
- [x] Run targeted assignment/task integrity checks.
- [x] Re-run `npm run rag:verify:source-lifecycle`.
- [x] Update Linear and handoff evidence.

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-fireflies-fix.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-dry-run-after-patch.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-applied.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-project-assignment-fix.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-integrity-after-project-assignment-fix.json`

Commands:

- `node scripts/verify/backfill_project_assignments_from_compiler_jobs.mjs --dry-run --days 14 --limit 5000` - PASS, identified 162 deterministic task/source-document links and 0 document compiler assignments.
- `node scripts/verify/backfill_project_assignments_from_compiler_jobs.mjs --days 14 --limit 5000` - PASS, updated 162 task links.
- `PYTHONPATH=backend backend/.venv/bin/python scripts/verify/verify_fireflies_task_integrity.py --window-hours 336 --limit 1000` - PASS, 0 link violations.
- `npm run rag:verify:source-lifecycle` - PASS, no failures.

## Current Findings

- Source embeddings are healthy after the Fireflies fix; failing source-family ratios are project assignment only.
- Current source verifier counts `project_assignment_review` rows as failed project assignment, even though final architecture allows ambiguous items to route to manual review.
- Generated task gaps include Fireflies tasks where `tasks.project_id` is null but the linked `document_metadata.project_id` is already present.
- Fixed verifier semantics to measure project disposition: directly assigned, terminal not-applicable, or auditable manual-review state.
- Fixed existing project-assignment backfill to repair task rows from linked `document_metadata.project_id`; no ambiguous records were assigned.

## Linear

- Update posted to AAI-639 after repair.

## Failure-Loud Guardrail

This task fails loudly if ambiguous sources are auto-assigned without deterministic evidence, if review-routed sources disappear from reporting, or if task rows can remain unlinked when their source document already has a project.
