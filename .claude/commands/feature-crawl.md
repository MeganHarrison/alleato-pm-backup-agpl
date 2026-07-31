---
description: Supplemental Procore capture worker. Use only when deep crawl coverage is insufficient or when broader DOM/screenshot corpus is required.
argument-hint: "<feature-name> [--project-id <id>] [--app-url <url>] [--support-url <url>]"
---

# /feature-crawl - Supplemental Procore Capture

This is an optional worker command in the canonical Procore finalization workflow.

Primary workflow source:
`$PROJECT_ROOT/.claude/commands/workflow/procore-finalization-orchestrator.md`

## Runtime Root

```bash
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
```

## When to use

Use this command only if:
- `/procore-deep-crawl` fails quality gates, or
- additional screenshot/DOM coverage is needed for unresolved parity gaps.

Do not run by default when deep crawl output is already sufficient.

## Inputs

```bash
/feature-crawl <feature-name> [--project-id <id>] [--app-url <url>] [--support-url <url>]
```

If `--app-url` is omitted, derive from project id + feature route.

## Outputs

Primary supplemental outputs:
- `_bmad-output/planning-artifacts/<feature>/verification/runs/<run_id>/09-supplemental-crawl/`

Optional legacy mirror (non-canonical):
- `docs/project-mgmt/<feature>/...`

Canonical orchestrator references under:
- run-scoped `00-run-manifest.json`

The orchestrator must record where supplemental artifacts live and how they were used.

## Success Criteria

This worker succeeds only when:
- supplemental evidence resolves a concrete crawl coverage gap
- evidence paths are linked back to the run-scoped canonical verification artifact root
