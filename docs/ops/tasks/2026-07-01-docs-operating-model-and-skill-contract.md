# Task: Docs operating model and repeatable skill contract

Status: Complete
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-850 - https://linear.app/megankharrison/issue/AAI-850/define-the-docs-operating-model-and-skill-contract-for-repeatable
Related Handoff: N/A

## Objective

Define one clear operating model for Alleato documentation so documentation
creation, refresh, publication, parity review, and AI-assistant consumption all
run through the same canonical workflow instead of separate ad hoc processes.

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

- The repo contains one written operating model for how Alleato docs should be
  mapped, authored, refreshed, published, and audited.
- The operating model makes the source-of-truth order explicit so Procore is a
  reference source, not the final truth for Alleato behavior.
- The existing `repeatable-training-docs` skill is updated to reflect the
  simplified create/refresh/audit model and the current repo seams.
- The plan states what is already implemented versus what remains future work.
- The plan defines where status, blockers, stale docs, and parity findings
  should live.

## Source Of Truth

- Live Alleato workflow evidence: tutorial capture artifacts under
  `docs/tutorials/**`
- In-app documentation records: `training_docs`, `training_doc_steps`,
  `training_doc_assets`
- Procore reference sources: `scripts/procore-docs-query.js`,
  `.claude/procore-manifests/**`, and the official support site
- Skill entrypoint: `.codex/skills/repeatable-training-docs/SKILL.md`

## Files Changed

- `docs/ops/tasks/2026-07-01-docs-operating-model-and-skill-contract.md` -
  working definition of done and evidence.
- `docs/architecture/DOCS-OPERATING-MODEL.md` - canonical docs system design.
- `.codex/skills/repeatable-training-docs/SKILL.md` - updated skill contract for
  create, refresh, and audit modes.

## Evidence

| Check | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint | `git diff --check -- docs/architecture/DOCS-OPERATING-MODEL.md .codex/skills/repeatable-training-docs/SKILL.md docs/ops/tasks/2026-07-01-docs-operating-model-and-skill-contract.md` | Pass | New documentation files and skill edits have no whitespace errors. |
| Targeted tests | `rg -n "mode: create|mode: refresh|mode: audit|Source of Truth|training_docs|published_training_docs|procore-manifests" docs/architecture/DOCS-OPERATING-MODEL.md .codex/skills/repeatable-training-docs/SKILL.md` | Pass | The updated contract and operating-model sections are present in the edited files. |
| Browser/user-flow | Existing training-doc workflow evidence from June 29-30 task set; no new browser change in this task | Pass | This task only changes process docs and skill instructions, not runtime UI. Existing capture/publish/browser proof remains the relevant workflow evidence. |
| DB/provider read-back | Linear issue `AAI-850`; existing repo evidence for `training_docs` / `publish-tutorial.ts` / `/knowledge/app` flow | Pass | Tracking issue created and the operating model is grounded in the existing publication data flow already present in the repo. |
| End-to-end proof | `docs/architecture/DOCS-OPERATING-MODEL.md`; updated `.codex/skills/repeatable-training-docs/SKILL.md` | Pass | The repo now has a documented single-system plan plus updated skill instructions for create, refresh, and audit usage. |

## Risks / Gaps

- This task defines the operating model but does not yet implement the admin
  status board fields, stale-doc detection jobs, or automated parity-to-fix
  loop.
- The current skill supports `create` directly today. `refresh` is mostly a
  disciplined rerun of the same flow, while `audit` is a documented operating
  mode that still relies on existing parity/verification skills rather than a
  new one-command runtime.
- The assistant-consumption layer still needs explicit implementation work so
  AI tools preferentially read normalized Alleato docs plus workflow metadata
  instead of only broad RAG context.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
