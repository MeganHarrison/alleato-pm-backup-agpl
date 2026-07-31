# Handoff: 2026-07-14 — Drawing Viewer Zoom and Comments Incident

## Intake Block

1) Session ID: S150
2) Task ID: DRAWING-VIEWER-INCIDENT-2026-07-14
3) Linear issue: Blocked — connector authentication unavailable
4) Linear URL: N/A; prior connector proof is `oauth_token_invalid_grant`
5) Current status: Pending review — focused-thread repair published at `414705fd4`; exact project-1142 refresh remains an access-limited follow-up.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/components/velt/VeltAuthProvider.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/components/velt/__tests__/VeltAuthProvider.test.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/app/globals.css`; `/Users/meganharrison/Documents/github/project-management/frontend/tests/e2e/drawings/drawings-viewer-capability-contract.spec.ts`; task/handoff/session board/evidence
7) Commands run and outcome (pass/fail counts): recurring-failure lookup matched 1 canonical guardrail; focused Jest now passes 2 suites/4 tests; changed-file type guard passed; real authenticated browser wheel + Comment submit + reload/readback passed; focused-thread DOM readback confirms 400px dark rail plus readable author/body and reply placeholder; complexity audit passed; independent design reviewer passed list and focused-thread screenshots; targeted Playwright contract remains blocked before viewer load because saved auth redirected to `/auth/login` on port 3002
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-14-drawings-viewer-zoom-comments-incident/comment-list-final-product-only.png`; `docs/ops/evidence/2026-07-14-drawings-viewer-zoom-comments-incident/focused-thread-final.png`; `docs/ops/evidence/2026-07-14-drawings-viewer-zoom-comments-incident/comment-persisted-after-reload.png`; independent review: sub-agent `019f60f4-de8d-78e2-b90f-d81846dfc686`
9) Top 3 findings (frontend-visible issues first): select-mode overlay swallowed wheel input through a passive React listener; Velt mounted anonymous while the profile loaded so a real comment save silently failed; Velt's embedded white ticket-board panel and hard-coded dark comment text violated the drawing viewer's dark rail.
10) Recommended next action (one line): publish the shared drawing-comments skin, then refresh the Playwright auth fixture for alternate local ports so the automated browser contract can run in clean dev servers too.
11) Handoff file path: `docs/ops/handoffs/2026-07-14-S150-drawings-viewer-zoom-comments-incident.md`
12) Migration ledger evidence: N/A; no database migration planned

## Closeout Exception

`npm run linear:codex:check -- docs/ops/handoffs/2026-07-14-S150-drawings-viewer-zoom-comments-incident.md` remains blocked because the incident has no authenticated Linear issue or URL: the connector previously failed with `oauth_token_invalid_grant`. This is external tracking debt, not a product or verification failure; the local task, handoff, review queue, test output, browser evidence, and independent review retain the complete closeout record.

## Linear Updates

- Kickoff comment: blocked until the Linear connector is reauthenticated; local task/board/handoff record preserves scope and evidence.
- Milestone comments: pending runtime localization.
- Completion/blocker comment: pending.

## Current Status

Wheel input now uses native non-passive listeners at the overlay and vendor-iframe boundaries. Drawing comments mount the drawing-scoped Velt sidebar before comment mode activates. `VeltAuthProvider` now refuses to mount an anonymous collaboration client while the profile is loading. On the real authenticated route, the test moved the pointer over the drawing, wheel-zoomed, submitted `S150 drawing comment persists after reload`, reloaded, reopened Comments, and read the same thread back. The follow-up repair was published in `dddddb8ce3`.

The user correctly rejected the visual result. Runtime localization against the screenshot and computed styles identified that `drawing-comments-panel` themes inner Velt nodes but misses the SDK's actual `.velt-comment-sidebar-panel` and `.velt-sidebar-header`, which retain the white oversized rounded-card/ticket-board presentation. The shared skin now resets those nodes, hides cross-thread controls that do not belong in a single-drawing rail, and restores text contrast. The circular bubble over the development screenshot is Agentation tooling, not application DOM.

The newest browser evidence is unrelated to the drawing rail: the global `VeltGlobalLayer` keeps rendering site-feedback `VeltComments` whenever persisted `commentsVisible` is true. On `/1142/drawings` that mounts `velt-text-comment-internal` and the `Creates issue` toggle without a user comment action. The collection route needs a shared runtime exclusion; it is not a CSS issue.

Repair: `VeltGlobalLayer` now suppresses the global page-comment runtime for all project drawing collection routes while preserving it for canonical `/drawings/viewer/[drawingId]` routes. Focused Jest confirms the exact `/1142/drawings` mount contract. The local test account cannot access project 1142, so a post-publish refresh in the user's existing session is the remaining visual proof.

Focused-thread repair: selecting a Velt comment pin opens a body-level `.velt-comment-dialog-overlay-panel`, outside the embedded drawing rail. The prior list-only skin could therefore never control it. The shared drawing selector now pins that actual portal to the viewer rail, removes the white rounded dialog/card shell, restores dark-rail contrast, keeps the reply composer anchored, and hides the redundant in-rail jump control. The independent reviewer passed both final product screenshots. The white circle initially flagged in the list image was DOM-attributed to an injected local Agentation toolbar (`title="Start feedback mode"`), not shipped product UI; the evidence screenshot hides only that development overlay.

Composer contrast follow-up: the first rail repair left the reply field too close to the rail (`rgb(24,24,27)` against `rgb(31,31,34)`). Raising the visible field fill alone was insufficient because Velt independently sets `-webkit-text-fill-color: rgb(24,24,27)`, which overrode the light `color` declaration and kept the placeholder dark. The shared focused-thread skin now overrides that paint property for both the placeholder and typed text. The final screenshot shows the field at `rgb(56,56,63)`, readable placeholder text, and a quiet primary focus ring; independent reviewer `019f6161-544e-7880-b323-5827dd470d84` passed it.

Status follow-up: the original ticket-chrome reduction hid the entire `.velt-sidebar-header`, which also removed the real Status filter. The narrowed rule now hides only the cross-thread search and redundant filter button. The Status trigger remains visible, its Velt dropdown is themed dark and readable, and its absolute positioning is anchored within the drawing rail. Browser interaction opened Open, In Progress, and Resolved options; independent reviewer `019f624e-efbe-75e3-986d-abfd6d2b709c` passed the header and menu screenshots.

## Exact Next Step

Publish the focused-thread rail repair, then refresh the stored Playwright session for alternate local ports and verify the user's project-1142 collection route after deployment.

## Known Pitfalls

- Do not diagnose against `viewer-v3` or OpenSeadragon.
- Do not apply route-local wheel or comment workarounds; repair the shared boundary.
- The generic `data-annotation-id` namespace has previously been claimed by a global Velt sanitizer; inspect actual DOM ownership before changing persistence code.

## Resume Commands

```bash
agent-browser --session s150-drawings open http://localhost:3001/67/drawings/viewer/ef8708e3-b196-437f-8745-3696105fc8d9
agent-browser --session s150-drawings snapshot -i -C
```

## Evidence

- `docs/ops/tasks/2026-07-14-drawings-viewer-zoom-comments-incident.md`
- `docs/ops/evidence/2026-07-14-drawings-viewer-zoom-comments-incident/wheel-zoom-restored-final.png`
- `docs/ops/evidence/2026-07-14-drawings-viewer-zoom-comments-incident/comment-mode-ready.png`
- `docs/ops/evidence/2026-07-14-drawings-viewer-zoom-comments-incident/comment-persisted-before-reload.png`
- `docs/ops/evidence/2026-07-14-drawings-viewer-zoom-comments-incident/comment-persisted-after-reload.png`
