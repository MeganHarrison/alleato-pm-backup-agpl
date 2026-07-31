# Task: MKH Global AI Widget Branding

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: mkh-global-ai-widget-branding
Linear Issue: Not required, single-session follow-on.
Related Handoff: N/A

## Objective

Complete the MKH identity handoff in the persistent global AI widget without changing its chat, history, notification, focus, or approval behavior.

## Scope

- Replace the legacy Alleato widget dialog label, header title, and favicon with MKH identity.
- Reuse the shared `MkhLogo` primitive created by `mkh-ai-design-foundation`.
- Add a regression guard that rejects legacy Alleato branding in this surface.
- Exclude chat runtime, notification routing, storage keys, and launcher behavior.

## Source of Truth

- Canonical owner: `frontend/src/components/ai-assistant/global-ai-widget.tsx`
- Shared primitive: `frontend/src/components/brand/mkh-logo.tsx`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Contract

- [x] The open global widget is announced as `MKH AI`.
- [x] The widget header uses `MkhLogo` and displays `MKH AI`.
- [x] No legacy Alleato favicon or `Alleato AI` label remains in the global widget.
- [x] Existing widget behavior is unchanged.
- [x] Authenticated desktop and mobile screenshots show the final combined AI experience.

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors remain specific and actionable through existing widget error handling.
- [x] Database, provider, authentication, permission, or delivery contracts are unchanged.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Independent review is complete.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published to `origin/main` through the required exact-file closeout flow.

## Failure-Loudly Contract

- Cause surfaced as: the source-level regression test fails if the legacy brand string or asset returns.
- Detection path: focused unit test plus authenticated open-widget screenshots.
- Recovery path: restore the shared `MkhLogo` usage and `MKH AI` accessible label/title in the canonical widget owner.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: The initial ownership scope covered the welcome and assistant-created widgets but omitted the independently mounted global widget.
- Detection gap: The first regression guard did not inspect the global widget owner.
- Prevention: The global widget test now rejects the legacy title and favicon and requires the shared logo.
- Guardrail evidence: `frontend/src/components/ai-assistant/__tests__/global-ai-widget-overlay.test.ts`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Follow-on scope and failure contract captured before edits. |
| Focused regression | `npm run test:unit -- --runInBand --runTestsByPath src/components/ai-assistant/__tests__/global-ai-widget-overlay.test.ts` | Pass | 1 suite, 4 tests; rejects legacy title and favicon. |
| Targeted lint | `npx eslint src/components/ai-assistant/global-ai-widget.tsx src/components/ai-assistant/__tests__/global-ai-widget-overlay.test.ts --max-warnings 0` | Pass | No warnings. |
| Authenticated `/ai` | `http://127.0.0.1:3108/ai` | Pass | Confirms the main MKH AI surface and the intentional global-widget runtime suppression on immersive AI routes. |
| Desktop open widget | `/tmp/mkh-ai-final-proof/desktop-widget-open-1440x1000.png` | Pass | `MKH AI` dialog/header and MKH logo visible without overflow. |
| Mobile open widget | `/tmp/mkh-ai-final-proof/mobile-widget-open-390x844.png` | Pass | Responsive open widget with `MKH AI` identity and no horizontal overflow. |
| Browser action log | `/tmp/mkh-ai-final-proof/action-log-2026-07-24.md` | Pass | Records launcher, accessible dialog name, route behavior, and viewport measurements. |
| Independent review | `/tmp/mkh-ai-final-proof/independent-review.md` | Approved | No blocking implementation, accessibility, responsive, or noise-gate findings. |
| Main publication | `origin/main` commit `a96760a05cdc3b9bd4ac9b33bcaae4eb7cc9ef2d` | Pass | Contains both the MKH AI foundation and global widget follow-on. |
| Production deployment | Vercel `dpl_Bc8FKARhEN5Nv4aBp7bVaASogZcK` | Ready | Exact detached `origin/main` checkout deployed, then promoted to the canonical production project. |
| Canonical alias readback | `npx vercel inspect https://projects.alleatogroup.com --scope the-alleato-group` | Pass | Canonical domain resolves to the new Ready deployment. |
| Production `/ai` | `/tmp/mkh-ai-production-proof/ai-desktop-1440x1000.png` | Pass | Authenticated `AI | MKH` route with MKH logo, headline, composer, and three prompt starters. |
| Production global widget | `/tmp/mkh-ai-production-proof/widget-desktop-1440x1000.png` | Pass | Authenticated open `MKH AI` widget with shared logo and no console errors or overflow. |
| Production action log | `/tmp/mkh-ai-production-proof/action-log-2026-07-24.md` | Pass | Records canonical URLs, deployment ID, and no-side-effect verification. |

## Remaining Risk

- No known release blocker remains. A future rendered `ChatArea` click-through test would strengthen the current source-wiring guard if this welcome surface changes frequently.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
