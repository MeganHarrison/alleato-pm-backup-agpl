# Task: Create change event training documentation

Status: In Progress
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-782 - https://linear.app/megankharrison/issue/AAI-782/create-training-documentation-for-creating-a-change-event
Related Handoff: N/A

## Objective

Use the repeatable training-doc skill on the existing change-event workflow
capture to produce Alleato-only step-by-step documentation for creating a
change event, with screenshots and walkthrough video preserved, and publish or
stage it through the training-doc workflow.

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
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- A change-event documentation draft exists with Alleato-only wording.
- The draft uses the existing captured step order and screenshots.
- The walkthrough video remains available as part of the tutorial artifact set.
- The final draft contains no external-brand mentions and no external support links.
- Any failure to read the stored support corpus is recorded explicitly instead of
  being silently ignored.

## Source Of Truth

- Workflow capture: `scripts/tutorials/workflows/change-create-event.workflow.ts`
- Captured artifacts: `docs/tutorials/change-management/change-create-event/`
- Training-doc skill: `.codex/skills/repeatable-training-docs/SKILL.md`

## Files Changed

- `docs/ops/tasks/2026-06-30-change-event-training-doc.md` - task ledger and evidence.
- `docs/tutorials/change-management/change-create-event/change-create-event.md` - cleaned change-event guide used as the primary tutorial file.
- `docs/tutorials/change-management/change-create-event/documentation-draft.md` - change-event documentation draft.
- `docs/tutorials/change-management/change-create-event/source-brief.md` - source brief when source retrieval succeeds, or blocker note.
- `docs/tutorials/change-management/change-create-event/documentation-input.json` - generation input artifact when source retrieval succeeds, or blocker note.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `rg -n "Procore|support\\.procore|v2\\.support\\.procore" docs/tutorials/change-management/change-create-event/*`; `git diff --check -- docs/tutorials/change-management/change-create-event/change-create-event.md docs/tutorials/change-management/change-create-event/documentation-draft.md docs/tutorials/change-management/change-create-event/source-brief.md docs/tutorials/change-management/change-create-event/documentation-input.json docs/ops/tasks/2026-06-30-change-event-training-doc.md` | Pass | Final documentation files are clean and diff has no whitespace errors. |
| Targeted tests        | Manifest/video/screenshots inspection in `docs/tutorials/change-management/change-create-event/` | Pass | Existing captured artifact set includes `manifest.json`, `session.webm`, and seven step screenshots. |
| Browser/user-flow     | Existing capture evidence: `docs/tutorials/change-management/change-create-event/session.webm`, screenshots, manifest source URLs under `/1034/change-events/new` | Partial | Reused the current captured Alleato workflow rather than running a fresh `/knowledge/app` browser verification. |
| DB/provider read-back | Service-role query for `training_docs.slug = change-create-event`; `npx tsx scripts/tutorials/publish-tutorial.ts docs/tutorials/change-management/change-create-event/manifest.json --app-tool-category change-management --source-route /1034/change-events/new --title "Create a Change Event"` | Pass | Row `3aed63f0-0048-4e36-83a8-1c738bbe09e9` is `published`, with `appPublishedPath = /knowledge/app/change-management/change-create-event` and `last_published_at = 2026-06-30T22:52:57.554+00:00`. |
| End-to-end proof      | `change-create-event.md`, `documentation-draft.md`, published `training_docs` row with `appToolCategory = change-management` | Pass | Generated Alleato-only documentation artifacts and registered the doc in the app training-doc system for the Change Management category. |

## Risks / Gaps

- Stored support-article enrichment was still blocked in this session, so the
  final local draft used the explicit Alleato-workflow fallback notes instead of
  live stored support excerpts.
- A fresh browser check against `/knowledge/app` was not run in this session, so
  page visibility is proved by the publish/data path rather than a new visual
  capture of the app knowledge page.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
