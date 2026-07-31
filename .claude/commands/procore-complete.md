---
name: procore-complete
description: Canonical autonomous orchestrator for finalizing a Procore tool implementation using one normalized workflow with parallel subagents and strict gates.
---

# /procore-complete <feature> [--mode full|fast|retest] [--auto] [--project-id <id>] [--max-fix-loops <n>] [--allow-stale-artifacts] [--strict-retest]

Run the canonical Procore implementation finalization workflow end to end.

## Workflow Source of Truth

Resolve project root at runtime:

```bash
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
```

Always execute this workflow definition:

`$PROJECT_ROOT/.claude/commands/workflow/procore-finalization-orchestrator.md`

If any older command or skill text conflicts with that file, the orchestrator workflow file wins.

## Execution Contract

1. Parse args and initialize run context.
2. Execute canonical phases in order:
   - `INIT_COMMAND`
   - `DISCOVER` (parallel subagents)
   - `CAPTURE_SOURCE_OF_TRUTH`
   - `RECONCILE_MANIFEST`
   - `GAP_ANALYZE` (parallel subagents)
   - `REMEDIATE` (autonomous fix loop)
   - `VERIFY_IMPLEMENTATION`
   - `FINALIZE_AND_REPORT`
3. Persist outputs under run-scoped root:
   - `_bmad-output/planning-artifacts/<feature>/verification/runs/<run_id>/`
4. Update pointer:
   - `_bmad-output/planning-artifacts/<feature>/verification/latest.json`
5. Enforce completion gate:
   - `critical = 0`
   - `high = 0`
   - required verification flows pass
   - quality checks pass

## Parallel Subagent Policy

Use parallel subagents wherever tasks are independent:
- Discovery lanes (codebase vs Procore reference)
- Gap analysis lanes (db/api/ui)
- Remediation workers for non-overlapping write scopes

Do not parallelize live browser actions that share one session.

## Autonomous Policy

Default behavior is autonomous.

Do not pause for confirmation between phases unless a destructive operation or true ambiguity requires explicit human input.

## Required Final Output

At completion, produce and report:
- `release-readiness.json`
- `08-final-summary.md`

Include:
- before/after completion percentages
- resolved vs remaining items by severity
- blockers or waivers with owner/date/approver/rationale
