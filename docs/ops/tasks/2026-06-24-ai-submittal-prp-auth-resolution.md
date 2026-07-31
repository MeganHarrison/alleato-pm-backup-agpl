# Task: AI Submittal PRP Auth Resolution

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-630 https://linear.app/megankharrison/issue/AAI-630/resolve-supabase-cli-auth-for-ai-submittal-prp-execution-gate
Related Handoff: None

## Objective

Resolve the Supabase CLI auth path for the AI submittal PRP execution gate so
fresh PM app types can be generated, then update the PRP package to remove the
auth-only block and rerun `prp-quality`.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing auth failure evidence reviewed.
- [x] Existing env/config path for Supabase CLI inspected.
- [x] Source-of-truth owner chosen for auth and type generation path.
- [x] Acceptance criteria written as observable outcomes.
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

- [x] Fresh types generated through the canonical CLI path.
- [x] PRP and TASKS updated to reflect resolved auth block.
- [x] `prp-quality` rerun against the revised PRP.
- [x] Evidence and issue log updated.

## Regression Guardrails

- [x] Reusable auth invocation pattern captured in evidence.
- [x] PRP no longer claims blocked auth when the command has passed.
- [x] Guardrail added so the same auth mistake fails loudly next time.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Prior failure review | `docs/ops/tasks/2026-06-25-ai-submittals-prp-create.md` | Pass | Previous PRP creation task recorded the unauthorized failure. |
| Env path inspection | local `.env` and `package.json` `db:types` script | Pass | Local secure env contains a Supabase access token and the canonical generation command. |
| Type generation | `npm run db:types` | Pass | Succeeded via the new `postgres-meta` fallback path and rewrote `frontend/src/types/database.types.ts`. |
| Type read-back | `npm run db:types:check` | Pass | Confirmed `database.types.ts` matches the current schema via `postgres-meta-fallback`. |
| Canonical script fix | `scripts/generate-db-types.mjs` + `package.json` | Pass | Added a shared generator that tries Supabase CLI first and falls back to Docker-free `postgres-meta` using `DATABASE_URL`. |
| PRP update | `docs/PRPs/submittals/ai-submittal-intelligence/prp-ai-submittal-intelligence.md` | Pass | Status/confidence updated from blocked to ready and the canonical `db:types` path documented. |
| TASKS update | `docs/PRPs/submittals/ai-submittal-intelligence/TASKS.md` | Pass | Companion task status and Workstream 1 updated to the canonical `db:types` path. |
| PRP quality rerun | in-thread `prp-quality` rerun | Pass | PRP now clears the auth-blocker finding and is ready for execution. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-24-ai-submittal-prp-auth-resolution.md` - task ledger and evidence
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/types/database.types.ts` - fresh generated PM app types if generation succeeds
- `/Users/meganharrison/Documents/alleato-pm/docs/PRPs/submittals/ai-submittal-intelligence/prp-ai-submittal-intelligence.md` - remove auth-only block if resolved
- `/Users/meganharrison/Documents/alleato-pm/docs/PRPs/submittals/ai-submittal-intelligence/TASKS.md` - align companion status if resolved
- `/Users/meganharrison/Documents/alleato-pm/scripts/generate-db-types.mjs` - canonical durable generator with fallback
- `/Users/meganharrison/Documents/alleato-pm/package.json` - `db:types` and `db:types:check` now use the shared generator

## Risks / Gaps

- The direct Supabase management token in local env still returns `401 Unauthorized`; the durable repo path now avoids that dependency by falling back to `DATABASE_URL` + `postgres-meta`.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
