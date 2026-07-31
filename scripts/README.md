# Scripts Source Of Truth

Status: Active control plane
Owner: Ops/dev tooling
Last updated: 2026-06-22

Use this file before treating a script path as live implementation. `scripts/`
contains active operational tooling, verification commands, one-off historical
imports, and local tool sandboxes. Package scripts in the root `package.json`
are the strongest signal that a script is live.

## Live Category Folders

| Path | Status | Owner | Notes |
| --- | --- | --- | --- |
| `scripts/agent-browser/` | Live verification tooling | Browser verification | Root `verify:browser*` scripts call this. Runtime output belongs in `tests/agent-browser-runs/`. |
| `scripts/archive/` | Archived script helpers | Ops/dev tooling | Dated archive for preserved one-off helpers that should not look like live root entry points. |
| `scripts/audits/` | Live guardrails/audits | Repo quality | Includes `check-repo-control.mjs` and architecture/design/dead-code audits. |
| `scripts/build/` | Live build helpers | Release/build | Non-production route control and production-build helpers. |
| `scripts/cli/` | Live operator CLI helpers | Ops/RAG | RAG query/stats and Codex helper shell entry points. |
| `scripts/database/` | Live database tooling | Database | Schema audits, RAG database moves, and database support scripts. |
| `scripts/db/` | Live database verification | Database | Focused DB atomic verification scripts. |
| `scripts/dev/` | Live local dev startup | Dev environment | Root `dev:*` scripts call these. |
| `scripts/dev-tools/` | Live generated inventory tooling | Dev tools | Generates project map, DB inventory, page/schema FK map, and docs reference. |
| `scripts/docs/` | Live docs generation/validation | Docs | App expert artifacts and help-system docs checks. |
| `scripts/ingestion/` | Live RAG/source ingestion helpers | AI/RAG | Local document, SharePoint, and project-assignment ingestion utilities. |
| `scripts/langfuse/` | Live eval dataset tooling | AI evals | Dataset sync support. |
| `scripts/lint-staged/` | Live lint-staged helpers | Quality | Changed-line ESLint filtering. |
| `scripts/ops/` | Live operational commands | Ops | Codex finish, Linear comments, Render cron suspension, worker status. |
| `scripts/perf/` | Live performance checks | Performance | Project-home speed checks. |
| `scripts/seed-db/` | Live seed/fixture tooling | Test data | Smoke fixtures and test seed data. |
| `scripts/templates/` | Live reusable templates | Verification/docs | Templates for repeatable tool runs. |
| `scripts/testing/` | Test support | Verification | Keep only maintained specs/helpers. |
| `scripts/verify/` | Live verification scripts | Verification/AI/RAG/Ops | Root `verify:*` and `rag:verify:*` scripts call this heavily. |

## Tool Sandboxes And Reference Folders

These folders are allowed, but they are not product runtime:

| Path | Status | Rule |
| --- | --- | --- |
| `scripts/adversarial-harness/` | Tool sandbox | Keep source/config; never commit `node_modules/`, generated workspace, or lockfile churn unless intentionally updating the sandbox. |
| `scripts/dev-bridge/` | Tool sandbox | Keep source/config only. |
| `scripts/feature-tracker/` | Historical tracker/tool sandbox | Treat DB/exports as reference until a package script or owner makes it live. |
| `scripts/jobplanner/` | Import/reconcile helpers | Keep while JobPlanner import work remains relevant. |
| `scripts/mcp-servers/` | Local MCP tooling | Keep source/config only; never commit nested `node_modules/`. |
| `scripts/monitoring/` | Legacy monitoring helpers | Review before use; prefer current `ops` and `verify` checks when possible. |
| `scripts/playwright-crawl/` | Procore crawl toolkit | Keep crawler source/config; runtime outputs belong outside `scripts/`. |
| `scripts/visual-audit/` | Visual audit toolkit | Keep source/config; runtime output belongs outside `scripts/`. |

## Legacy Root Scripts

Root-level files directly under `scripts/` are legacy operational entry points.
Do not add new root-level scripts by default. Put new scripts in the owner
folder above and wire them through `package.json` when they are intended to be
live.

Root-level files are inventoried in [`ROOT-SCRIPTS.md`](./ROOT-SCRIPTS.md).
`repo:control` fails when a tracked root-level script is missing from that
inventory.

Before deleting a root script:

1. Check root `package.json`, `frontend/package.json`, docs, and CI references.
2. Check recent task ledgers and handoffs.
3. Move irreplaceable evidence to `docs/ops/evidence/`; do not keep runtime
   output in `scripts/`.

## Deleted Generated Roots

These are not source code and should stay deleted:

| Path | Replacement |
| --- | --- |
| `scripts/**/node_modules/` | Reinstall locally when needed. |
| `scripts/**/__pycache__/` | Python runtime cache; never source. |
| `scripts/**/.DS_Store` | macOS metadata; never source. |
| `scripts/adversarial-harness/workspace/` | Local sandbox runtime output. |
| `scripts/change-events-crawl/html/` | Retired crawl evidence; use `docs/ops/evidence/` if retained. |
| `scripts/change-events-crawl/screenshots/` | Retired crawl screenshots; use `docs/ops/evidence/` if retained. |
| `scripts/change-events-crawl/crawl-report.md` | Retired crawl report; use `docs/ops/evidence/` if retained. |
| `scripts/playwright-crawl/outputs/` | Runtime crawl output; use `tests/agent-browser-runs/` or `docs/ops/evidence/`. |
| `scripts/visual-audit/output/` | Runtime visual audit output; use `docs/ops/evidence/` if retained. |

## Guardrail

Run from the repo root:

```bash
npm run repo:control
```

The guard fails if deleted script artifact roots return or if a new tracked
`scripts/<category>/` directory is added without classification in this README
and `scripts/audits/check-repo-control.mjs`.
