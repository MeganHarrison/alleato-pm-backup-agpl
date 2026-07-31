# Task: Remove SharePoint Dry-Run Entrypoint

Status: Completed
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-758 - https://linear.app/megankharrison/issue/AAI-758/remove-legacy-sharepoint-dry-run-script-entrypoint
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Remove the last legacy SharePoint preview script from the active repo by
deleting both the root package entrypoint and the script file. The final
production SharePoint/Graph ingestion path is the backend Microsoft Graph sync
service running through Render, not a manual preview utility.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
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
- [x] Remove root `package.json` script `rag:sharepoint:dry-run`.
- [x] Delete `scripts/ingestion/sharepoint_project_folder_dry_run.py`.
- [x] Update finalization progress ledger.
- [x] Errors remain specific and actionable; no silent fallback added.

## Integration Checklist

- [x] SharePoint/Graph production ingestion remains owned by backend Microsoft
      Graph sync services and Render jobs.
- [x] No assistant/RAG retrieval path depends on the dry-run preview utility.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Static scan proves the deleted script filename and package script no
      longer exist in active source except historical/proof docs.
- [x] Root package JSON remains valid.
- [x] Provider/render configs do not reference the deleted filename.
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
| Prior script audit | delegated sub-agent `019f09a3-8d5c-7b90-a6e6-e57ef74cd44b` | Pass | The script had no Render/live scheduler reference and was not a production path; its only active repo reference was the root package dry-run script. |
| Package ownership proof | `git diff -- package.json` before edits | Pass | Root `package.json` was clean; unrelated dirty package file is `frontend/package.json`, not this file. |
| Root package parse | `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package ok')"` | Pass | Root package JSON remains valid after script removal. |
| Active reference scan | delegated sub-agent `019f09ad-2904-77b1-ba32-151be8f5cbb9`: `rg -n "sharepoint_project_folder_dry_run|rag:sharepoint:dry-run" package.json render.yaml backend frontend/src scripts docs/ops/tasks docs/ops/ai-rag-production-finalization/TASKS.md` | Pass | Remaining matches are only docs/task-history references, not package/provider/runtime surfaces. |
| Route checks | `npm run check:routes && npm run verify:nonprod-routes` | Pass | No dynamic route conflicts; non-production route manifest valid with 42 files. |
| Compact AI/RAG verifier bundle | delegated sub-agent `019f09a1-b599-7cd1-af7b-a6d33f10f299` | Pass | Chat architecture, source-specific, source-lifecycle, meetings, retrieval-contract, Graph subscriptions, and Microsoft assistant health all passed after `4225e8f18`. |

## Files To Change

- `package.json`
- `scripts/ingestion/sharepoint_project_folder_dry_run.py`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/tasks/2026-06-27-remove-sharepoint-dry-run-entrypoint.md`

## Risks / Gaps

- This removes a manual preview command. Production Graph ingestion is retained
  through backend services and Render scheduled jobs.

## Blockers

None currently.
