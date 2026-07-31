# QA Task Skill Entrypoint

Status: In Progress
Owner: Codex
Created: 2026-07-15
Task ID: QA-SKILL-2026-07-15
Linear Issue: Unavailable — no Linear connector was exposed in this session; local task ID is the explicit blocker ID.
Related Handoff: `docs/ops/handoffs/2026-07-15-S-qa-task-skill.md`

## Objective

Provide a reusable `/qa-task` Codex skill that starts the repository's implementation-plus-independent-verification process for a new task and never treats unverified work as complete.

## Scope

- Add the Codex-native QA task skill under `.codex/skills/qa-task/`.
- Document the canonical routing and invocation contract.
- Do not modify product code or unrelated worktree changes.

## Source of Truth

- Canonical verification contract: `docs/ops/verification/subagent-verification-contract.md`
- Task definition of done: `docs/ops/tasks/TASK-TEMPLATE.md`
- Closeout enforcement: `scripts/ops/codex-finish.mjs`

Verification contract: Not applicable — this change adds agent workflow documentation and instructions, not an observable product runtime outcome.

## Acceptance Criteria

- [x] `/qa-task` is discoverable as a repo-local Codex skill.
- [x] The skill distinguishes implementation-plus-QA from verification-only work.
- [x] The skill requires task metadata, acceptance criteria, independent verification, evidence, and honest non-pass outcomes.
- [x] The skill tells the agent to continue through the workflow without requiring repeated user prompts.
- [x] Routing documentation names the skill as the canonical entrypoint.

## Implementation Checklist

- [x] Create `.codex/skills/qa-task/SKILL.md`.
- [x] Update `docs/ops/skills-routing.md`.
- [x] Preserve unrelated worktree changes.

## Integration and Verification

- [x] Skill frontmatter and referenced paths are readable.
- [x] Focused Markdown lint passes with `--no-globs`; repository-wide lint remains blocked by pre-existing errors outside task-owned files.
- [x] Git diff check passes.

## Failure-Loudly Contract

- Cause surfaced as: explicit `BLOCKED`, `FAIL`, or `INCONCLUSIVE` status when required evidence or authority is unavailable.
- Detection path: task checklist, verification contract, review-queue strict check, and closeout command.
- Recovery path: produce the missing evidence, assign the independent reviewer, or document the exact external blocker and next action.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Skill discovery | `.codex/skills/qa-task/SKILL.md` | PASS | Valid frontmatter and canonical `/qa-task` name. |
| Focused Markdown lint | `npx markdownlint-cli2 --no-globs .codex/skills/qa-task/SKILL.md docs/ops/skills-routing.md docs/ops/tasks/2026-07-15-qa-task-skill.md` | PASS | 3 task-owned Markdown files lint clean. |
| Diff whitespace | `git diff --check` | PASS | No whitespace errors in the task diff. |

## Remaining Risk

- The skill can require independent verification but cannot itself spawn or semantically judge every verifier; runtime sub-agent availability remains an execution dependency.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
