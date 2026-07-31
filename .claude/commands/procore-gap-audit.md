---
name: procore-gap-audit
description: Phase-4 worker for the Procore finalization orchestrator. Reconciles corrected Procore manifest against Alleato implementation and emits normalized gap/task artifacts.
---

# /procore-gap-audit <feature>

Worker command for `GAP_ANALYZE` in:
`$PROJECT_ROOT/.claude/commands/workflow/procore-finalization-orchestrator.md`

## Runtime Root

```bash
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
```

## Role in Canonical Workflow

- Phase owner: `GAP_ANALYZE`
- Upstream dependency: `RECONCILE_MANIFEST`
- Downstream dependency: `REMEDIATE`

## Source of Truth Order

1. `03-corrected-manifest.json` (primary)
2. Live Procore verification evidence
3. Alleato implementation code

Never audit from stale specs alone.

## Required Inputs

- Feature slug (`<feature>`)
- Corrected manifest:
  - run-scoped `_bmad-output/planning-artifacts/<feature>/verification/runs/<run_id>/03-corrected-manifest.json`
- Implementation code paths:
  - `frontend/src/app/(main)/[projectId]/<feature>/`
  - `frontend/src/app/api/projects/[projectId]/<feature>/`
  - `frontend/src/hooks/use-<feature>*`
  - `frontend/src/types/database.types.ts`

## Required Outputs

Human-readable report:
- `04-gap-analysis-report.md`

Machine-readable reports:
- `05-verification-report.json`
- `06-task-list.json`

## Normalized Finding Schema Requirements

Every non-passing finding must include:
- `gap_id`
- `layer` (`db|api|ui|workflow|tests`)
- `severity` (`critical|high|medium|low`)
- `status` (`open|resolved|blocked|waived`)
- `spec_ref`
- `code_ref`
- `evidence`

Every task must map to `gap_id`.

## Execution Pattern

1. Read corrected manifest.
2. Compare DB/API/UI/workflow parity against implementation.
3. Produce strict `present|partial|missing` outcomes with evidence.
4. Build prioritized remediation tasks (critical/high first).
5. Write both markdown and JSON outputs.
6. Validate cross-artifact invariants before phase pass.

## Success Criteria

This worker succeeds only when:
- all non-passing findings have `gap_id`
- `06-task-list.json` covers every unresolved finding
- outputs are sufficient for autonomous remediation without ambiguity
