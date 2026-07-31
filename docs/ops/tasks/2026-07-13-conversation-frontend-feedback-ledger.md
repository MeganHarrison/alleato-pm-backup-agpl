# Task: Conversation Frontend Feedback Ledger

Status: In Progress
Owner: Codex
Created: 2026-07-13
Task ID: AAI-1063
Linear Issue: AAI-1063 https://linear.app/megankharrison/issue/AAI-1063/build-a-conversation-derived-frontend-design-feedback-ledger-for-codex
Related Handoff: `docs/ops/handoffs/2026-07-13-S140-conversation-frontend-feedback-ledger.md`

## Objective

Create a repo-local ledger that turns repeated Codex and Claude frontend/design corrections into reusable implementation and audit rules.

## Scope

- Repo-local frontend conversation feedback data, lookup tooling, and skill routing
- Seed the ledger with the existing copy-shortening rule for overly wordy "View all..." UI copy
- Excludes retroactive mining of old conversations beyond the seeded rule and excludes runtime product feedback inbox behavior

## Source of Truth

- Canonical runtime/data owner: `docs/ops/design-feedback/frontend-conversation-feedback.json`
- Existing shared primitives/services: `scripts/ops/frontend-feedback-ledger.mjs`, `.codex/skills/frontend-conversation-feedback/SKILL.md`
- Deprecated or parallel paths: product feedback inbox and `admin_feedback_items` tracking are adjacent but not the owner for Codex/Claude conversation-derived frontend rules

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: invalid ledger schema, duplicate IDs, invalid categories/severity/status, bad timestamps, or missing lookup inputs
- Detection path: `node scripts/ops/frontend-feedback-ledger.mjs validate` and focused tests
- Recovery path: correct the ledger entry or CLI inputs, re-run validation, then re-run the lookup command for the target request/path set

## Incident Learning

Use `N/A` only for work that did not discover or address a failure. Significant
bugs and repeated problems must reference an ID in
`docs/ops/learning/recurring-failures.yaml`.

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: `scripts/__tests__/frontend-feedback-ledger.test.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured for S140. |
| CLI parse | `node --check scripts/ops/frontend-feedback-ledger.mjs` | Pass | Script parses cleanly. |
| Ledger validation | `node scripts/ops/frontend-feedback-ledger.mjs validate` | Pass | Validated 1 frontend conversation feedback entry. |
| Rule lookup | `node scripts/ops/frontend-feedback-ledger.mjs lookup --text 'view all too wordy' --files 'frontend/src/app/(main)/[projectId]/home/project-command-center.tsx'` | Pass | Returned seeded `copy.short-view-all-cta` rule. |
| Focused tests | `node --test scripts/__tests__/frontend-feedback-ledger.test.mjs` | Pass | 4/4 tests passed. |

## Remaining Risk

- Historical conversation capture is still manual. Owner: future follow-up. Next action: add an importer or structured note path for new Codex/Claude UI feedback as it is produced.
- Publish to `main` is still pending. Owner: Codex. Next action: finish staged publish once the owned file set is clean.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
