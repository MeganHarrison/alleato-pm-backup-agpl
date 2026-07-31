# Alleato System Map Guide

Date: 2026-07-06
Linear: AAI-944
Status: Complete

## Objective

Create a plain-English architecture guide that helps the user evaluate how Alleato PM is built, where work belongs, and when to use AI SDK, backend deep agents, Eve, and Vercel agent-stack capabilities.

## Scope

- Frontend/backend/Supabase ownership boundaries.
- Product AI runtime and AI SDK ownership.
- Backend deep-agent and intelligence-service boundary.
- Standalone Eve and agent workspace boundary.
- Vercel AI Gateway, Workflows, Connect, and Sandbox decision rules.
- Repo source references that a new evaluator can inspect directly.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Inspect existing architecture, backend, AI SDK, and Eve source references.
- [x] Create `docs/architecture/ALLEATO-SYSTEM-MAP.md`.
- [x] Include decision rules for frontend, backend, Supabase, AI SDK, deep agents, Eve, and Vercel agent-stack capabilities.
- [x] Record verification evidence.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: [AAI-944](https://linear.app/megankharrison/issue/AAI-944/create-alleato-project-structure-and-ai-runtime-guide)
- Linear closeout comment: `57340acd-d7e1-4483-b4fe-b5890b082566`
- Created guide: `docs/architecture/ALLEATO-SYSTEM-MAP.md`
- Source inspection:
  - `backend/README.md`
  - `docs/architecture/AI-ASSISTANT-ARCHITECTURE-REFERENCE.md`
  - `docs/architecture/AGENT-SDK-MAP.md`
  - `frontend/node_modules/ai/docs/00-introduction/index.mdx`
  - `frontend/node_modules/ai/docs/03-agents/01-overview.mdx`
  - `frontend/node_modules/ai/docs/03-agents/02-building-agents.mdx`
  - `agent/package.json`
  - `agent/agent.ts`
  - `agent/instructions.md`
  - `scripts/dev/eve.sh`
- Current official Vercel docs checked:
  - Vercel AI SDK docs
  - Vercel Workflows docs
  - Vercel Connect docs
  - Vercel Sandbox docs
  - Eve launch/reference context
- Verification:
  - `sed -n '1,260p' docs/architecture/ALLEATO-SYSTEM-MAP.md`
  - `sed -n '1,220p' docs/ops/tasks/2026-07-06-alleato-system-map-guide.md`
  - `rg -n "frontend/src/app/api/ai-assistant/chat|backend/src/services/agents|agent/agent.ts|Vercel Workflows|Vercel Connect|Vercel Sandbox|AI SDK" docs/architecture/ALLEATO-SYSTEM-MAP.md`
  - `npx markdownlint-cli2 --no-globs docs/architecture/ALLEATO-SYSTEM-MAP.md docs/ops/tasks/2026-07-06-alleato-system-map-guide.md` passed with 0 errors.
- Lint caveat:
  - Initial `npx markdownlint-cli2 docs/architecture/ALLEATO-SYSTEM-MAP.md docs/ops/tasks/2026-07-06-alleato-system-map-guide.md` read repo-wide globs from `.markdownlint-cli2.jsonc` and surfaced pre-existing Markdown debt across 7,261 files. Retried with `--no-globs` for the task-owned files only.

## Initial Constraints

- Documentation-only work; do not touch runtime code.
- Checkout contains unrelated dirty files; keep changes scoped to this task doc and the new architecture guide.
- AI SDK descriptions must be checked against installed `frontend/node_modules/ai/docs/` and current official docs, not memory alone.

## Failure-Loud Guardrail

This guide is not complete unless it names owner files and explains what not to use each agent/runtime layer for. Ambiguous "AI agent" wording is a failure because it would recreate the current confusion.
