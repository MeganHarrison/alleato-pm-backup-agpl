---
name: qa-task
description: Start and enforce the Alleato implementation-plus-independent-verification workflow for a new task, bug fix, feature, audit finding, or verification-only request. Use when the user wants Codex to implement work and prove it works without requiring repeated follow-up prompts.
---

# QA Task

Use this skill as the default entrypoint for new work that must be trustworthy at handoff. It covers implementation and QA together; it is not a test-only checklist.

## User contract

Interpret the user's request as the task intake. If they provide an assessment from another Codex session, treat it as discovery input and convert its findings into acceptance criteria. Do not treat another agent's narrative as proof that the work is complete.

Continue through the workflow without asking the user to repeat `continue`. Stop only with a genuinely complete result or an explicit `BLOCKED`, `FAIL`, or `INCONCLUSIVE` outcome.

## Required sequence

1. Classify the request:
   - Use the micro-change fast path only when it satisfies every exception in `AGENTS.md`.
   - Otherwise use the full task process.
2. For a full task, create `docs/ops/tasks/YYYY-MM-DD-<short-slug>.md` from `docs/ops/tasks/TASK-TEMPLATE.md` before implementation.
3. Define observable acceptance criteria, failure-loudly behavior, canonical owners, scope exclusions, and required verification evidence before editing product code.
4. Create a verification manifest from `scripts/templates/verification-manifest.example.json` before the browser verification pass.
5. Implement using the repository's existing shared abstractions and debugging gates.
6. Verify independently:
   - Functional verifier: fresh browser flow, persistence/readback, reload/edit behavior, and failure paths.
   - Visual verifier: desktop, tablet, mobile, responsive behavior, hierarchy, and design-system/noise-gate issues.
   - Evidence judge: independently review the result and evidence; the builder's completion narrative is not sufficient.
7. Store evidence under `tests/agent-browser-runs/<run>/` or another task-owned evidence directory and record exact paths in the task file and handoff.
8. Validate the contract:

```bash
npm run verify:contract -- \
  --manifest path/to/verification-manifest.json \
  --result path/to/verification-result.json \
  --root .
```

1. For full tasks, complete the required handoff and run the strict review-queue check:

```bash
npm run verify:review-queue -- --strict docs/ops/handoffs/<handoff>.md
```

1. Close through `codex:finish` with the manifest and result. Do not claim completion if required task items or evidence remain unchecked.

## Verification modes

### Implementation plus QA (default)

Use when the request contains new work, fixes, schedule-gap findings, design problems, or behavior that is not yet trusted. The builder may implement, but functional and visual verification must be separate passes.

### Verification-only

Use when the user says the implementation already exists and asks whether it works. Do not silently repair failures during the first pass. Record each failure with the failing flow, evidence, likely owner files, and whether it is related or unrelated repo debt. Create a follow-up implementation task for repairs unless the user explicitly asks for same-task remediation.

## Evidence rules

Require only evidence appropriate to the task, but never omit evidence for an observable claim. For user-facing or database-backed work, normally require:

- starting, completed, and resulting-state screenshots;
- browser action log and video when supported;
- database readback for persisted fields;
- reload/edit-prefill proof;
- negative-path or validation proof;
- independent visual review;
- durable regression coverage.

If a requirement cannot be proven, report `BLOCKED` or `INCONCLUSIVE`; do not downgrade the acceptance criterion or manufacture a PASS.

## Compact kickoff response

At the start, state the task classification, task-file path, verification mode, and the first observable acceptance criteria. Then work the task. At the end, report changed files, exact checks, evidence paths, final status, remaining risk, and next action.

## Non-negotiable closeout questions

- How does this fail loudly?
- What proves the requested outcome end to end?
- What prevents the discovered failure from recurring?
- Did an independent verifier review the evidence?
- Are unrelated failures explicitly separated from task failures?
