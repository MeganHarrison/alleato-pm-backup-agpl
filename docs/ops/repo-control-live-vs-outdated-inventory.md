# Repo Control: Live vs Outdated Inventory

Created: 2026-06-22
Owner: Codex
Status: Active inventory

## Purpose

This inventory separates product runtime, generated artifacts, tests, agent
tooling, archives, and delete candidates. The goal is to stop agents from
treating every folder in the checkout as equally live.

## Classification Rules

| Class | Meaning | Default action |
| --- | --- | --- |
| Live product runtime | Required to run the app/backend/deployment today | Keep in place; guard with tests |
| Live operational tooling | Required scripts/config for deploy, verification, migrations, provider operations | Keep, but document owner |
| Generated artifact | Derived from source; should not be edited by hand | Keep if consumed; regenerate from source |
| Test source | Maintained specs/helpers/config | Keep under one canonical test root |
| Test artifact | Screenshots/videos/reports from runs | Keep short-term only; ignore or archive |
| Agent/tooling config | Claude/Codex/BMAD/skill infrastructure | Keep only if active; move behind a clear agent-tooling boundary |
| Archive/reference | Historical plans, PRPs, reports, screenshots | Move under `docs/archive/` or `artifacts/archive/` if retained |
| Delete candidate | No current imports/scripts/config references, no required evidence value | Delete after guardrail |

## Documentation Source Of Truth

`docs/alleato-os-docs/` is the canonical current documentation site. It is a
symlink to `/Users/meganharrison/Documents/github/alleato-os/apps/docs`.

Everything else under `docs/**` is working evidence, generated inventory,
operations control plane, report history, PRP/planning material, or archive
unless the docs site links to it as current evidence. Agents should not treat an
older plan or generated index as live product truth because it happens to exist
under `docs/`.

## Immediate Findings

### Test Folders And Screenshot Outputs

| Path | Current classification | Evidence | Recommended action |
| --- | --- | --- | --- |
| `frontend/tests` | Test source plus mixed artifacts | `frontend/package.json` Playwright scripts use `tests/e2e/**`; contains specs, helpers, reports, screenshots, auth | Keep specs/helpers/config; move artifacts out |
| `tests/agent-browser-runs` | Canonical runtime evidence sink, cleaned from git | AGENTS.md names this as required `agent-browser` output root; tracked artifacts removed | Keep ignored runtime evidence only; add retention policy |
| `frontend/tests/agent-browser-runs` | Removed duplicate artifact sink | 201 MB, ignored, 0 tracked before removal | Keep deleted; stop writing here |
| `frontend/e2e-screenshots` | Removed artifact sink | 23 MB, ignored, 0 tracked before removal | Keep deleted; use canonical artifact root |
| `e2e-screenshots` | Removed empty artifact sink | 0 bytes and untracked; removed 2026-06-22 | Keep deleted; do not recreate |
| `frontend/tests/e2e-screenshots` | Removed artifact sink | 29 MB, ignored, 0 tracked before removal | Keep deleted; use canonical artifact root |
| `frontend/tests/screenshots` | Removed legacy artifact sink | Screenshot outputs from older Playwright/manual scripts; 416 tracked files before removal | Keep deleted; keep specs separate from images |
| `verify-output` | Removed verification artifact sink | 4.2 GB, ignored, 0 tracked before removal | Keep deleted; use `docs/ops/evidence/` or external storage |

Current artifact debt measured by `npm run repo:control` on 2026-06-22:

- `verify-output`: 523 files on disk, 0 tracked; 4.2 GB on disk.
- `tests/agent-browser-runs`: removed from git/worktree cleanup after confirming contents were evidence artifacts; this path remains the ignored runtime output root for future browser verification.
- `frontend/tests/agent-browser-runs`: removed after confirming 0 tracked files; 201 MB before removal.
- `frontend/tests/screenshots`: removed after confirming it contained legacy screenshot artifacts; 421 files on disk and 416 tracked before removal.
- `frontend/tests/e2e-screenshots`: removed after confirming 0 tracked files; 29 MB before removal.
- `frontend/e2e-screenshots`: removed after confirming 0 tracked files; 23 MB before removal.
- `verify-output`: removed after confirming 0 tracked files; 4.2 GB before removal.
- `.extract-design-system`: removed after confirming no live references outside the repo-control guard; 2 tracked generated files before removal.
- `design-system`: removed after confirming no live references to root `design-system/tokens.*`; 2 tracked generated files before removal.
- `e2e-screenshots`: removed after confirming it contained only an empty nested
  UUID directory and no tracked files.
- 433 tracked files were removed from reviewed screenshot/evidence roots. This
  was cleanup debt, not live product code.

Canonical target:

- Source specs/helpers/config: `frontend/tests/**`
- Manual/browser evidence: `tests/agent-browser-runs/**`
- Temporary screenshots/videos/reports: ignored `artifacts/verification/**` or external storage

### Root Tooling And Agent Folders

| Path | Current classification | Evidence | Recommended action |
| --- | --- | --- | --- |
| `scripts` | Live operational tooling, but too broad | Root and frontend scripts call many entries; contains audits, ops, verify, dev-tools | Keep; add subfolder ownership README and dead-script guard |
| `tools` | Removed ignored local tooling | Contained only ignored Liveblocks MCP server, `node_modules`, and `.DS_Store`; zero tracked files | Keep deleted |
| `claude-memory-compiler-main` | Active Claude hook dependency | `.claude/settings.json` calls hooks in this folder on SessionStart/PreCompact/SessionEnd | Do not delete until hooks are replaced or disabled |
| `.claude/skills/**` | Agent tooling | Skills route tests and workflows; not product runtime | Keep behind `.claude`; add README that it is agent tooling |
| `.codex/skills/**` | Agent tooling | Includes `extract-design-system`; not product runtime | Keep behind `.codex`; do not let it imply app design source |
| `.extract-design-system` | Removed generated extraction artifact | Skill output; ignored by `.gitignore`; no live references outside repo-control guard | Keep deleted |
| `design-system` | Removed starter token artifact | Root token files were not imported by live app code | Keep deleted |

### Deprecated Docs Paths

| Path | Current classification | Evidence | Recommended action |
| --- | --- | --- | --- |
| `docs/index/` | Removed generated docs index | Replaced by docs-site navigation and `docs/README.md` | Keep deleted |
| `docs/pages-directory.md` | Removed generated page inventory | Replaced by `docs/architecture/PROJECT-MAP.md` and docs-site `reference/routes` | Keep deleted |
| `docs/infographic.png` / `docs/infographic2.png` | Removed loose docs image artifacts | No current docs-site page requires root-level copies | Keep deleted unless intentionally linked from the docs site |
| `docs/alleato-os-docs/index/` | Removed docs-site copy of old generated index | Not in `docs.json`; duplicated retired root `docs/index/` semantics | Keep deleted |

### Liveblocks

Liveblocks is retired from the live codebase.

Removal proof captured 2026-06-22:

- Removed Liveblocks API/auth/webhook routes:
  - `frontend/src/app/api/liveblocks-auth/route.ts`
  - `frontend/src/app/api/liveblocks/**`
- Removed Liveblocks runtime/config/helpers:
  - `frontend/src/lib/liveblocks/**`
  - `frontend/src/components/providers/liveblocks-app-provider.tsx`
  - `frontend/liveblocks.config.ts`
  - `frontend/liveblocks-otp.mjs`
  - `frontend/src/types/liveblocks.d.ts`
- Removed demo/example code:
  - `frontend/src/components/issue-tracker/**`
  - `frontend/src/components/liveblock/**`
  - `frontend/src/components/spreadsheet/**`
  - `frontend/src/app/(admin)/spreadsheet-demo/**`
  - Liveblocks dashboard seed specs.
- Removed Liveblocks notification adapters that were only called by the retired webhook.
- Moved reusable room/entity helpers to `frontend/src/lib/collaboration/rooms.ts`.
- Removed all `@liveblocks/*` dependencies from `frontend/package.json` and `frontend/pnpm-lock.yaml`.
- Regenerated app/project/DB inventories so deleted routes no longer appear in generated discovery files.
- `node scripts/audits/check-repo-control.mjs --strict` passes.
- Targeted stale-name scan has no hits outside the repo-control guard itself.

Recommended action:

1. Keep Liveblocks deleted.
2. Use Supabase/Velt collaboration paths for comments, notifications, cursors, and presence.
3. Treat any new `@liveblocks/*`, `/api/liveblocks*`, or `frontend/src/lib/liveblocks` reference as a regression.

## Concrete Cleanup Order

1. **Stop artifact sprawl**
   - Canonicalize screenshots/videos/reports under `tests/agent-browser-runs` for required evidence.
   - Keep old screenshot sinks deleted and let `tests/agent-browser-runs` be recreated only by verification runs.
   - Add a retention script or extend `npm run verify:browser:cleanup`.

2. **Boundary agent tooling**
   - Add `docs/ops/repo-control/README.md` or root `TOOLS.md` mapping `.claude`, `.codex`, `.agents`, `_bmad`, `skills`, and `claude-memory-compiler-main`.
   - Move active non-product root agent folders under a single `agent-tooling/` boundary only after hook paths are updated.

3. **Script ownership cleanup**
   - Keep `scripts`, but require each top-level script category to have an owner and `live/archive/delete-candidate` status.
   - Move stale one-off scripts to `scripts/archive/YYYY-MM-DD/` or delete after `rg` proof.

4. **Generated artifact policy**
   - Generated files must include source command in header or adjacent README.
   - Agents should prefer source files over generated inventories unless the task is discovery/search.

## Things Not To Delete Yet

- `claude-memory-compiler-main`: active Claude hooks reference it.
- `frontend/tests`: canonical test source root for frontend.
- `scripts`: live ops and verification commands are still used by package scripts and AGENTS workflows.

## Delete Candidates After Guardrail

- None from the originally named examples remain. Future cleanup should focus
  on script ownership and dated historical docs, not live product paths.

## Guardrail

The active machine-readable guardrail is:

```bash
npm run repo:control
```

It fails on unclassified tracked top-level paths and reports current cleanup
debt. It also fails if deleted generated artifact roots reappear. Strict
debt-blocking mode is available with:

```bash
node scripts/audits/check-repo-control.mjs --strict
```
