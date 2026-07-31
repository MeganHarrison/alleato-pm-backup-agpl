# Task: AI route noise gate polish

Status: Partial - browser proof blocked by auth state
Owner: Codex
Created: 2026-06-25
Linear Issue: Blocked - Linear issue creation tool unavailable in this session; only comment tools were exposed.
Related Handoff: N/A

## Objective

Clean up `http://localhost:3001/ai` so the first screen is a quiet operational assistant entry point instead of a decorative hero/catalog surface.

## Attention Brief

Primary user: Alleato operator or executive opening AI from the app.
Primary job: ask the assistant for project, source, or workflow help quickly.
Primary decision: what to ask or whether to resume chat history.
Tier 1: composer and current chat context.
Tier 2: chat history access, model/project/council controls.
Tier 3: profile and teaching links.
Hide until requested: secondary AI tools.
Remove: top-level AI command center catalog, autofill affordance, pill/arrow action links.
Primary action: type and submit a prompt.
Failure-loudly behavior: auth redirects and chat load/request failures remain visible as explicit errors.

## Scope Checklist

- [x] Existing route/component ownership reviewed.
- [x] Existing shared primitives identified before adding new ones.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] User-facing UI follows the Alleato noise gate.
- [x] Route-level chat welcome state simplified without disrupting active chat sessions.

## Verification Checklist

- [x] Targeted static/lint check run for changed frontend files.
- [x] Browser verification attempted against the exact `/ai` route.
- [x] Evidence artifacts recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Browser before | `agent-browser open http://localhost:3001/ai --session ai-route-polish` + `/tmp/ai-before.png` | Blocked | Automation session redirected to `/auth/login?callbackUrl=%2Fai`; auth state needed for visual proof. |
| Source check | `rg -n "AI command center|AssistantActionCatalog" frontend/src/components/ai-assistant/chat-area.tsx` | Pass | No matches after removal. |
| Static/lint | `cd frontend && npx eslint src/components/ai-assistant/chat-area.tsx` | Pass | Targeted ESLint completed with exit code 0. |
| Browser after | `agent-browser open http://localhost:3001/ai --session ai-route-polish-auth --state frontend/tests/.auth/user.json` + `agent-browser get url` + `agent-browser get count 'text=AI command center'` | Blocked/Partial | Saved auth state still redirected to `/auth/login?callbackUrl=%2Fai`; count was 0 on the login page, so it is not accepted as visual proof of `/ai`. Screenshot: `/tmp/ai-after-no-command-center-auth.png`. |
| Action-link cleanup | `rg -n "AI command center\|AssistantActionCatalog\|ArrowRightIcon\|LockKeyholeIcon" frontend/src/components/ai-assistant/chat-area.tsx frontend/src/components/ai-assistant/assistant-suggestion-list.tsx` | Pass | No matches after removing the catalog and arrow/uneven icon treatment. |
| Static/lint follow-up | `cd frontend && npx eslint src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/assistant-suggestion-list.tsx` | Pass | Targeted ESLint completed with exit code 0 after action-link and autofill cleanup. |
| Action-card refinement | `cd frontend && npx eslint src/components/ai-assistant/assistant-suggestion-list.tsx` | Pass | Scoped follow-up changed only the starter action design to compact icon cards modeled on the provided screenshot. |
| Action placement/icon correction | `cd frontend && npx eslint src/components/ai-assistant/assistant-suggestion-list.tsx src/components/ai-assistant/welcome-screen.tsx src/components/ai-assistant/chat-area.tsx` | Pass | Actions now render below the composer through `afterComposer`; action icons removed. |

## Files Changed

- `frontend/src/components/ai-assistant/chat-area.tsx` - Remove the full-route AI command center catalog render/import and apply autofill-ignore attributes to the full composer.
- `frontend/src/components/ai-assistant/assistant-suggestion-list.tsx` - Replace pill/arrow suggestions with compact text-only starter action cards.
- `frontend/src/components/ai-assistant/welcome-screen.tsx` - Add an `afterComposer` slot so full-page starter actions sit below the composer.
- `docs/ops/tasks/2026-06-25-ai-route-noise-gate-polish.md` - Task ledger and evidence.

## Risks / Gaps

- Exact `/ai` browser proof is blocked in automation because available auth state redirects to login. The user's in-app browser is already on `/ai`, so visual confirmation should be immediate after HMR/reload.
- Local checkout already contains unrelated dirty files, including pre-existing edits in `frontend/src/components/ai-assistant/chat-area.tsx`; this task preserved them and only removed the command center render/import.
- Linear issue creation is blocked by unavailable tooling in this session.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
