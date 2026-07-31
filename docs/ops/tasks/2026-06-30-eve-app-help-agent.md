# Task: Eve App Help Agent

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: Not created - Linear issue creation tool unavailable in this session; only comment/document tools are exposed.
Related Handoff: N/A

## Objective

Turn the Eve scaffold into a usable read-only Alleato App Expert agent that can answer workflow and feature-status questions from the curated local help article corpus.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked, with evidence filled in. If any required item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing Eve docs and current agent files reviewed.
- [x] Existing help/app-expert article corpus identified before adding new source material.
- [x] Source-of-truth owner chosen: `backend/src/services/agents/app_expert/runtime/help/articles/*.mdx`.
- [x] Deprecated or bypassed paths identified: generic placeholder prompt and broad default harness tools.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- Eve agent instructions identify the agent as an Alleato App Expert and require source-grounded answers.
- A read-only `search_app_help` tool searches curated help articles and returns citations with path, title, excerpt, and route metadata.
- The agent disables broad default side-effect surfaces that are not needed for app-help answering.
- Verification fails loudly when the app help corpus is missing, empty, or does not return expected workflow articles.
- `npm run eve -- info` compiles the agent with the new tool and disabled defaults.
- No unrelated local `agents/` changes are staged or modified.

## Files To Change

- `agent/instructions.md` - replace placeholder prompt with App Expert behavior.
- `agent/tools/search_app_help.ts` - read-only help article search tool.
- `agent/lib/app-help-articles.ts` - shared local corpus loader/searcher.
- `agent/tools/{bash,write_file,web_fetch,web_search,agent}.ts` - disable unsafe default harness tools.
- `scripts/verify/verify_eve_app_help_agent.mjs` - targeted guardrail verifier.
- `package.json` - scope Eve to the `agent` workspace while preserving the existing verifier script.
- `docs/ops/tasks/2026-06-30-eve-app-help-agent.md` - task/evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `frontend/node_modules/.bin/tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --skipLibCheck --types node --typeRoots ./frontend/node_modules/@types --esModuleInterop agent/lib/app-help-articles.ts agent/tools/search_app_help.ts` | Pass | Root `npx tsc` is not usable because the root does not install the TypeScript compiler; frontend-installed compiler was used for the touched files. |
| Static/format | `git diff --check` | Pass | No whitespace errors. |
| Targeted tests | `npm run verify:eve-app-help-agent` | Pass | Verifies required files, prompt contract, disabled-tool files, help corpus presence, source paths, excerpts, change-event results, and permissions results. |
| Dependency lock | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm install --package-lock-only` | Pass | Regenerated npm workspace lock; npm audit reports existing dependency vulnerability noise. |
| Dependency lock | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" pnpm install --lockfile-only --ignore-scripts` | Pass | Required explicit minimum-release-age exclusions for Eve/Nitro transitives `httpxy` and `nf3`; policy check then passed. |
| Browser/user-flow | N/A | Pass | No frontend-visible UI behavior changed. |
| DB/provider read-back | N/A | Pass | No database, migration, provider env, or external service config changes. |
| Search proof | `npx tsx -e "import { searchHelpArticles } from './agent/lib/app-help-articles.ts'; void (async () => { const results = await searchHelpArticles('How do I create a change event and add pricing?', 3); console.log(JSON.stringify(results.map((r) => ({ slug: r.slug, title: r.title, score: r.score, sourcePath: r.sourcePath, excerpt: r.excerpt.slice(0, 140) })), null, 2)); })();"` | Pass | Returned `change-events`, `change-event-to-change-order-workflow`, and `ai-assistant-actions` with source paths and excerpts. |
| Eve compile | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eve -- info` | Pass | Compile ready with 0 errors and 1 expected warning for ignored `agent/node_modules/`. |
| Eve manifest | `node - <<'NODE' ... compiled-agent-manifest assertion ... NODE` | Pass | Manifest tools: `search_app_help`; disabled framework tools: `agent`, `bash`, `web_fetch`, `web_search`, `write_file`. |

## Files Changed

- `.github/workflows/quality-gate.yml`
- `agent/lib/app-help-articles.ts`
- `agent/package.json`
- `agent/tools/agent.ts`
- `agent/tools/bash.ts`
- `agent/tools/search_app_help.ts`
- `agent/tools/web_fetch.ts`
- `agent/tools/web_search.ts`
- `agent/tools/write_file.ts`
- `docs/ops/tasks/2026-06-30-eve-app-help-agent.md`
- `package-lock.json`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `scripts/dev/eve.sh`
- `scripts/verify/verify_eve_app_help_agent.mjs`

## Risks / Gaps

- This is a read-only local-docs agent, not a production app integration or chat UI.
- It does not query Supabase, RAG vectors, or live app state.
- It does not perform write actions such as creating RFIs or change events.
- Existing unrelated dirty files are present in tutorial/training/migration areas and were not staged for this task.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
