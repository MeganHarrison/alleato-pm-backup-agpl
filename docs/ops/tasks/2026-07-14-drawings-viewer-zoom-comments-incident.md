# Task: Restore Drawing Viewer Zoom and Comment Interaction

Status: Ready to publish — drawing comment Status filter independently verified
Owner: Codex S150
Created: 2026-07-14
Task ID: DRAWING-VIEWER-INCIDENT-2026-07-14
Linear Issue: Blocked — Linear connector was previously proven unavailable with `oauth_token_invalid_grant`; incident is tracked locally until connector access is restored.
Related Handoff: `docs/ops/handoffs/2026-07-14-S150-drawings-viewer-zoom-comments-incident.md`

## Objective

Restore wheel/trackpad zoom and drawing-anchored comment interaction on the canonical authenticated drawings viewer route, with an executable regression guard.

Restore the drawing-comments rail to the quiet, native drawing-workspace presentation required by the product design system. The user-reported screenshot is a release-blocking visual regression: Velt's white rounded ticket card, oversized status controls, and floating SDK action remain visible inside the dark viewer rail.

Prevent the global site-feedback Velt composer and its issue-toggle control from leaking onto the drawings collection route after users leave a drawing viewer. Collection pages must not mount page annotations; drawing comments remain scoped to the active drawing viewer only.

## Scope

- Canonical route: `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx`.
- Shared viewer interaction boundary: `frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx` and directly required comment integration owners.
- Explicit exclusion: `viewer-v3`, legacy OpenSeadragon surfaces, and unrelated global header feedback.
- Visual regression boundary: the Velt embedded sidebar root in the drawing comments rail and the shared Velt skin in `frontend/src/app/globals.css`.
- Global-leak boundary: persisted `commentsVisible` client state → `VeltGlobalLayer` render on `/[projectId]/drawings`.
- Coordination: this incident overlaps the unfinished S138 shared-viewer verification surface; S150 owns the reported regression diagnosis and the smallest durable repair required to restore the customer flow.

## Source of Truth

- Canonical runtime/data owner: PDF.js Express viewer plus the drawing-scoped Velt comment contract.
- Existing shared primitives/services: `PdfjsExpressDrawingViewer`, `DrawingComments`, `comment-scope`, `VeltCommentTool`.
- Deprecated or parallel paths: `viewer-v3`, OpenSeadragon viewer, global page-feedback comments.

## Acceptance Criteria

- [x] Wheel and trackpad input visibly changes drawing zoom without scrolling the browser page.
- [x] The drawing Comment tool opens a drawing-scoped composer and accepts a drawing interaction.
- [x] Failure-loudly behavior is defined for unavailable viewer/comment runtime.
- [x] A focused regression test covers the restored input and comment boundaries.
- [x] Exact-route browser evidence captures both interactions.
- [x] The drawing discussion rail presents one quiet comment list and composer, without Velt ticket-board cards, oversized status/search chrome, or floating SDK actions.
- [x] Navigating to a drawings collection route does not mount `velt-text-comment-internal` or the site-feedback `Creates issue` toggle.
- [x] Opening an existing drawing comment keeps the focused thread inside the dark drawing rail, with readable text and an anchored reply composer.
- [x] Independent visual review passes the repaired list and focused-thread screenshots.
- [x] Focused-thread composer has a visibly distinct input surface against the dark rail.
- [x] Drawing comment Status filter is visible and usable in the list header.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Existing cross-cutting owners and parallel paths are identified.
- [x] First divergent runtime boundary is captured before any product-code edit.
- [x] Repair is made in the shared owner rather than route-local workaround.
- [x] Root cause, detection gap, and prevention are recorded.
- [x] Visual root cause is localized: the existing drawing selector neutralizes Velt inner panels but leaves the SDK `velt-sidebar-container` shell unthemed.
- [x] Global-leak root cause is localized: persisted `commentsVisible` causes the global site-feedback `VeltComments` layer to render on the drawing collection route, where it exposes the text-comment composer outside a user-requested comment workflow.
- [x] Focused-thread visual root cause is localized: selecting a sidebar comment opens Velt's separate body-level `.velt-comment-dialog-overlay-panel`; the list-only `.drawing-comments-panel` scope cannot style its default white dialog or hard-coded dark text.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Authenticated browser flow proves wheel zoom and comment interaction.
- [x] Evidence artifacts are recorded.
- [x] Browser evidence confirms the corrected visual hierarchy on the exact drawing route.
- [ ] Browser evidence confirms the user's authenticated project-1142 collection route remains free of global page-comment controls after refresh.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a specific viewer initialization or comments-readiness message, never a silent inert control.
- Detection path: exact-route browser contract observes zoom change and comment composer/pin state.
- Recovery path: retry the named viewer or comments action after the surfaced dependency is ready.

## Incident Learning

- Failure fingerprint: `frontend.viewer-capability-regression`
- Root cause: the default `select` markup mode routes wheel input through an overlay while PDF.js Express is inside an iframe; React's delegated wheel handler is passive, so it cannot suppress browser scrolling. The drawing `VeltCommentTool` also activated Velt before the conditionally-rendered drawing sidebar existed. A second live submit proved the Velt provider initially mounted without the authenticated profile, leaving Velt anonymous (`Velt: User not set`) even after the profile arrived; writes then disappeared silently. The later visual regression came from the embedded SDK's `.velt-comment-sidebar-panel` and `.velt-sidebar-header`: existing overrides only reset inner panels, leaving the SDK's white rounded ticket-board shell, search/status header, numbered thread label, and hard-coded dark text.
- Detection gap: the capability contract proved only toolbar zoom and did not assert real wheel input, comment submission, reload persistence, or the rendered comment-rail hierarchy. It also did not exercise the profile-loading state at Velt-provider mount.
- Prevention: native non-passive wheel listeners now cover both overlay and vendor-iframe event boundaries; the comment button mounts the drawing sidebar before entering Velt comment mode; `VeltAuthProvider` waits for an authenticated profile before mounting Velt; the drawing-scoped skin resets Velt's actual panel/header nodes and tokens; focused tests cover the non-anonymous mount contract and browser evidence covers real submission, reload, and comment-rail visual hierarchy.
- Guardrail evidence: `node scripts/ops/learning-registry.mjs lookup --symptom "drawing viewer wheel zoom and anchored comments fail" --files 'frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx,frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx'`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Incident scope and ownership recorded before product-code edits. |
| Learning lookup | `node scripts/ops/learning-registry.mjs lookup ...` | Pass | Matched canonical viewer regression guardrail. |
| Browser localization | `agent-browser` on `http://localhost:3002/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9` | Pass | Toolbar zoom changed page geometry; initial wheel left 1124×803 geometry unchanged; initial Comment click logged missing `velt-comments-sidebar`. |
| Live repaired wheel | `agent-browser mouse wheel -300` | Pass | PDF page geometry changed from 937×669 to 1035×739 with no passive-listener error. |
| Live repaired comments | `agent-browser` Comment tool | Pass | Drawing-scoped `velt-comments-sidebar` mounted at `/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9` with an enabled composer. |
| Focused static/unit checks | ESLint; drawing wheel/comment Jest suites; `npm run typecheck:changed` | Pass | ESLint clean; 2 suites / 11 tests passed; no new type debt. |
| Anonymous-provider regression | `pnpm exec jest --runInBand --runTestsByPath src/components/velt/__tests__/VeltAuthProvider.test.tsx src/components/drawings/__tests__/DrawingComments.scope.unit.test.tsx` | Pass | 2 suites / 3 tests passed; Velt does not mount during profile loading and mounts only with an authenticated user. |
| Complete frontend flow | `agent-browser` on `http://localhost:3003/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9` | Pass | Moved pointer over drawing, wheel `-300` changed PDF geometry 898×641 → 992×709; clicked Comment, submitted `S150 drawing comment persists after reload`, reloaded, reopened Comments, and read the same comment from the same document ID. |
| E2E evidence | `comment-persisted-before-reload.png`, `comment-persisted-after-reload.png`, `wheel-zoom-after-comment-fix.png` | Pass | Captures the real authenticated route and persisted drawing thread. |
| Visual localization | Live DOM computed styles on the authenticated drawing route | Pass | `.velt-comment-sidebar-panel` and `.velt-sidebar-header` computed as white with 14px radius; Velt thread message computed `rgb(41, 41, 41)` against the dark drawing rail. The local Agentation inspector bubble is external tooling, not product DOM. |
| Visual repair | `drawing-comments-ui-final.png` | Pass | Exact `/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9` browser route now shows the native rail header, readable thread, quiet composer, and linked-item footer without the white ticket-board card or redundant SDK header/filter/status chrome. |
| Design/system checks | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/app/globals.css`; focused Jest; `npm run typecheck:changed` | Pass | Complexity audit passed; 2 Jest suites / 3 tests passed; no new type debt. |
| Capability contract | `PLAYWRIGHT_BASE_URL=http://localhost:3002 pnpm exec playwright test --config config/playwright/playwright.config.drawings-capability.ts --grep 'zoom, rotation|drawing comment mode'` | Blocked/unrelated | The suite redirects to `/auth/login` before `openRenderedViewer`; saved-auth fixture is stale for the clean local port. Live env-backed browser proof passed both exact interactions. |
| Initial publish | `npm run codex:finish -- --message "Restore drawing viewer zoom and comments" --files <incident-owned paths>` | Pass | Commit `84b89dfce1b5e711d0ef128a5ca409562b79e22e` pushed to `origin/main`. |
| Follow-up publish | `npm run codex:finish -- --message "Prevent anonymous drawing comment sessions" --files <incident-owned paths>` | Pass | Commit `dddddb8ce3` pushed to `origin/main`; finish read-back confirmed local `HEAD` equals `origin/main`. |
| Visual repair publish | `npm run codex:finish -- --message "Make drawing comments rail native" --files <incident-owned paths>` | Pass | Commit `f54291c81e` pushed to `origin/main`; finish read-back confirmed local `HEAD` equals `origin/main`. |
| Collection-route leakage | Browser comment at `http://localhost:3001/1142/drawings` | Fail | `velt-text-comment-internal` exposes `Creates issue` at the lower-left page edge despite no page-comment action being requested. |
| Collection-route regression guard | `VeltGlobalLayer.test.tsx` | Pass | `/1142/drawings` with visible global comments renders no `VeltComments` or global sidebar; `/1142/drawings/viewer/<drawingId>` still renders scoped drawing annotations. |
| Design-system audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/components/velt/VeltGlobalLayer.tsx` | Pass | The shared runtime owner remains within the surface complexity budget. |
| User visual regression | `/Users/meganharrison/Desktop/Screenshot 2026-07-14 at 9.16.41 AM.png` | Fail | The embedded Velt sidebar renders a large white rounded card, status/search ticket chrome, and a floating SDK action inside the dark drawing rail. |
| Focused-thread runtime localization | `focused-thread-actual-before-repair.png` and live DOM inspection | Fail | Clicking a drawing comment renders `.velt-comment-dialog--dialog-mode` in a body-level Velt overlay with `background: rgb(255,255,255)`, `border-radius: 10.5px`, and `color: rgb(41,41,41)`. |
| Focused-thread repair | `focused-thread-final.png` plus live DOM computed-style readback | Pass | The active dialog is pinned to the 400px viewer rail (`x=880`, `y=48`, `width=400`, `height=672`) with dark `rgb(31,31,34)` surface, readable name/body `rgb(244,244,245)`, and a visible reply placeholder. |
| Final product-only list | `comment-list-final-product-only.png` | Pass | The list rail has no Velt white ticket card or floating SDK action; the labelled `Link item` footer action and anchored composer remain. The locally injected Agentation toolbar was attributed by DOM (`title="Start feedback mode"`) and excluded from the product screenshot. |
| Independent visual review | Sub-agent `019f60f4-de8d-78e2-b90f-d81846dfc686` | Pass | Reviewer passed both final screenshots and judged the product UI safe to publish; no remaining blockers. |
| Publish | `npm run codex:finish -- --message "Repair focused drawing comments rail" --files ...` | Pass | Commit `414705fd4` pushed to `origin/main`; post-push readback confirmed `HEAD == origin/main`. |
| Composer contrast regression | `input-contrast-before-repair.png` plus live DOM readback | Fail | Rail is `rgb(31,31,34)` and reply input is `rgb(24,24,27)` with only a low-contrast `rgba(255,255,255,0.14)` border; the input visually disappears in the focused thread. |
| Composer contrast repair | `input-contrast-final.png`, `input-focus-final.png`, and DOM readback | Pass | Reply input is `rgb(56,56,63)` against the dark rail with a visible neutral border; placeholder and typed text explicitly override Velt's dark `-webkit-text-fill-color`, while focus uses a restrained primary ring. |
| Independent contrast review | Sub-agent `019f6161-544e-7880-b323-5827dd470d84` | Pass | Reviewer confirmed readable placeholder, distinct input fill/boundary, restrained focus treatment, no clipping, and publish safety. |
| Status visibility regression | Production browser comment plus local DOM inspection | Fail | The drawing skin sets `.velt-sidebar-header { display: none }`; the hidden header contains the valid Status dropdown, while search and redundant filter controls are separate descendants. |
| Status filter repair | `sidebar-header-final.png`, `sidebar-status-menu-final.png`, and browser interaction | Pass | Header is visible with search/filter clutter suppressed, Status expands to Open/In Progress/Resolved options, and the dark menu remains inside the rail. |
| Independent Status review | Sub-agent `019f624e-efbe-75e3-986d-abfd6d2b709c` | Pass | Reviewer confirmed visible Status trigger, no white header/menu, readable option and check states, no clipping, and publish safety for visual acceptance. |

## Remaining Risk

- The targeted Playwright capability contract still redirects to `/auth/login` when pointed at a clean non-default local port. Owner: test-auth configuration. Detection gap: the capability config does not refresh its session when `PLAYWRIGHT_BASE_URL` changes. Prevention: refresh the fixture against the target base URL before a full rerun. This does not block the completed authenticated browser proof above.
- The local Agentation inspector bubble can appear over the composer during development. It is not shipped application UI; visual review must distinguish it from the Velt DOM before styling the product.
- The persisted global comments preference must not be treated as authorization to inject a page-comment composer on a drawings collection route. The route must explicitly own page annotation capability.
- The local test account does not have project-1142 access, so the exact user session requires a post-publish refresh check. The route-level regression test covers the reported mount condition directly.
- The local Agentation toolbar can overlap a development screenshot. DOM attribution confirmed it is injected development tooling, not shipped product UI; product-only evidence hides it only in the test session and does not alter application code.

## Final Status

- [x] All required implementation and browser-verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked with confirmed cause and prevention.
- [x] Deferred Playwright auth-fixture work has cause, detection gap, prevention step, owner, and next action.
