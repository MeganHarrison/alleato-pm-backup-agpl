# AI-Readable Codebase Map Handoff

Status: Pending Review
Owner: Codex
Task: `docs/ops/tasks/2026-07-15-ai-readable-codebase-map.md`
Linear: Unavailable in this session; local task ID `LOCAL-AI-CONTEXT-MAP-2026-07-15`

## Scope

Add a generated cross-layer architecture map and a guide for AI context loading and maintenance.

## Changed Files

- `scripts/dev-tools/generate-system-map.mjs`
- `package.json`
- `docs/architecture/AI-READABLE-CODEBASE.md`
- `docs/architecture/SYSTEM-MAP.md`
- `docs/architecture/generated/system-map.json`
- `docs/ops/tasks/2026-07-15-ai-readable-codebase-map.md`
- `docs/ops/handoffs/2026-07-15-S-ai-readable-codebase-map.md`
- `.husky/pre-commit-project-map`
- `.github/workflows/guardrail-pr-check.yml`
- `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/verification-manifest.json`
- `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/verification-result.json`
- `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/independent-review.md`
- `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/system-map-artifact.png`
- `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/TASK-COMMENT.md`
- Existing generated project-map outputs were refreshed because the checkout had pre-existing route-surface drift: `docs/architecture/PROJECT-MAP.md` and `frontend/src/lib/app-surface/app-surface.generated.json`.

## Evidence

- `npm run map:system` — pass.
- `npm run map:project -- --check-only` — pass.
- `npm run map:system -- --check-only` — pass.
- Targeted markdownlint with `--no-globs` — pass, 0 errors.
- Independent verifier found and prompted correction of broad counts, literal newline output, and unrelated working-tree project-map drift; those issues were corrected before re-review.
- Independent verifier re-review — pass; counts, newline output, generator syntax, hook behavior, and staged diff approved. Untracked AI-dashboard project-map drift classified as unrelated.
- Viewable artifact captured at `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/system-map-artifact.png` and visually reviewed.
- Durable task-comment artifact added at `docs/ops/evidence/2026-07-15-ai-readable-codebase-map/TASK-COMMENT.md`.

## Risks

- Existing unrelated drawing QA files remain untouched. The project-map generated outputs were refreshed only because the existing gate proved stale and the system map consumes them.
- The separate untracked AI-dashboard project-map drift remains outside this task.

## Next Step

Task is published and ready for review; accept the handoff after linking the local task-comment artifact in the external task tracker if one becomes available.
