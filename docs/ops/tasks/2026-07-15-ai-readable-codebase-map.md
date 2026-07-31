# AI-Readable Codebase Map

Status: Complete
Owner: Codex
Created: 2026-07-15
Task ID: LOCAL-AI-CONTEXT-MAP-2026-07-15
Linear Issue: Unavailable in this session; no Linear connector/tool is configured. Local task ID is the ownership record.
Related Handoff: `docs/ops/handoffs/2026-07-15-S-ai-readable-codebase-map.md`

## Objective

Provide one maintained, repository-local explanation of how AI agents understand the codebase, plus deterministic commands that regenerate and check the cross-layer architecture map.

## Scope

- Add a generated cross-layer system map that links runtime layers, routes, APIs, AI tools, database metadata, and canonical documentation.
- Add a markdown guide explaining AI context loading order and maintenance commands.
- Do not move architecture truth into Postgres or modify product runtime behavior.

## Source of Truth

- Canonical surface generators: `scripts/dev-tools/generate-project-map.mjs` and `scripts/dev-tools/generate-db-inventory.mjs`.
- Canonical database metadata: `docs/architecture/tables.yaml`.
- Canonical domain/runtime guidance: `CONTEXT.md`, `AGENTS.md`, and `docs/architecture/ALLEATO-SYSTEM-MAP.md`.
- Deprecated or parallel paths: none introduced by this task.

Verification contract: Required

## Acceptance Criteria

- [x] A deterministic system-map generator produces Markdown and JSON artifacts.
- [x] A single guide explains how AI agents should read the repository and how each artifact is maintained.
- [x] `--check-only` detects stale generated artifacts with a specific recovery command.
- [x] Existing project-map and database-inventory ownership remains intact.
- [x] Targeted checks and evidence are recorded.

## Implementation Checklist

- [x] Files/modules to change are listed before edits: generator, package scripts, system-map guide, task, handoff.
- [x] Shared existing generators are consumed rather than duplicated.
- [x] Errors identify the stale artifact and exact update command.
- [x] No database/provider/auth/runtime contract changes are introduced.

## Integration and Verification

- [x] Targeted generator regeneration passes.
- [x] `--check-only` passes after regeneration.
- [x] Markdown validation passes for task-owned Markdown.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `SYSTEM MAP GATE — generated artifacts are stale`.
- Detection path: `npm run map:system -- --check-only`.
- Recovery path: `npm run map:system` followed by `npm run map:system -- --check-only`.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: The generator's check-only mode can run in CI/pre-commit.
- Guardrail evidence: Pending targeted verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope captured before implementation. |
| System map generation | `npm run map:system` | Pass | Wrote Markdown and JSON artifacts. |
| System map drift gate | `npm run map:system -- --check-only` | Pass | Generated artifacts are current. |
| Existing project map drift gate | `npm run map:project -- --check-only` | Inconclusive in current checkout | The committed project map was refreshed for this task, but an unrelated untracked `frontend/src/app/(main)/ai-dashboard/` route now makes the working-tree check stale. The unrelated route owner must regenerate its own surface map. |
| Pre-commit guardrail syntax | `sh -n .husky/pre-commit-project-map` | Pass | Hook now checks the cross-layer system map when architecture inputs change. |
| CI guardrail wiring | `.github/workflows/guardrail-pr-check.yml` | Pass | Added project-map and system-map freshness checks to the PR guardrail job. |
| Independent verification contract | `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/verification-manifest.json` | Pass | Contract passed with independent review evidence. |
| Independent verification result | `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/verification-result.json` | Pass | Independent verifier approved the corrected staged artifacts. |
| Viewable artifact | `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/system-map-artifact.png` | Pass | Screenshot of the generated system map captured and visually reviewed. |
| Task comment | `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/TASK-COMMENT.md` | Pass | Screenshot is linked from the durable task-comment artifact. |
| Markdown validation | `npx markdownlint-cli2 --no-globs docs/architecture/AI-READABLE-CODEBASE.md docs/architecture/SYSTEM-MAP.md docs/ops/tasks/2026-07-15-ai-readable-codebase-map.md docs/ops/handoffs/2026-07-15-S-ai-readable-codebase-map.md` | Pass | 0 errors. |

## Remaining Risk

- Curated ownership and domain metadata can still become stale if maintainers do not update the source documents. The generated gate detects structural drift, not semantic drift.
- Task-owned implementation files are published at commits `8982daa40` and `4b5f52bbf`; the durable task-comment artifact links the viewable screenshot and independent review.

## Final Status

- [x] All implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Required task-comment screenshot/artifact is attached and task-owned files are published.
