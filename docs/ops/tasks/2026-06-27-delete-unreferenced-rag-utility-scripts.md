# Task: Delete Unreferenced Legacy RAG Utility Scripts

Status: Completed
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-756 - https://linear.app/megankharrison/issue/AAI-756/delete-unreferenced-legacy-rag-utility-scripts
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Delete unreferenced legacy utility scripts that are not part of the final
production AI/RAG ingestion architecture. Keep historical proof in docs, but
do not leave manual one-off utilities in active source after their work has
been completed and production ownership has moved to backend services.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared services/helpers identified before removing code.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
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
- [x] Delete `scripts/ingestion/ingest_knowledge_base_folder.py`.
- [x] Delete `scripts/ops/backfill-legacy-drawing-document-metadata.mjs`.
- [x] Preserve historical drawing proof as evidence, without treating the deleted backfill as an active implementation.
- [x] Update finalization progress ledger.
- [x] Leave `scripts/ingestion/sharepoint_project_folder_dry_run.py` untouched in this slice because `package.json` still referenced it; follow-up AAI-758 removed both together.
- [x] Errors remain specific and actionable; no silent fallback added.

## Integration Checklist

- [x] SharePoint/Graph production ingestion remains owned by backend Microsoft
      Graph sync services and Render jobs.
- [x] Drawing OCR/metadata production ownership remains the upload/OCR pipeline,
      not the one-off legacy backfill.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Static scan proves deleted script filenames no longer exist in active
      source outside historical/proof docs.
- [x] Package scripts do not reference deleted filenames.
- [x] Provider/render configs do not reference deleted filenames.
- [x] Changed-file checks are delegated to a subagent where relevant.

## Verification Checklist

- [x] Static/lint check run, or explicitly delegated.
- [x] Targeted checks run.
- [x] Relevant AI/RAG verifier run or recent passing bundle recorded.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Read-only script audit | delegated sub-agent `019f09a3-8d5c-7b90-a6e6-e57ef74cd44b` | Pass | `ingest_knowledge_base_folder.py` and `backfill-legacy-drawing-document-metadata.mjs` had only self-usage comments, no package script refs, no Render refs, and no production path usage. |
| Package script guard | delegated sub-agent `019f09a3-8d5c-7b90-a6e6-e57ef74cd44b` | Pass | `sharepoint_project_folder_dry_run.py` was retained in this slice because `package.json` still exposed `rag:sharepoint:dry-run`; follow-up AAI-758 removed both together. |
| Drawing idempotency proof | `docs/ops/tasks/2026-06-25-submittal-ai-synthetic-proof.md` | Pass | Prior post-apply dry-run found zero remaining legacy drawing metadata candidates for project `25125`. |
| Compact deletion verification | delegated sub-agent `019f09a9-8017-7bf2-bc6e-e198ed90b81b` | Pass | Deleted filenames have no live `package.json`, `render.yaml`, backend, or app runtime references; remaining matches are historical proof docs/artifacts. |
| Retained SharePoint dry-run proof | `rg -n "sharepoint_project_folder_dry_run" package.json scripts/ingestion/sharepoint_project_folder_dry_run.py` | Pass | At AAI-756 close, the package script still referenced the file, so it was out of scope for that deletion. AAI-758 removed both together. |
| Compact AI/RAG verifier bundle | delegated sub-agent `019f09a1-b599-7cd1-af7b-a6d33f10f299` | Pass | Chat architecture, source-specific, source-lifecycle, meetings, retrieval-contract, Graph subscriptions, and Microsoft assistant health all passed after `4225e8f18`. |

## Files To Change

- `scripts/ingestion/ingest_knowledge_base_folder.py`
- `scripts/ops/backfill-legacy-drawing-document-metadata.mjs`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/tasks/2026-06-27-delete-unreferenced-rag-utility-scripts.md`

## Risks / Gaps

- This slice intentionally did not remove `scripts/ingestion/sharepoint_project_folder_dry_run.py`
  because the root `package.json` still referenced it. Follow-up AAI-758
  removed the package script and file together.

## Blockers

None currently.
