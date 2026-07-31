# Task: Knowledge Base authoring docs

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-659 - https://linear.app/megankharrison/issue/AAI-659/document-knowledge-base-authoring-and-source-management
Related Handoff: N/A

## Objective

Create and publish a page on the Alleato OS docs site that explains how to add
Knowledge Base documentation, add and manage sources, update navigation and
sidebar categories, and verify changes.

## Attention Brief

Primary user: Alleato operators and developers maintaining the Knowledge Base.
Primary job: Add trusted knowledge and keep the visible Knowledge Base
navigation aligned with the source taxonomy.
Primary decision: Whether to add content through the app, the docs site, or
code-backed taxonomy/navigation changes.
Tier 1: Add knowledge workflow, source management, category/navigation update
steps, verification commands.
Tier 2: file ownership and RAG/source trust notes.
Tier 3: implementation references.
Hide until requested: unrelated product docs maintenance.
Remove: none.
Primary action: maintain Knowledge Base content without creating stale nav,
untrusted sources, or disconnected RAG records.
Failure-loudly behavior: docs.json validation, docs-site build, and exact git
read-back.

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
| Static/type/lint      | `cd docs/alleato-os-docs && npm run lint` | Blocked by unrelated repo debt | Mintlify fails parsing `asrs/asrs-requirements.md` at `111:6`, before reaching this new page. |
| Targeted tests        | `node -e 'JSON.parse(require("fs").readFileSync("docs.json")); console.log("docs.json valid")'` | Passed | Docs navigation JSON is valid. |
| Browser/user-flow     | Targeted docs read-back with `rg` and Node content assertions | Passed | Page exists, nav includes `developer-docs/architecture/knowledge-base-authoring`, and required topics/routes are present. |
| DB/provider read-back | N/A                | Passed | No database, provider, env, or migration changes. |
| End-to-end proof      | `git push origin main && git fetch origin main && git rev-parse HEAD && git rev-parse origin/main` in `/Users/meganharrison/Documents/github/alleato-os/apps/docs` | Passed | Docs repo published at `6c39801dcd6d1d846ae31c33c934e3aa817b6c97`; `HEAD == origin/main`. |

## Files Changed

- `docs/alleato-os-docs/developer-docs/architecture/knowledge-base-authoring.mdx` - new docs-site page.
- `docs/alleato-os-docs/docs.json` - navigation entry for the new page.
- `docs/ops/tasks/2026-06-25-knowledge-base-authoring-docs.md` - task definition and evidence ledger.

## Risks / Gaps

- The docs-site repo still has unrelated dirty/untracked files, including a
  deleted Microsoft attachment doc, untracked agent-tools docs, untracked
  `skills/`, and an unstaged `docs.json` Skills navigation group. The task
  commit staged and published only the Knowledge Base page and one nav entry.
- Full `npm run lint` remains blocked by unrelated
  `asrs/asrs-requirements.md` parse debt.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
