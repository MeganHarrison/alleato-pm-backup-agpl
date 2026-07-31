# Handoff: 2026-07-13 — Eve agent layout normalization

## Intake Block

1) Session ID: S137
2) Task ID: `docs/ops/tasks/2026-07-13-eve-agent-layout-normalization.md`
3) Linear issue: Blocked - connector reauthentication required
4) Linear URL: Unavailable - `mcp__codex_apps__linear._save_issue` returned `UNAUTHORIZED` / `oauth_token_invalid_grant`
5) Current status: Partial
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/package.json`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/agent.ts`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/instructions.md`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/channels/eve.ts`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/lib/app-help-articles.ts`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/tools/agent.ts`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/tools/bash.ts`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/tools/search_app_help.ts`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/tools/web_fetch.ts`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/tools/web_search.ts`; `/Users/meganharrison/Documents/github/project-management/agents/app-expert-eve-lab/agent/tools/write_file.ts`; `/Users/meganharrison/Documents/github/project-management/package.json`; `/Users/meganharrison/Documents/github/project-management/package-lock.json`; `/Users/meganharrison/Documents/github/project-management/pnpm-workspace.yaml`; `/Users/meganharrison/Documents/github/project-management/scripts/dev/eve.sh`; `/Users/meganharrison/Documents/github/project-management/scripts/verify/verify_eve_app_help_agent.mjs`; `/Users/meganharrison/Documents/github/project-management/docs/architecture/AGENT-SDK-MAP.md`; `/Users/meganharrison/Documents/github/project-management/docs/architecture/ALLEATO-SYSTEM-MAP.md`; `/Users/meganharrison/Documents/github/project-management/docs/architecture/EVE-MIGRATION-ASSESSMENT.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-13-eve-agent-layout-normalization.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S137-eve-agent-layout-normalization.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/orchestration/session-board.md`
7) Commands run and outcome (pass/fail counts): Eve docs audit pass; repo path/reference audit pass; Linear issue creation fail with connector auth error; `bash -n scripts/dev/eve.sh` pass; `npm install --workspace agents/app-expert-eve-lab` pass with expected Node 24 warnings; `npm install --package-lock-only --ignore-scripts` pass with expected Node 24 warnings; `npm run verify:eve-app-help-agent` pass; `npm run eve -- info` pass
8) Evidence artifacts (screenshot/video/report/log paths): task ledger in `docs/ops/tasks/2026-07-13-eve-agent-layout-normalization.md`
9) Top 3 findings (frontend-visible issues first):
 - The repo has two competing Eve conventions: root `agent/` for the App Expert lab and `agents/*` for other Eve packages.
 - Eve docs support one package per agent with an internal `agent/` surface, which matches `agents/<name>/agent/` and not the root special case.
 - Linear issue creation is currently blocked by connector reauthentication, so this cleanup needs local task evidence until auth is restored.
10) Recommended next action (one line): Publish the normalized Eve layout once the unrelated checkout dirt is isolated and the Linear connector is reauthenticated.
11) Handoff file path: `docs/ops/handoffs/2026-07-13-S137-eve-agent-layout-normalization.md`
12) Migration ledger evidence: N/A

## Current Status

Implementation completed locally and verified. The repo now uses a single Eve
collection pattern at `agents/<name>/`, and the App Expert Eve lab itself uses
the nested Eve-authored `agent/` directory.

## Exact Next Step

Publish the change set once the shared dirty checkout is isolated enough to land
only the owned files.

## Known Pitfalls

- Do not reintroduce a special-cased root `agent/` package; the canonical
  pattern is now `agents/<name>/agent/`.
- Do not widen this into backend Python `backend/src/services/agents/**`
  cleanup; that is a separate runtime family.
- Historical evidence docs still mention the old root path; those are retained
  records, not live source-of-truth docs.
- Do not claim the task is fully complete until the change is published or a
  reviewer explicitly accepts the local-only partial state.

## Evidence

- `agents/github-pr-triage/node_modules/eve/docs/reference/project-layout.md`
- `agents/github-pr-triage/node_modules/eve/docs/README.md`
- `bash -n scripts/dev/eve.sh`
- `npm install --workspace agents/app-expert-eve-lab`
- `npm install --package-lock-only --ignore-scripts`
- `npm run verify:eve-app-help-agent`
- `npm run eve -- info`
