---
name: procore-fix
description: Phase-5 worker for the Procore finalization orchestrator. Resolves prioritized gaps from the normalized task list with verification and status updates.
---

# /procore-fix <feature> [--task-id <id>] [--max-items <n>]

Worker command for `REMEDIATE` in:
`$PROJECT_ROOT/.claude/commands/workflow/procore-finalization-orchestrator.md`

## Runtime Root

```bash
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
```

## Role in Canonical Workflow

- Phase owner: `REMEDIATE`
- Upstream dependency: `GAP_ANALYZE`
- Downstream dependency: `VERIFY_IMPLEMENTATION`

## Required Inputs

- Task list:
  - run-scoped `06-task-list.json`
- Verification report:
  - run-scoped `05-verification-report.json`

Optional:
- `--task-id` for targeted remediation
- `--max-items` to cap work in one run

## Selection Policy

Default priority order:
1. `critical`
2. `high`
3. `medium`
4. `low`

Within same severity, resolve dependency-safe tasks first.

## Concurrency and Locks

Before work starts, claim lock:
- `.claude/locks/<feature>/<run_id>/<task_id>.lock`

Lock payload must include:
- session id
- owner
- started timestamp
- heartbeat timestamp

Do not process tasks with active locks owned by other sessions.

## Required Outputs

- Update task status in `06-task-list.json`
- Keep finding status synchronized in `05-verification-report.json`
- Append remediation details to `07-remediation-log.md`
- Add evidence pointers (tests, screenshots, notes) to run manifest

## Execution Steps

1. Select next runnable task(s).
2. Implement fix with minimal safe scope.
3. Run quality checks.
4. Run focused verification for changed behavior.
5. Mark task `resolved`, `blocked`, or `waived` (with required waiver metadata).
6. Release lock.

## Success Criteria

This worker succeeds only when:
- all processed tasks have updated status + evidence
- no silent task mutation outside the normalized task schema
- unresolved `critical/high` items are explicitly blocked with root cause
