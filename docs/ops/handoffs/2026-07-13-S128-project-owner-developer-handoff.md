# S128 Handoff: Project Owner and Developer Handoff

Status: Blocked
Owner: Codex
Task: `docs/ops/tasks/2026-07-13-project-owner-developer-handoff.md`
Linear: Unavailable right now - connector requires reauthentication (`oauth_token_invalid_grant`).

## What this doc is for

This is the compact handoff the owner can give to a new developer. It is meant to answer four questions quickly:

1. What is this project?
2. Where does the work actually live?
3. What commands prove the change is safe?
4. What should the next developer look at first?

## Owner summary

Alleato PM is a construction project management product with a Next.js frontend, a FastAPI backend, and Supabase as the shared data contract. The frontend owns the user experience and app routes. The backend owns ingestion, OCR, embeddings, and long-running operational jobs. Supabase owns schema, migrations, row-level security, and generated types.

If you hire someone to help, they should not start by guessing. They should start from the repo maps and the live routes, then work from the smallest owned surface that matches the requested feature.

## New developer starting point

Read these in order:

1. `docs/architecture/ALLEATO-SYSTEM-MAP.md`
2. `docs/architecture/PROJECT-MAP.md`
3. `docs/architecture/FOLDER-STRUCTURE.md`
4. `docs/architecture/DOCS-OPERATING-MODEL.md`
5. `docs/ops/memory/current-state.md`

Then inspect the scripts that actually run the project:

- root `package.json`
- `frontend/package.json`

## Where feature work belongs

Use the owning runtime, not the nearest file.

| Work type | Owner |
| --- | --- |
| Page, route, form, table, modal, or visible workflow | `frontend/src/app/**`, `frontend/src/components/**`, `frontend/src/features/**` |
| Supabase schema, RPC, RLS, or generated types | `supabase/migrations/**`, `frontend/src/types/database.types.ts` |
| Fireflies, Graph, OCR, embeddings, scheduler, or backfill work | `backend/src/services/**` |
| AI chat, tool calling, RAG retrieval, or in-app assistant flow | `frontend/src/app/api/ai-assistant/chat/**`, `frontend/src/lib/ai/**` |
| Operator docs, handoffs, and session tracking | `docs/ops/**` |

## Commands a new developer should know

Start and verify the app:

- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run check:routes`
- `npm run quality:changed`

Feature-specific gates:

- `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`
- `npm run db:migrations:verify-applied -- supabase/migrations/<file>.sql`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run test:unit`

If a route starts failing with a stale 404, clear the frontend build cache before debugging:

- remove `frontend/.next`
- restart the frontend dev server

## Guardrails that matter

- Dynamic routes must use specific names like `[projectId]`, not `[id]`.
- Database work is incomplete until the generated types match the migration.
- Do not treat generated project maps or old notes as truth; verify against the live repo and route behavior.
- For final delivery, use `npm run codex:finish -- --message "..." --files <owned files>` so the task is staged, checked, committed, and pushed together.

## Risks and gotchas

- The repo has a lot of historical docs. Not all of them are canonical.
- Some tracking and orchestration flows depend on Linear reauth.
- The backend and frontend are separate runtimes; a fix in one does not automatically cover the other.
- Dirty worktrees are common, so task-owned files need to stay narrow and explicit.

## Evidence log

| Time | Action | Result |
| --- | --- | --- |
| 2026-07-13 | Reviewed the repo’s architecture and workflow docs. | Identified the canonical ownership boundaries and the startup order for a new developer. |
| 2026-07-13 | Reviewed the root and frontend scripts. | Captured the commands that matter for developer onboarding and feature verification. |
| 2026-07-13 | Attempted to create/resolve the Linear issue. | Blocked by `oauth_token_invalid_grant`; tracking must wait for reauthentication. |

## Intake block

1) Session ID: S128
2) Task ID: `docs/ops/tasks/2026-07-13-project-owner-developer-handoff.md`
3) Linear issue: AAI-000
4) Linear URL: https://linear.app/unavailable
5) Current status: Blocked
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-13-project-owner-developer-handoff.md`, `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S128-project-owner-developer-handoff.md`, `/Users/meganharrison/Documents/github/project-management/docs/ops/memory/current-state.md`
7) Commands run and outcome (pass/fail counts): `rg --files docs/ops/tasks | tail -n 20` pass; `sed -n '1,220p' docs/architecture/PROJECT-MAP.md` pass; `sed -n '1,260p' docs/architecture/ALLEATO-SYSTEM-MAP.md` pass; `node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts,null,2))"` pass; `node -e "const p=require('./frontend/package.json'); console.log(JSON.stringify(p.scripts,null,2))"` pass; `git diff --check` pass; `npm run linear:codex:check -- docs/ops/handoffs/2026-07-13-S128-project-owner-developer-handoff.md` fail; `mcp__codex_apps__linear._list_teams` fail, reauth required (`oauth_token_invalid_grant`)
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/tasks/2026-07-13-project-owner-developer-handoff.md`; `docs/ops/handoffs/2026-07-13-S128-project-owner-developer-handoff.md`; `docs/ops/memory/current-state.md`
9) Top 3 findings (frontend-visible issues first): The repo already has the right canonical maps; the missing piece was a single owner/developer handoff that ties them together. The real commands are available in `package.json`; they should be part of the handoff so a new developer can start correctly. Linear tracking is currently unavailable until reauthentication succeeds.
10) Recommended next action (one line): Reauthenticate the Linear connector, then post the kickoff/update comment and convert this local handoff into a tracked issue if further work is needed.
11) Handoff file path: `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S128-project-owner-developer-handoff.md`
12) Migration ledger evidence: Not applicable; no Supabase migration files were changed.

## Linear Updates

- Kickoff comment: Blocked - Linear reauth required; no real issue could be created yet.
- Milestone comments: None.
- Completion/blocker comment: Blocked - Linear reauth required; issue creation and comment posting are deferred.
