# Task: Training Hub (T12) + Static Content Pages (T13)

Status: Done
Owner: claude-code-training-t12-t13; integration and noise-gate repair by S237
Created: 2026-07-26
Task ID: ALL-26, ALL-27
Linear Issue: https://linear.app/alleato-group/issue/ALL-26/t12-home-hub-own-your-growth-landing-course-tiles-nav, https://linear.app/alleato-group/issue/ALL-27/t13-own-your-growth-static-content-method-rubric-ai-prompts-toolkit
Related Handoff: N/A (single-session scoped change)

## Objective

Port the standalone "Own Your Growth" hub landing page (T12) and its static
learning content — The Method, the honesty rubric, AI Prompt starters, the
Quick Toolkit, and Proficiency-before-promotion (T13) — into the in-app
Training module. Shipped together because T12's course tiles and shared nav
link directly to the routes T13 creates.

## Scope

- `frontend/src/app/(main)/training/page.tsx` — now the hub landing page
  (was the resource library; moved, see below).
- `frontend/src/app/(main)/training/library/page.tsx` — the resource
  library, moved here verbatim from the old `page.tsx` (byte-identical
  logic, only the route path and page title changed).
- `frontend/src/app/(main)/training/method/page.tsx` (new, T13) — principles,
  steps, honesty rubric, toolkit, proficiency checklist.
- `frontend/src/app/(main)/training/prompts/page.tsx` (new, T13) — AI prompt
  starters with copy buttons.
- `frontend/src/app/(main)/training/guides/[guideSlug]/page.tsx` — added the
  shared nav tabs only (no other change).
- `frontend/src/features/training/{HubModuleTile,HubModuleGrid,MethodContent,
  PromptList,nav-tabs,hub-content,method-content,prompts-content}.{ts,tsx}` —
  new pure presentation components + config, following the existing
  props/fixtures-only pattern established for T5/T6.
- No changes to `frontend/src/app/(main)/training/review/**` (actively owned
  by concurrent session S235 at the time of this work).

## Source of Truth

- Canonical content owner: `training-source/index.html`, `training-source/data.js`.
- Existing shared primitives/patterns reused: `PageShell` (`tabs` prop →
  `PageTabs`), `SectionRuleHeading`, `Button`, and the open divided-list pattern
  already used by `TrainingGuideList`.
- Deprecated/moved path: the resource library moved from `/training` to
  `/training/library`; nothing else changed about it.

Delivery lane: Standard

Verification contract: Optional

## Deliberate adaptations (documented, not silent)

1. **Route restructuring.** T12's acceptance says "hub renders at `/training`",
   which only works if the current library (today's `/training`) moves to a
   sub-route. Chose `/training/library` — matches the original static site's
   nav order and its `#library` anchor id.
2. **Dropped the "Training Finder (AI Skill)" 8th tile.** Its original link
   (`Training-Finder-Skill/README.md`) is an internal contributor skill doc,
   not employee-facing training content — doesn't fit this app's route surface.
3. **"Coming soon" tiles, not dead links.** The Skill Wheel Exercise (Module 2,
   maps to T14) and "For Managers: Coaching It" (Module 3, not owned by any of
   T12–T15) render with quiet "Coming soon" text and no clickable link,
   instead of linking to a route that doesn't exist yet.
4. **No big hero CTA button.** The original site had a "Take the Assessment →"
   hero CTA. Per this repo's noise-gate ("no duplicate CTA in page content"),
   skipped it — the same destination is already one tab + one tile away, and
   the CTA's real destination (the assessment) doesn't exist until T14 ships.
5. **Nav tabs stop at what's built.** `TRAINING_NAV_TABS` currently lists
   Home / Training Library / The Method / AI Prompts. "My Growth" (T14) and
   "Ask the Library" (T15) join once those routes exist — a tab pointing at
   a 404 is a dead end, not navigation.
6. **Rubric/Toolkit/Proficiency live inside `/training/method`**, not as
   separate top-level routes — the original site's nav bar only lists
   Method/Prompts as distinct top-level items; rubric/toolkit/proficiency
   were sub-sections of the same page in the source, so they stay together.
7. **Noise-gate reduction.** The integration pass replaced bordered tile/static
   content boxes with open rows, spacing, and dividers; removed the decorative
   status badge and roadmap paragraph; and retained only status text that
   prevents dead-link confusion.

## Acceptance Criteria

- [x] Hub renders at `/training` with the hero, course tiles, and shared nav.
- [x] Tiles link to the library and the three existing guide routes.
- [x] `/training/library` shows the exact same resource library that used to
      live at `/training` (guide list, filters, resource grid, review-queue
      banner, reviewer action).
- [x] `/training/method` renders all 4 principles, all 6 steps, the 5 rubric
      rows, the 4 toolkit items, and the 4 proficiency checklist items.
- [x] `/training/prompts` renders all 6 AI prompt starters, each with a
      working copy-to-clipboard button.
- [x] Every learner-facing training page in this slice shares the same nav tabs.

## Integration and Verification

- [x] Focused feature Jest suite passes: 35/35 across 11 suites
      (`npx jest src/features/training 'src/app/(main)/training' --runInBand`).
- [x] Exact route Jest suite passes: 11/11 across 5 suites
      (`npx jest --runTestsByPath <five training route test files>`).
- [x] Focused ESLint on every new/changed file — clean (fixed a
      `no-raw-page-grid` warning on the hub page by moving the tile grid into
      `HubModuleGrid`, a feature component, instead of suppressing it).
- [x] Focused `tsc --noEmit` — no new training-related errors.
- [x] `bash scripts/check-route-conflicts.sh` — no conflicts.
- [x] Authenticated production browser readback passed on
      `https://projects.alleatogroup.com` after deployment
      `dpl_Axr3ErDXpUJqvUUNfSj9oYfEgSpM` reached Ready.
- [x] Desktop proof at 1440 × 1000 covered the hub, library, Method, and
      prompts routes; the hub and Method had no horizontal overflow.
- [x] Mobile proof at 375 × 812 covered the hub with no horizontal overflow.
- [x] Prompt clipboard denial failed loudly with the exact recovery message
      “Could not copy this prompt. Select the text and copy it manually.”

## Failure-Loudly Contract

- Cause surfaced as: the preview requires Vercel-team authentication, and the
  initial prompt-copy handler did not catch clipboard permission rejection.
- Detection path: exact preview navigation redirected to Vercel login; source
  audit identified the unhandled `navigator.clipboard.writeText` rejection.
- Recovery/prevention: production proof follows publication; clipboard failure
  now shows a specific recovery toast and has a focused rejection test.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: clipboard write assumed permission and availability.
- Detection gap: success-only interaction test.
- Prevention: rejected-write branch plus user recovery feedback.
- Guardrail evidence: `prompt-list.test.tsx` denied-access test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Feature unit tests | focused feature Jest | Pass | 35/35, 11 suites. |
| Route unit tests | exact five route-test paths | Pass | 11/11, 5 suites. |
| Lint | `npx eslint <every new/changed file>` | Pass | One real warning fixed (grid moved into a component), not suppressed. |
| Typecheck | `npx tsc --noEmit \| grep training` | Pass | No new errors. |
| Route conflicts | `scripts/check-route-conflicts.sh` | Pass | No conflicts. |
| Doctrine audit | `audit-surface-complexity.mjs` on 8 UI files | Pass | All 8 passed after manual noise reduction. |
| Live hub proof | `all-26-hub-desktop.png`, `all-26-hub-mobile.png` | Pass | Authenticated production; “Own Your Growth,” shared nav, linked tracks, two non-clickable “Coming soon” modules, and no overflow at 1440px or 375px. |
| Live library proof | `all-26-library-desktop.png` | Pass | Authenticated production; written guides, role/track/type/depth filters, search, review queue, and resource links render at `/training/library`. |
| Live Method proof | `all-27-method-desktop.png` | Pass | Authenticated production; principles, six-step loop, scoring rubric, Quick Toolkit, and readiness checklist render at `/training/method`. |
| Live prompts proof | `all-27-prompts-desktop.png` | Pass | All six prompts render. The automation browser denied clipboard permission; the live UI surfaced the manual-copy recovery toast, while focused tests cover the successful and rejected write branches. |
| Production readback | `all-26-27-production-readback.json` | Pass | Ready deployment ID, commit, routes, viewport dimensions, overflow checks, and browser diagnostics recorded. |

## Remaining Risk

- The "Coaching" tile (Module 3) doesn't map to any ticket in T12–T15 — flagged
  to the user; may need its own follow-up ticket or an explicit "won't build"
  decision.
- The authenticated automation context reports an unrelated Google One Tap
  FedCM token-retrieval console error. There were no uncaught page errors, and
  the training routes remained functional; this is outside T12/T13.

## Final Status

- [x] All required checklist items complete, including authenticated
      production desktop/mobile proof.
- [x] Evidence is filled in.
- [x] Incident learning records the clipboard rejection gap and regression test.
- [x] No other work is silently deferred — every adaptation is listed above.
