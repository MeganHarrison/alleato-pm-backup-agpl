# Repo Control Source Of Truth

Created: 2026-06-22
Owner: Codex
Status: Active control plane

## Purpose

This directory is the source of truth for what is live code, what is operational
tooling, what is generated output, and what is stale cleanup debt. Agents should
check this before treating a root folder as product runtime.

## Canonical Product Roots

| Path | Status | Owner | Notes |
| --- | --- | --- | --- |
| `frontend/` | Live product runtime | Product app | Next.js app, frontend API routes, frontend test source under `frontend/tests`. |
| `backend/` | Live product runtime | FastAPI backend | Render backend runtime and native ingestion/vectorization services. |
| `supabase/` | Live database control plane | Database | Migrations and local Supabase config. |
| `teams-app/` | Live integration surface | Teams integration | Keep while Teams app packaging/deployment remains active. |
| `render.yaml` / `backend/render.yaml` | Live deployment config | Render | Render is the backend production host. Railway assumptions are stale. |

## Canonical Operations Roots

| Path | Status | Owner | Notes |
| --- | --- | --- | --- |
| `scripts/` | Live operational tooling | Ops/dev tooling | Too broad, but active. Prefer adding ownership docs before deleting script categories. |
| `docs/ops/` | Live operational evidence | Codex/ops | Tasks, handoffs, orchestration, evidence, and this control plane. |
| `docs/alleato-os-docs/` | Canonical current docs site | Docs/product/engineering | Symlink to `/Users/meganharrison/Documents/github/alleato-os/apps/docs`; use for current product, architecture, operations, and Project Intelligence docs. |
| `tests/agent-browser-runs/` | Canonical browser evidence sink | Verification | Required evidence output for `agent-browser`; keep recent runs only. |

## Documentation Source Of Truth

Current published documentation lives under `docs/alleato-os-docs/`. The rest of
`docs/**` is a working evidence/control-plane tree unless the docs site links to
it as source evidence.

Use this rule when agents disagree:

1. Product, architecture, operations, API, and Project Intelligence guidance:
   start in `docs/alleato-os-docs/`.
2. Task status, handoffs, repo cleanup evidence, generated inventories, and
   reports: use the relevant `docs/ops/**`, `docs/architecture/**`, or
   `docs/reports/**` file as evidence, not as current product prose.
3. Old generated docs indexes and loose image/page artifacts should stay
   deleted; they make historical/generated material look active.

## Agent Tooling Boundary

These paths are agent/tooling infrastructure, not product runtime:

| Path | Status | Notes |
| --- | --- | --- |
| `.claude/` | Active agent config | Includes skills and hooks. |
| `.codex/` | Active agent config | Includes Codex skills. |
| `.agents/` | Active agent config | Shared agent skills/config. |
| `_bmad/` | Active method/tooling | BMAD agents and workflows. |
| `_bmad-output/` | Planning/reference output | Treat as reference, not runtime. |
| `claude-memory-compiler-main/` | Active Claude hook dependency | `.claude/settings.json` calls it; do not delete until hooks are replaced. |
| `skills/` / `skills-lock.json` | Agent tooling | Treat as tooling, not product runtime. |

## Generated And Artifact Roots

These paths are not live product code. They should either be ignored, retained
with short retention, moved to archive, or deleted after proof.

| Path | Status | Action |
| --- | --- | --- |
| `verify-output/` | Removed generated verification sink | Keep deleted; use `docs/ops/evidence/` or external storage for retained proof. |
| `frontend/e2e-screenshots/` | Removed legacy screenshot sink | Keep deleted; use `tests/agent-browser-runs/` for browser evidence. |
| `frontend/tests/e2e-screenshots/` | Removed legacy screenshot sink | Keep deleted; use `tests/agent-browser-runs/` for browser evidence. |
| `frontend/tests/screenshots/` | Removed legacy screenshot sink | Keep deleted; use `tests/agent-browser-runs/` or `docs/ops/evidence/`. |
| `frontend/tests/agent-browser-runs/` | Removed duplicate browser evidence sink | Keep deleted; use `tests/agent-browser-runs/`. |
| `e2e-screenshots/` | Removed legacy screenshot sink | Keep deleted; do not recreate. |
| `.extract-design-system/` | Removed generated design extraction output | Keep deleted; not a live app design source. |
| `design-system/` | Removed generated starter token output | Keep deleted; live design-system code is under `frontend/src/`. |
| `docs/index/` | Removed generated docs index | Keep deleted; use `docs/alleato-os-docs` navigation and `docs/README.md`. |
| `docs/pages-directory.md` | Removed generated page inventory | Keep deleted; use `docs/architecture/PROJECT-MAP.md` or docs-site `reference/routes`. |
| `docs/infographic.png` / `docs/infographic2.png` | Removed loose docs image artifacts | Keep deleted unless an image is intentionally linked from the docs site. |
| `sitemap-grouped.png` | Generated visual artifact | Retained only as a generated sitemap visual, not product runtime. |
| `logs/`, `tmp/`, `output/` | Local/generated output | Not product runtime. |

## Liveblocks Status

Liveblocks is retired from the live codebase. Use Supabase/Velt collaboration
paths for comments, notifications, cursors, and presence. New Liveblocks
runtime paths, API routes, config files, dashboard seed specs, or
`@liveblocks/*` dependencies are regressions.

## Guardrail

Run:

```bash
npm run repo:control
```

The guard verifies that every tracked top-level path is classified here, fails
if deleted artifact/generated roots reappear, and reports current cleanup debt.
Use strict mode only when converting reported debt into a blocking gate:

```bash
node scripts/audits/check-repo-control.mjs --strict
```
