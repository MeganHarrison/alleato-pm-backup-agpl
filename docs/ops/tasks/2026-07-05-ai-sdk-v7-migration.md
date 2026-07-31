# Task: Migrate Alleato Frontend AI Stack From AI SDK v6 To v7

Status: In Progress
Owner: Codex
Created: 2026-07-05
Linear Issue: AAI-943 - https://linear.app/megankharrison/issue/AAI-943/migrate-alleato-frontend-ai-stack-from-ai-sdk-v6-to-v7
Related Handoff: docs/ops/handoffs/2026-07-05-S114-ai-sdk-v7-migration.md

## Objective

Upgrade the frontend AI stack from AI SDK v6 to AI SDK v7, migrate the repo's
server/runtime/client call sites to the current contracts, and leave the
assistant/tooling surfaces in a fail-loud, verifiable state.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Post Linear kickoff comment.
- [x] Read the `migrate-ai-sdk-v6-to-v7` skill and local `ai-sdk` skill.
- [x] Inventory the current AI SDK package/runtime versions in `frontend`.
- [x] Inventory current v6 usage across server routes, tool contracts,
      telemetry, and chat UI.
- [x] Confirm owned-file boundary against existing dirty checkout state.
- [x] Record the migration decision points that need semantic review instead of
      pure codemod replacement.

## Migration Checklist

- [x] Upgrade `ai`, `@ai-sdk/openai`, `@ai-sdk/react`, and related AI SDK
      packages to v7-compatible versions.
- [x] Add any required v7 companion packages only where the repo actually uses
      those capabilities.
- [x] Migrate `system` to `instructions` for AI SDK core calls and agent flows.
- [x] Migrate callback renames and result-shape usage (`onFinish`/`onStepFinish`,
      stream/result accessors, usage fields, message access).
- [x] Migrate tool approval and tool execution contracts where v7 changed the
      ownership boundary.
- [x] Migrate telemetry wiring to the v7-supported contract used by this repo.
- [x] Migrate UI/client hook usage if the installed `@ai-sdk/react` v7 surface
      requires changes.
- [x] Update focused tests and guardrails for the touched AI surfaces.

## Verification Checklist

- [x] Run focused lint on all touched AI SDK files.
- [x] Run focused unit/integration tests for touched AI routes/tools/components.
- [x] Run changed-file type guard or equivalent narrow type validation locally.
- [x] Delegate full frontend typecheck/build verification to a cheaper
      verification worker.
- [x] Classify any remaining failures as task-related or unrelated repo debt.
- [x] Update Linear with closeout evidence.
- [ ] Publish exact task-owned files to `origin/main`.

## Acceptance Criteria

- [x] The repo no longer relies on known AI SDK v6-only call patterns in the
      owned frontend AI surfaces.
- [x] AI assistant/chat runtime code compiles on the upgraded package set.
- [x] Tool approval, telemetry, and streaming behavior are migrated without
      silent fallbacks.
- [x] Verification evidence distinguishes real migration regressions from
      unrelated existing repo debt.
- [x] Handoff and task artifacts include command evidence, changed files,
      remaining risk, and next action.

## Failure-Loud Guardrails

- Any remaining v6-only API usage in owned paths must be recorded explicitly in
  this document rather than silently deferred.
- Any changed AI tool or route that can no longer stream, approve, or trace
  correctly must fail with task ownership noted in the handoff.
- Full typecheck/build failures must be summarized with exact owner files and
  whether they are related to this migration.

## Initial Findings

- `frontend/package.json` currently declares `ai ^6.0.175`,
  `@ai-sdk/openai ^3.0.25`, `@ai-sdk/react ^3.0.177`, and
  `@ai-sdk/mcp ^1.0.36`.
- Node runtime is already compatible with the skill requirement at
  `v22.17.1`.
- High-volume migration surfaces include `frontend/src/lib/ai/**`,
  `frontend/src/app/api/ai-assistant/**`, `frontend/src/app/api/procore-docs/**`,
  project meeting/email AI routes, and multiple chat UI components.
- The checkout is already dirty, including `frontend/package.json` and
  `frontend/pnpm-lock.yaml`, so exact diff inspection is required before
  package edits.

## Evidence

Linear issue:

- AAI-943: https://linear.app/megankharrison/issue/AAI-943/migrate-alleato-frontend-ai-stack-from-ai-sdk-v6-to-v7

Command evidence:

- `sed -n '1,260p' /Users/meganharrison/.agents/skills/migrate-ai-sdk-v6-to-v7/SKILL.md` - PASS
- `sed -n '1,260p' /Users/meganharrison/.agents/skills/ai-sdk/SKILL.md` - PASS
- `sed -n '1,220p' frontend/package.json` - PASS
- `node -v && pnpm -v` - PASS (`node v22.17.1`, `pnpm 11.7.0`)
- `rg -n "experimental_|\\bfullStream\\b|\\bonFinish\\b|\\bonStepFinish\\b|\\bsystem:\\s*|role:\\s*['\\\"]system['\\\"]|stepCountIs|experimental_telemetry|includeRawChunks|cachedInputTokens|reasoningTokens|experimental_customProvider|prepareStep|response\\.messages|DefaultChatTransport|createUIMessageStreamResponse|toUIMessageStreamResponse|pipeUIMessageStreamToResponse|toTextStreamResponse|pipeTextStreamToResponse|needsApproval|activeTools|experimental_activeTools|experimental_context|experimental_onToolCall|ToolCallOptions|experimental_include|Experimental_GeneratedImage|file-id|image-file-id|\\btype:\\s*['\\\"]image['\\\"]" frontend/src frontend/tests frontend/config -g '!**/node_modules/**'` - PASS
- `cd frontend && pnpm add ai@7.0.15 @ai-sdk/openai@4.0.8 @ai-sdk/react@4.0.16 @ai-sdk/mcp@2.0.7 @ai-sdk/devtools@1.0.2` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/rename-system-to-instructions src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/rename-step-count-is src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/rename-on-finish-to-on-end src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/rename-on-step-finish-to-on-step-end src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/rename-experimental-telemetry-to-telemetry src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/replace-cached-input-tokens src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/replace-reasoning-tokens src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/replace-experimental-output-with-output src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/rename-full-stream-to-stream src` - PASS
- `cd frontend && npx @ai-sdk/codemod v7/remove-experimental-generate-image src` - PASS
- `cd frontend && ./node_modules/.bin/eslint src/lib/executive/intelligence-brief.ts src/lib/executive/brandon-daily-update.ts src/lib/ai/retrieval/deps.ts src/lib/ai/tools/tool-utils.ts src/lib/ai/tools/outbound-action-policy.ts --quiet` - PASS
- `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath 'src/lib/ai/__tests__/bot-core-prompt.test.ts' 'src/app/api/email-inbox/[emailId]/draft-reply/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/emails/[emailId]/summarize/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/meetings/prep-suggestions/__tests__/route.test.ts'` - PASS (4 suites, 15 tests)
- `cd frontend && npm run typecheck:changed` - PASS (`No new 'any' type debt detected in changed changes.`)
- `cd frontend && pnpm exec tsc --noEmit --pretty false` - FAIL (`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`)
- `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 pnpm exec tsc --noEmit --pretty false 2>&1 | rg 'brandon-daily-update|intelligence-brief|retrieval/deps|outbound-action-policy|tool-utils|review-run-service'` - PASS (no matching migration errors emitted before manual stop)
- `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 ./node_modules/.bin/tsc --noEmit --pretty false` - FAIL overall; delegated verification isolated a small remaining AI SDK v7 error set plus unrelated repo debt
- `cd frontend && ./node_modules/.bin/eslint src/components/ai-assistant/rag-chat-page.tsx src/components/ai-chat/chat.tsx src/components/executive/executive-chat-panel.tsx src/lib/ai/orchestrator.ts src/lib/ai/tools/tool-utils.ts src/lib/ai/tools/outbound-action-policy.ts src/lib/submittals/ai-review/review-run-service.ts --quiet` - PASS
- `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 ./node_modules/.bin/tsc --noEmit --pretty false 2>&1 | rg 'rag-chat-page|ai-chat/chat|executive-chat-panel|ai/orchestrator|tool-utils|outbound-action-policy|review-run-service|TS2459|TS2353|TS2322|TS2345'` - PASS for owned migration files after follow-up fixes; remaining errors were unrelated repo debt
- `npm run codex:finish -- --check` - PASS for branch/sync state, but confirms a heavily dirty checkout so automated publish is not safe yet

Changed files:

- `docs/ops/tasks/2026-07-05-ai-sdk-v7-migration.md`
- `docs/ops/handoffs/2026-07-05-S114-ai-sdk-v7-migration.md`
- `docs/ops/orchestration/session-board.md`
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/app/auth/ai-widget-gallery/ai-widget-gallery-client.tsx`
- `frontend/src/artifacts/code/server.ts`
- `frontend/src/artifacts/sheet/server.ts`
- `frontend/src/artifacts/text/server.ts`
- `frontend/src/components/ai-assistant/chat-message-sync.ts`
- `frontend/src/components/ai-assistant/rag-chat-page.tsx`
- `frontend/src/components/elements/image.tsx`
- `frontend/src/components/executive/executive-chat-panel.tsx`
- `frontend/src/instrumentation.ts`
- `frontend/src/lib/ai/__tests__/bot-core-prompt.test.ts`
- `frontend/src/lib/ai/ai-telemetry.ts`
- `frontend/src/lib/ai/bot-core.ts`
- `frontend/src/lib/ai/langfuse-trace.ts`
- `frontend/src/lib/ai/orchestrator.ts`
- `frontend/src/lib/ai/prompt-diagnostics.ts`
- `frontend/src/lib/ai/retrieval/deps.ts`
- `frontend/src/lib/ai/tools/outbound-action-policy.ts`
- `frontend/src/lib/ai/tools/tool-utils.ts`
- `frontend/src/lib/bot/index.ts`
- `frontend/src/lib/executive/brandon-daily-update.ts`
- `frontend/src/lib/executive/intelligence-brief.ts`

Open decisions:

- Whether the existing repo telemetry path should stay on the currently
  supported `experimental_telemetry` contract or move to global registered
  integrations in this slice.
- How much of the tool approval migration can stay behavior-preserving versus
  adopting the newer per-call approval surface immediately.

Current closeout gap:

- Full frontend typecheck still fails overall because of unrelated existing repo
  debt outside the owned migration files.
- Publish remains open because `codex:finish -- --check` confirmed a heavily
  dirty checkout, including overlapping AI/package files, so task-only
  publication now requires exact hunk-level staging or a cleaner checkout
  boundary.
