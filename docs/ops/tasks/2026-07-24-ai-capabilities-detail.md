# Task: AI capabilities detail page

Status: Needs UI Verification
Owner: Codex
Created: 2026-07-24
Task ID: AI-CAPABILITIES-DETAIL
Linear Issue: Not requested
Related Handoff: N/A (single-session Standard delivery)

## Objective

Make the canonical AI Vision route explain the operational problem, the governed AI solution, and the current versus planned capabilities from the `ai_agents` registry.

## Scope

- `frontend/src/app/(admin)/ai-vision/page.tsx`
- `docs/architecture/PROJECT-MAP.md` and `frontend/src/lib/app-surface/app-surface.generated.json` (required generated route metadata)
- `docs/architecture/SYSTEM-MAP.md` and `docs/architecture/generated/system-map.json` (required generated system metadata)
- This task record and its verification evidence
- Excludes edits to registry data, navigation, feature flags, and AI runtime behavior

## Source of Truth

- Canonical runtime/data owner: Supabase `public.ai_agents`
- Existing shared primitives/services: `PageShell`, `createClient`, `getCurrentUser`, `isOwnerEmail`
- Deprecated or parallel paths: static AI Vision capability arrays in the prior route implementation

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [ ] The page visibly separates the problem, solution, available capabilities, in-progress work, and roadmap.
- [ ] Capability status and detail are read from `ai_agents`, not duplicated static arrays.
- [ ] Registry unavailability fails loudly instead of showing stale fallback content.
- [ ] The page preserves owner-only access and links to the canonical editable registry.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an explicit in-page registry-unavailable state that names the required migration and authenticated Supabase access.
- Detection path: route render and targeted static check.
- Recovery path: restore authenticated Supabase access and verify the `ai_agents` migration/registry.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: Registry query has no static fallback, so stale roadmap claims cannot render silently.
- Guardrail evidence: targeted source assertion and browser proof.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and source of truth recorded before implementation. |
| Page contract | `node -e` source assertion | Pass | Confirms the registry query, three status sections, and visible unavailable-registry state. |
| Focused lint | `cd frontend && npx eslint 'src/app/(admin)/ai-vision/page.tsx' --no-cache` | Pass | No lint output. |
| Changed TypeScript guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt. |
| Publish guard | `npm run codex:finish -- ...` | Repaired | The retired-status schema literal triggered the no-retired-runtime-reference gate. The page now uses a neutral fallback for unknown statuses instead. |
| Local UI render | `cd frontend && npx next dev -p 3100` | Blocked | Startup guard correctly stopped the isolated workspace because no Supabase environment variables are available. |

## Remaining Risk

- Remote Supabase migration-ledger verification is blocked because the local Supabase CLI has no access token. The route’s direct authenticated query remains the runtime source-of-truth check.
- Authenticated browser proof remains blocked: the isolated workspace has no local Supabase environment source, so the runtime guard prevents startup. Owner: environment/bootstrap. Next action: run the route in an authenticated deployment or a workspace with the secured environment file, and save a screenshot.

## Final Status

- [ ] All required checklist items are complete. Authenticated UI proof remains open.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
