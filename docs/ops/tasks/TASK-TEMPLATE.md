# Task: <Short Title>

Status: In Progress
Owner: <Owner>
Created: YYYY-MM-DD
Task ID: <Linear issue or explicit local blocker ID>
Linear Issue: <ID and URL, or exact unavailable connector proof>
Related Handoff: `docs/ops/handoffs/YYYY-MM-DD-S<session>-<topic>.md`

## Objective

<One observable outcome.>

## Scope

- <Owned surface>
- <Explicit exclusion>

## Source of Truth

- Canonical runtime/data owner: <owner>
- Existing shared primitives/services: <paths>
- Deprecated or parallel paths: <paths or N/A>

Delivery lane: Standard

Verification contract: Optional

Use `High-risk` for migrations, auth/permissions, money, provider/deployment,
AI/RAG, external delivery, destructive operations, or cross-workflow changes.
High-risk tasks require `Verification contract: Required`; Standard tasks use
`Optional` and record the one proof appropriate to their changed boundary.

## Acceptance Criteria

- [ ] Requested behavior is observable end to end.
- [ ] Failure-loudly behavior is defined.
- [ ] Relevant existing guardrails are identified before implementation.
- [ ] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [ ] Files/modules to change are listed before edits.
- [ ] Shared abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [ ] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: <specific error/state>
- Detection path: <command, UI state, log, or metric>
- Recovery path: <actionable next action>

## Incident Learning

Use `N/A` only for work that did not discover or address a failure. Significant
bugs and repeated problems must reference an ID in
`docs/ops/learning/recurring-failures.yaml`.

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

Before creating a new fingerprint, search existing lessons:

```bash
node scripts/ops/learning-registry.mjs lookup --symptom "<symptom>" --files <owned-paths>
```

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |

## Remaining Risk

- <Risk, owner, and next action, or None>

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
