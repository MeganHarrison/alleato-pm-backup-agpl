# Project Assignment And Task Generation E2E

Date: 2026-06-25
Linear: AAI-690
Parent: AAI-636
Status: Complete

## Objective

Verify and finalize end-to-end project assignment and automatic task generation across every supported AI/RAG ingestion source.

## Scope

- Project assignment for Outlook emails, Fireflies meetings, Teams messages, SharePoint files, uploaded documents, PDFs, drawings, submittals, RFIs, contracts, and document-analysis outputs.
- Manual-review routing and confidence scoring for ambiguous or unmatched source records.
- Automatic task generation from meetings, emails, Teams conversations, document analysis, and AI extraction.
- Duplicate task prevention and accurate task owner/project association.
- Implementation repair only after verifier evidence identifies an active gap.

## Freshness Policy

- Fireflies backlog errors older than two months are historical and not active blockers unless a historical reconstruction request needs them.
- Outlook and Teams backlog errors older than one week are historical and not active blockers unless a historical reconstruction request needs them.

## Typecheck Delegation Rule

- Any TS/JS implementation change in this slice must be followed by delegated sub-agent typecheck using `npm --prefix frontend run typecheck`.
- The main thread may run short targeted non-typecheck checks, verifiers, Python compile/tests, and documentation guards.
- Delegated typecheck evidence must be recorded before the slice can close.

## Done Checklist

- [x] Create Linear issue before coding/provider operations.
- [x] Create task markdown before coding/provider operations.
- [x] Post Linear kickoff comment with scope, evidence locations, and next action.
- [x] Inventory current project-assignment and task-generation code paths against the target architecture.
- [x] Run baseline project-assignment/task-generation verifiers and record outputs.
- [x] Verify project assignment for Outlook emails inside the one-week operational concern window.
- [x] Verify project assignment for Teams messages inside the one-week operational concern window.
- [x] Verify project assignment for Fireflies meetings inside the two-month operational concern window.
- [x] Verify project assignment for SharePoint files.
- [x] Verify project assignment for uploaded documents and PDFs.
- [x] Verify project assignment for drawings, submittals, RFIs, and contracts where source records exist.
- [x] Verify unmatched/ambiguous records route to manual review with confidence scoring.
- [x] Verify task generation from meetings.
- [x] Verify task generation from emails.
- [x] Verify task generation from Teams conversations.
- [x] Verify task generation from document analysis and AI extraction.
- [x] Verify duplicate task prevention.
- [x] Verify generated task owner and project association.
- [x] Add or repair failure-loud guardrails for any confirmed gap.
- [x] Delegate typecheck after every TS/JS implementation change and record evidence.
- [x] Update central AI/RAG finalization `TASKS.md`.
- [x] Update handoff with evidence, root cause, prevention, and remaining blockers.
- [x] Publish code/docs/evidence if code/docs change.

## Evidence

Evidence will be stored under:

- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/`

Linear issue:

- AAI-690: https://linear.app/megankharrison/issue/AAI-690/verify-project-assignment-and-task-generation-end-to-end

Linear kickoff comment:

- AAI-690 comment `6957e310-e278-4724-be79-20587c94d45d`
- AAI-690 progress comment `18a3c44b-bdb3-4400-86a6-abb1bdb9b0d1`
- AAI-690 completion comment `3d95ba04-03d1-4fcc-a975-56ba166c3195`

Path inventory:

- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-task-generation-inventory-aai-690.md`

Baseline evidence:

- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-baseline-aai-690.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-attribution-baseline-aai-690.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-integrity-baseline-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-dry-run-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-dry-run-60d-aai-690.json`

Repair evidence:

- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-fireflies-dry-run-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-fireflies-tasks-only-dry-run-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-fireflies-tasks-only-applied-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-link-guardrail-tests-aai-690.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-integrity-after-link-repair-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-fireflies-tasks-only-postcheck-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-fireflies-task-link-repair-aai-690.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/generated-task-duplicate-baseline-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-project-id-mismatch-samples-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/task-project-rules-fireflies-sync-dry-run-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/task-project-rules-fireflies-sync-applied-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/task-project-rules-fireflies-sync-postcheck-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/generated-task-duplicate-after-repair-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-integrity-after-task-attribution-sync-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-task-attribution-sync-aai-690.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-synthesizer-status-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-synthesizer-dry-run-project-67-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-synthesizer-applied-project-67-after-patch-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/project-synthesizer-created-task-project-array-repair-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/task-generation-live-coverage-after-synthesis-fix-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/communications-task-generation-tests-aai-690.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/teams-task-generation-candidates-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/teams-synthesizer-dry-run-project-1011-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/teams-synthesizer-applied-project-1011-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/teams-task-generation-live-proof-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/task-generation-live-coverage-after-teams-proof-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/document-source-assignment-task-inventory-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/document-analysis-task-generation-inventory-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/task-generation-active-window-duplicates-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/onedrive-sharepoint-source-path-assignment-dry-run-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/sharepoint-ap-check-assignment-dry-run-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/onedrive-sharepoint-source-path-assignment-applied-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/document-source-assignment-task-inventory-after-source-path-repair-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-redrive-aai-690-source-lifecycle-regression.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-redrive-aai-690-after-legacy-prompt-fix.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-aai-690-fireflies-redrive.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-legacy-prompt-compile-aai-690.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-legacy-prompt-tests-aai-690.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/frontend-typecheck-after-aai-690-fireflies-legacy-prompt-fix.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-current-state-dry-run-aai-690-sharepoint-disposition.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-current-state-applied-aai-690-sharepoint-disposition.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/sharepoint-disposition-postcheck-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/sharepoint-legacy-lifecycle-review-repair-dry-run-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/sharepoint-legacy-lifecycle-review-repair-applied-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-aai-690-sharepoint-legacy-disposition.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/task-project-array-final-repair-aai-690.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/task-generation-final-coverage-aai-690.json`

## Initial Known Constraints

- `docs/ops/tasks/TASK-TEMPLATE.md` is referenced by AGENTS.md but is not present in this checkout; this ledger follows the structure of the existing active task files.
- The checkout contains unrelated dirty frontend files; this slice must keep ownership scoped to AAI-690 files.
- Do not delete assignment or task-generation code until import, route, provider-schedule, and database-write proof show it is inactive.

## Blockers

- None remaining for this AAI-690 slice.

## Residual Risk

- Some Fireflies-generated tasks remain intentionally without direct project links because their source meetings are latest-routed to project-assignment review, internal, or multi-project disposition. They are not scalar/array mismatches and should not be force-assigned without review.

## Root Cause

Fireflies task integrity initially failed because stale task rows had their scalar project populated from their source document but the task project array was empty or mismatched. The current Fireflies task writers already populate the project array, so that first failure was historical data drift.

A stricter duplicate/link query then found 48 additional Fireflies task rows where task-level attribution repairs had set the scalar project from task text while leaving the project array empty. The recurring path was `backfill_task_project_assignments_from_rules.mjs`, which updated only the scalar project.

Outlook/Teams automatic task generation had a separate active gap. Recent live data showed 454 Outlook email documents and 341 Teams message documents inside the one-week concern window, but zero communication task rows and zero synthesizer processing markers. The Graph sync path only invoked communication intelligence extraction when inline embedding was enabled, while Teams-only scheduled phases intentionally run fetch-only. A bounded Outlook redrive then exposed a second issue: signal-card promotion failures aborted the whole document before task writes, and the shared task writer populated the scalar project but not the task project array for communication tasks called with only scalar project ID.

The remaining Fireflies lifecycle regression exposed a third active issue. Legacy Fireflies action-item tasks created by the pipeline extractor were classified as `fireflies_pipeline_legacy` but left the required extraction prompt version empty, so the database task-quality trigger rejected the write and stopped the redrive. The extractor now records an explicit legacy Fireflies prompt version for that path.

Document-source inventory found that deterministic source-path assignment could safely repair 7 OneDrive/SharePoint documents. SharePoint AP check assignment was intentionally not applied because exact payment or accounting matches resolved 0 safe assignments and rejected 81 parsed candidates.

Legacy SharePoint lifecycle rows used the older `sharepoint` source namespace and marked unassigned records complete. Current canonical backfill writes `microsoft_graph_sharepoint` rows with `project_assignment_review`, so those stale legacy rows needed a status-only repair to avoid silently treating unassigned SharePoint documents as terminally complete.

## Prevention

- Added source-filter and task-only controls to the deterministic project-assignment backfill so stale task links can be repaired without touching older Teams/Outlook rows or unrelated document assignment rows.
- Added a focused Python guardrail proving `_upsert_task` persists the project array alongside the scalar project.
- Updated task-attribution and document-attribution repair scripts so any future scalar task project assignment also updates the project array.
- Applied Fireflies-only task-attribution repair and confirmed 0 remaining Fireflies scalar/array task project mismatches over the two-month operational concern window.
- Fireflies task integrity verifier now passes over the two-month operational concern window after repair.
- Updated Graph sync so event-driven communication extraction runs whenever Outlook, Teams channel, or Teams DM items are synced, even when inline embedding is skipped.
- Updated project synthesizer so signal promotion failures are recorded but no longer block downstream task creation for the same document.
- Updated the shared task writer so scalar project assignments always populate the task project array.
- Replaced a dead compiler-title unit test that referenced deleted email/Teams compiler modules with active-path project synthesizer task writer tests.
- Verified one real recent Outlook email generated a task with project, project array, owner, and no duplicate task group after the fix.
- Verified one real recent Teams DM generated 4 tasks with project, project arrays, owners, and no duplicate task groups after the fix.
- Verified drawing uploads and submittals are directly project-assigned in live app metadata.
- Verified uploaded-document/PDF assignment coverage, with the only uploaded-document unassigned sample being a knowledge SOP rather than a project document.
- Verified manual review routing exists through `document_attribution_candidates`, including pending-review rows with confidence scores and the admin review API.
- Verified document-analysis task generation exists through a real contract attachment task with project, project array, and owner populated.
- Verified duplicate task prevention inside the active freshness windows: 0 duplicate groups for Outlook/Teams one-week windows, Fireflies two-month window, and all other document-task rows.
- Added `LEGACY_FIREFLIES_TASK_PROMPT_VERSION` so legacy Fireflies action-item tasks satisfy the task-quality database trigger instead of failing redrive.
- Re-ran canonical source lifecycle verification after Fireflies redrive; it passes with no failures.
- Applied current-state lifecycle normalization over the active 7-day Microsoft window, routing 126 current SharePoint rows to project-assignment review and preserving 46 project-intelligence-updated rows with projects.
- Repaired 124 stale legacy `sharepoint` lifecycle rows from complete/no-project to project-assignment review; postcheck found 0 remaining no-project terminal SharePoint rows.
- Repaired 4 generated task scalar/array mismatches; final task coverage found 0 active scalar/array mismatches and 0 active duplicate task groups.
- Confirmed remaining no-project generated tasks map to source meetings with project-assignment review, internal, or multi-project lifecycle disposition.

## Failure-Loud Guardrail

Assignment gaps, missing manual-review routing, missing generated tasks, duplicate generated tasks, and incorrect task owner/project links are now backed by repeatable evidence files for this slice. Future regressions should fail through source lifecycle, task duplicate, Fireflies integrity, and task scalar/array coverage checks instead of manual inspection alone.
