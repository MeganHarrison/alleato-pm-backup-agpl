# Task: MKH AI Design Foundation

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: mkh-ai-design-foundation
Linear Issue: Not required, single-session task with no external tracking request.
Related Handoff: N/A

## Objective

Apply the MKH identity and a Dayos-informed, operator-grade entry experience to the shared AI surfaces without changing AI runtime behavior.

## Scope

- Own the shared MKH logo primitive, app-shell logo placements, `/ai` welcome state, assistant-created contact widget wordmark, and AI route metadata.
- Reuse the existing chat composer, suggestion primitive, app shell, and AI SDK 7 chat transport.
- Exclude AI model selection, tools, retrieval, persistence, agent registry data, and non-app document/email branding.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/components/ai-assistant/rag-chat-page.tsx` and `frontend/src/components/ai-assistant/chat-area.tsx`
- Existing shared primitives/services: `WelcomeScreen`, `AssistantSuggestionList`, `PageShell`, and `MkhLogo`
- Deprecated or parallel paths: `/ai-assistant` legacy aliases remain unchanged.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Contract

- [x] The `/ai` empty state displays the supplied MKH logo and no Alleato logo.
- [x] The AI entry copy focuses on project cost allocation, WIP, margin, exposure, and next actions.
- [x] Three quiet prompt starters submit through the existing chat action.
- [x] App sidebar, mobile header, and assistant-created contact widget use the shared MKH logo primitive.
- [x] Existing AI SDK transport, tool approvals, error handling, and conversation behavior are unchanged.
- [x] The changed route renders at desktop and mobile widths with screenshot evidence.

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors remain specific and actionable through the existing chat error state.
- [x] Database, provider, authentication, permission, or delivery contracts are unchanged.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Independent review is complete.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published through the required closeout command.

## Failure-Loudly Contract

- Cause surfaced as: the existing specific inline chat transport or session creation error.
- Detection path: focused unit tests plus authenticated `/ai` browser rendering.
- Recovery path: the composer preserves the user prompt after transport load failure and exposes retry through resubmission.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: focused welcome-screen and shared-brand tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| URL extraction | `/tmp/dayos-design-extract.pE9Kp3/.extract-design-system/normalized.json` | Pass | Detected `SuisseIntlCond` and large editorial spacing scale. |
| Reference screenshot | `/tmp/dayos-design-extract.pE9Kp3/dayos-full-page.png` | Pass | Used as a visual reference, not copied as a product shell. |
| Prompt wiring regression | `frontend/src/components/ai-assistant/__tests__/assistant-widget-renderer.test.tsx` | Pass | Guards all three labels and their handoff to the existing submit action. |
| Focused unit tests | `npm run test:unit -- --runInBand --runTestsByPath src/components/ai-assistant/__tests__/assistant-widget-renderer.test.tsx src/components/ai-assistant/__tests__/welcome-screen.test.tsx` | Pass | 2 suites, 15 tests. |
| Authenticated browser preflight | `npm run verify:browser-auth -- --base-url http://127.0.0.1:3107 --route /ai --session mkh-ai-local-proof` | Pass | Auth state refreshed through the repository-owned secure path. |
| Desktop visual | `/tmp/mkh-ai-local-proof/desktop-1440x1000.png` | Pass | MKH welcome, composer, and three prompt starters rendered without overflow. |
| Mobile visual | `/tmp/mkh-ai-local-proof/mobile-390x844.png` | Pass | Responsive hierarchy and bottom navigation rendered without overflow. |
| Browser action log | `/tmp/mkh-ai-local-proof/action-log-2026-07-24.md` | Pass | Records the authenticated route and viewport checks. |
| Independent review | `/tmp/mkh-ai-local-proof/independent-review.md` | Approved | No blocking findings in the narrowed foundation scope. |
| Known unrelated warning | `npx eslint src/components/ai-assistant/assistant-widget-renderer.tsx --max-warnings 0` | Unrelated | Existing `design-system/no-raw-search-input` warning also reproduces on canonical `origin/main`; owner is the pre-existing search input in `assistant-widget-renderer.tsx`. |

## Remaining Risk

- The separately owned persistent global widget header still uses the legacy Alleato label. It is tracked as the immediate follow-on task `mkh-global-ai-widget-branding` so this workspace does not violate path ownership.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
