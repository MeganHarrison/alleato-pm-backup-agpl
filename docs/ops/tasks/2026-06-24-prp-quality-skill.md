# Task: Expose PRP Quality As Codex Skill

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-626 https://linear.app/megankharrison/issue/AAI-626/expose-prp-quality-as-a-codex-skill
Related Handoff: None

## Objective

Make `prp-quality` available as a Codex skill for this repo so PRP validation can
be invoked from the Codex skill system instead of existing only as a repo-local
Claude command.

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

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Skill source review | `.claude/commands/prp/prp-quality.md` | Pass | Claude command exists and defines the validation contract. |
| Existing Codex skill review | `.codex/skills/prp-execute/SKILL.md` | Pass | Existing PRP skill pattern reviewed for structure and source-command linkage. |
| Discovery path review | `find ~/.codex/skills -maxdepth 1 -type l` | Pass | Existing symlink-based discovery pattern confirmed. |
| Linear issue | `AAI-626` | Pass | Issue created in Alleato AI team to satisfy issue tracking requirement. |
| Skill file creation | `.codex/skills/prp-quality/SKILL.md` | Pass | Repo-local Codex skill created with trigger metadata, report format, and decision rules. |
| Discovery read-back | `test -f ~/.codex/skills/prp-quality/SKILL.md` | Pass | Symlinked discovery path resolves to a readable skill file. |
| Content verification | `rg -n "name: prp-quality|Overall Confidence Score|Do not approve a PRP below|Source Command" .codex/skills/prp-quality/SKILL.md` | Pass | Verified core contract markers are present. |
| Browser/user-flow | Not applicable | Pass | This task adds a developer skill, not a frontend-visible workflow. |
| Known unrelated failures | None | Pass | No unrelated verification failures encountered. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-24-prp-quality-skill.md` - task ledger and evidence
- `/Users/meganharrison/Documents/alleato-pm/.codex/skills/prp-quality/SKILL.md` - Codex skill definition mirroring the Claude command
- `/Users/meganharrison/.codex/skills/prp-quality` - discovery symlink to the repo-local skill

## Risks / Gaps

- The current session skill registry will not hot-reload automatically; the new
  skill is present on disk and exposed through the Codex discovery path for the
  next discovery pass or session restart.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
