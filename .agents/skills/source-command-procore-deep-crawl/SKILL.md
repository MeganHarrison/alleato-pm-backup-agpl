---
name: "source-command-procore-deep-crawl"
description: "Phase-2 worker for the Procore finalization orchestrator. Captures live Procore tool states and emits a structured manifest with crawl quality gates."
---

# source-command-procore-deep-crawl

Use this skill when the user asks to run the migrated source command `procore-deep-crawl`.

## Command Template

# /procore-deep-crawl <feature> [--project-id <id>]

Worker command for `CAPTURE_SOURCE_OF_TRUTH` in:
`$PROJECT_ROOT/.Codex/commands/workflow/procore-finalization-orchestrator.md`

## Runtime Root

```bash
PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
```

## Role in Canonical Workflow

- Phase owner: `CAPTURE_SOURCE_OF_TRUTH`
- Upstream dependency: `DISCOVER`
- Downstream dependency: `RECONCILE_MANIFEST`

## Required Inputs

- Feature slug (`<feature>`)
- Optional Procore project id (default `562949954728542`)
- Procore credentials in `.env`

## Required Outputs

Primary output:
- `.Codex/procore-manifests/<feature>/manifest.json`

Supporting evidence:
- `.Codex/procore-manifests/<feature>/screenshots/`
- `.Codex/procore-manifests/<feature>/reports/`

Orchestrator contract updates:
- Append evidence pointers into run-scoped `00-run-manifest.json`

## Execution

1. Run deep crawl:
```bash
cd "$PROJECT_ROOT/scripts/playwright-crawl"
node procore-deep-crawl.js <feature>
```

2. Validate quality gates:
- core states present: `list`, `create-form`, `detail`
- no critical state with both fields and columns empty
- no fatal capture notes preventing parity analysis
- manifest is parseable JSON

3. If quality gates fail:
- mark phase `blocked` in run manifest
- include root cause and missing states
- orchestrator may invoke `/feature-crawl <feature> [--project-id <id>]`

## Success Criteria

This worker succeeds only when:
- `manifest.json` exists and is parseable
- required core states are captured
- output is usable for reconciliation and gap analysis
