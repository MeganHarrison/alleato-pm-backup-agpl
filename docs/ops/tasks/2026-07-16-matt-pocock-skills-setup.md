# Task: Configure Matt Pocock Skills

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1084
Linear Issue: [AAI-1084](https://linear.app/megankharrison/issue/AAI-1084/configure-matt-pocock-skills-for-linear-and-multi-context-routing)
Related Handoff: `docs/ops/handoffs/2026-07-16-S153-matt-pocock-skills-setup.md`

## Objective

Apply the user-approved Matt Pocock skills configuration: Linear for Codex task
ownership, GitHub Issues for intake/backlog, canonical triage labels, and
multi-context documentation routing.

## Scope

- Update the existing `CLAUDE.md` agent-skills section.
- Add `docs/agents/{issue-tracker,triage-labels,domain}.md`.
- Add a root `CONTEXT-MAP.md` plus lightweight context entrypoints for frontend,
  backend, and agents.
- Do not alter the task workflow, tracker policy, or any product code.

Verification contract: Required — skills must receive one unambiguous
repository contract instead of silently choosing GitHub examples over Linear.

## Acceptance Criteria

- [x] The setup files identify Linear and GitHub's distinct roles precisely.
- [x] `to-spec`, `to-tickets`, and `triage` have explicit Linear-aware rules.
- [x] Context routing identifies the appropriate frontend, backend, or agent
  context without duplicating the root glossary.
- [x] Targeted static checks pass and evidence is recorded.

## Implementation Checklist

- [x] Existing configuration and skill templates inspected.
- [x] Tracker, labels, and context-layout choices approved by the user.
- [x] Approved files created or updated only in owned paths.
- [x] Linear milestone and handoff evidence recorded.

## Integration and Verification

- [x] Markdown/configuration checks pass.
- [x] Every context-map target exists.
- [x] Targeted search confirms no stale GitHub-as-task-tracker instruction in
  the new setup files.
- [ ] Screenshot evidence is attached to AAI-1084 before task acceptance.

## Failure-Loudly Contract

- Cause surfaced as: missing context-map target or conflicting tracker statement.
- Detection path: deterministic file-target and content assertions.
- Recovery path: correct the owned configuration document; do not silently infer
  a tracker from the Git remote.

## Incident Learning

- Failure fingerprint: `process.passive-incident-memory`
- Root cause: GitHub remote/backlog guidance and Linear Codex ownership rules
  were both present without a canonical skills-facing contract.
- Detection gap: setup files were absent, so skills inferred the tracker from
  the GitHub remote.
- Prevention: this explicit adapter documents the role split and context map.
- Guardrail evidence: targeted configuration assertions.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and approval recorded before edits. |
| Linear intake | AAI-1084 | Pass | Created before implementation. |
| Label read-back | Linear `Alleato AI` labels | Pass | Five approved labels were absent and created through the Linear connector. |
| Configuration contract | Focused Node assertion | Pass | Eight required files and five labels validated. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors in owned paths. |
| Handoff contract | `npm run linear:codex:check -- docs/ops/handoffs/2026-07-16-S153-matt-pocock-skills-setup.md` | Pass | Required Linear intake evidence is machine-valid. |
| Publish | `npm run codex:finish -- --allow-staged ...` | Pass | Commit `674cce1d6` is published to `origin/main`. |
| Canonical screenshot | GitHub rendered `CLAUDE.md#agent-skills` | Blocked | Browser is unauthenticated for the private repository; the GitHub 404 was rejected as wrong-surface evidence. |

## Remaining Risk

- Completion proof requires a viewable task-comment screenshot. The browser has
  no secure GitHub auth profile for this private repository, so the rendered
  artifact cannot currently be captured or attached. Owner: configured browser
  auth or a task-comment renderer. Next action: authenticate GitHub in the
  secure browser vault, capture `CLAUDE.md#agent-skills` at commit `674cce1d6`,
  and attach it to AAI-1084.

## Final Status

- [ ] All required checklist items are complete (blocked on the canonical screenshot).
- [x] Evidence is filled in.
- [x] Incident learning is linked: `process.passive-incident-memory` matched the
  pre-change lookup and its active process-contract gate is recorded.
