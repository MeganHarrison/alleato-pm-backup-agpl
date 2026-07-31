# Handoff: 2026-07-05 - AI SDK v7 Migration

## Intake Block

1) Session ID: S114
2) Task ID: AAI-943
3) Linear issue: AAI-943
4) Linear URL: https://linear.app/megankharrison/issue/AAI-943/migrate-alleato-frontend-ai-stack-from-ai-sdk-v6-to-v7
5) Current status: In Progress
6) Files changed (absolute paths):
- /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-05-ai-sdk-v7-migration.md
- /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-05-S114-ai-sdk-v7-migration.md
- /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md
- /Users/meganharrison/Documents/alleato-pm/frontend/package.json
- /Users/meganharrison/Documents/alleato-pm/frontend/pnpm-lock.yaml
- /Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/ai-assistant/chat/handler-v2.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/app/auth/ai-widget-gallery/ai-widget-gallery-client.tsx
- /Users/meganharrison/Documents/alleato-pm/frontend/src/artifacts/code/server.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/artifacts/sheet/server.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/artifacts/text/server.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/chat-message-sync.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/rag-chat-page.tsx
- /Users/meganharrison/Documents/alleato-pm/frontend/src/components/elements/image.tsx
- /Users/meganharrison/Documents/alleato-pm/frontend/src/components/executive/executive-chat-panel.tsx
- /Users/meganharrison/Documents/alleato-pm/frontend/src/instrumentation.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/__tests__/bot-core-prompt.test.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/ai-telemetry.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/bot-core.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/langfuse-trace.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/orchestrator.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/prompt-diagnostics.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/retrieval/deps.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/outbound-action-policy.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/tools/tool-utils.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/bot/index.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/executive/brandon-daily-update.ts
- /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/executive/intelligence-brief.ts
7) Commands run and outcome (pass/fail counts):
- Pass: loaded `migrate-ai-sdk-v6-to-v7` skill
- Pass: loaded `ai-sdk` skill
- Pass: inspected `frontend/package.json`
- Pass: confirmed `node v22.17.1`, `pnpm 11.7.0`
- Pass: inventoried broad v6 usage patterns with `rg`
- Pass: upgraded AI SDK packages to `ai 7.0.15`, `@ai-sdk/openai 4.0.8`, `@ai-sdk/react 4.0.16`, `@ai-sdk/mcp 2.0.7`, `@ai-sdk/devtools 1.0.2`
- Pass: applied targeted AI SDK v7 codemods and manual contract fixes
- Pass: focused eslint on touched migration files
- Pass: focused jest suite (`4` suites, `15` tests)
- Pass: `cd frontend && npm run typecheck:changed`
- Fail: `cd frontend && pnpm exec tsc --noEmit --pretty false` hit Node heap OOM
- Pass: delegated high-heap `./node_modules/.bin/tsc --noEmit --pretty false` verification isolated the remaining migration-specific errors
- Pass: follow-up fixes cleared the migration-owned files from the filtered high-heap typecheck output
- Pass: `npm run codex:finish -- --check` confirmed `main` is synced with `origin/main`
8) Evidence artifacts (screenshot/video/report/log paths):
- This handoff
- Task doc `docs/ops/tasks/2026-07-05-ai-sdk-v7-migration.md`
- Linear AAI-943 comments
9) Top 3 findings (frontend-visible issues first):
- The AI SDK v7 migration required real semantic fixes in prompt assembly, telemetry, stream/result handling, and tool execution wrappers; the codemods were necessary but not sufficient.
- Direct server-side tool calls now need explicit v7 execution context, and shared tool wrappers now carry typed context generics instead of the v6-era looser shape.
- The remaining closeout blocker is no longer the migration code; it is publish safety in a heavily dirty checkout plus unrelated repo-wide type debt outside the owned files.
10) Recommended next action (one line): Publish from a cleaner boundary or with exact hunk-level staging for the migration-owned files only, then rerun the same high-heap frontend typecheck as a post-publish proof step.
11) Handoff file path: /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-05-S114-ai-sdk-v7-migration.md
12) Migration ledger evidence: No Supabase migrations touched.

## Linear Updates

- Kickoff comment: Posted
- Milestone comments:
- Completion/blocker comment:

## Current Status

AI SDK packages are upgraded to the current v7 line, targeted codemods are
applied, and the migration-owned runtime/tooling call sites have been manually
patched where the codemods left broken contracts. Focused lint, focused route
tests, and changed-file type debt checks pass. A delegated high-heap frontend
typecheck isolated the remaining migration-specific errors, and the follow-up
patches cleared those owned files from the filtered error output. The overall
frontend typecheck still fails on unrelated repo debt.

## Exact Next Step

Prepare a safe publish boundary for the migration-owned files only, because the
current checkout contains substantial unrelated dirt including overlapping AI
surface changes and package manifest churn.

## Known Pitfalls

- `frontend/package.json` and `frontend/pnpm-lock.yaml` are already dirty, so
  staging/publishing must isolate task-owned changes precisely.
- AI SDK contracts in this repo mix core, UI, tools, and telemetry patterns; a
  naïve global replace will break approval or streaming semantics.
- The frontend `typecheck` surface is large enough to OOM under the plain local
  run, so verification must use the bounded/high-heap path rather than treating
  a raw `tsc` crash as meaningful migration output.
- `codex:finish -- --check` shows the repo is on `main` and synced, but the
  working tree contains substantial unrelated modifications and untracked files,
  so any automated publish now risks bundling unrelated work.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
git diff -- frontend/package.json frontend/pnpm-lock.yaml
rg -n "from \"ai\"|from '@ai-sdk|system:|onFinish|fullStream|needsApproval|experimental_telemetry|Experimental_GeneratedImage" frontend/src -g '!**/node_modules/**'
cd frontend && NODE_OPTIONS=--max_old_space_size=16384 ./node_modules/.bin/tsc --noEmit --pretty false
npm run codex:finish -- --check
```

## Evidence

- Skills read:
  - `/Users/meganharrison/.agents/skills/migrate-ai-sdk-v6-to-v7/SKILL.md`
  - `/Users/meganharrison/.agents/skills/ai-sdk/SKILL.md`
- Package/runtime evidence:
  - `frontend/package.json`
  - `node v22.17.1`
  - `pnpm 11.7.0`
- Verification evidence:
  - `cd frontend && ./node_modules/.bin/eslint src/lib/executive/intelligence-brief.ts src/lib/executive/brandon-daily-update.ts src/lib/ai/retrieval/deps.ts src/lib/ai/tools/tool-utils.ts src/lib/ai/tools/outbound-action-policy.ts --quiet`
  - `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath 'src/lib/ai/__tests__/bot-core-prompt.test.ts' 'src/app/api/email-inbox/[emailId]/draft-reply/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/emails/[emailId]/summarize/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/meetings/prep-suggestions/__tests__/route.test.ts'`
  - `cd frontend && npm run typecheck:changed`
  - `cd frontend && pnpm exec tsc --noEmit --pretty false` (OOM)
  - Delegated high-heap `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 ./node_modules/.bin/tsc --noEmit --pretty false`
  - `cd frontend && ./node_modules/.bin/eslint src/components/ai-assistant/rag-chat-page.tsx src/components/ai-chat/chat.tsx src/components/executive/executive-chat-panel.tsx src/lib/ai/orchestrator.ts src/lib/ai/tools/tool-utils.ts src/lib/ai/tools/outbound-action-policy.ts src/lib/submittals/ai-review/review-run-service.ts --quiet`
  - `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 ./node_modules/.bin/tsc --noEmit --pretty false 2>&1 | rg 'rag-chat-page|ai-chat/chat|executive-chat-panel|ai/orchestrator|tool-utils|outbound-action-policy|review-run-service|TS2459|TS2353|TS2322|TS2345'`
  - `npm run codex:finish -- --check`
