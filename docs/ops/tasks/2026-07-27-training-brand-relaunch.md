# Task: Training Module Brand Relaunch (owner-approved DESIGN-SYSTEM-GATE exception)

Status: Complete
Owner: claude-code-training-brand-relaunch
Created: 2026-07-27
Task ID: LOCAL-2026-07-27-TRAINING-BRAND-RELAUNCH
Linear Issue: N/A (owner design directive, not a new Linear ticket — supersedes
the visual approach taken on ALL-19/ALL-26/ALL-27/ALL-28's already-shipped work)
Related Handoff: N/A (single-session scoped change)

## Objective

The owner determined the training module had been re-skinned into the app's
default "operator-grade / quiet" design system, when it must instead look
like the standalone "Own Your Growth" hub that was already approved: black
sticky nav, black hero with an orange radial glow, Work Sans/Lato type,
`#FD5602`/`#0D0D0D` brand tokens, 14px-radius cards with hover lift, pill
tabs/badges, and the canvas Skill Wheel dashboard. This is an explicit,
owner-approved exception to `DESIGN-SYSTEM-GATE.md`, scoped to
`/training/**` only.

Canonical reference saved to `specs/LAYOUT-REFERENCE.md` (the owner's design
brief). Source of truth: `training-source/index.html` (structure),
`training-source/styles.v2.css` (all styling), `training-source/app.v2.js`
(Skill Wheel math), `training-source/data.js` (content).

## Scope

- `frontend/src/app/(main)/training/training-theme.module.css` (new) — a
  literal, scoped CSS Modules port of `styles.v2.css`. Every original class
  name is preserved (camelCased); bare-tag rules (`body`, `h1-h3`, `a`,
  `canvas`, `*`) are rewritten as descendants of `.root` so nothing leaks
  onto the rest of the app.
- `frontend/src/app/(main)/training/library/resource-library.module.css`
  (new) — a literal port of `Resource-Library.html`'s own embedded
  stylesheet (the resource-browsing page has its own distinct look —
  bordered `.item` tiles with a left orange accent — separate from the
  hub's `.card` tile system). Reuses the shared `--orange`/`--dgrey`/etc.
  custom properties defined on `.root`, since both modules render inside
  the same wrapper.
- `frontend/src/app/(main)/training/layout.tsx` (new) — segment layout:
  loads Work Sans + Lato via `next/font/google`, wraps every `/training`
  page in the `.root` theme class, and renders the shared `TrainingNav` +
  `TrainingFooter` once (not per-page).
- `frontend/src/features/training/{TrainingNav,TrainingFooter,TrainingHero}.tsx`
  (new) — the sticky black nav, footer, and the hub's hero block.
- Every existing training page (`page.tsx` hub, `library/page.tsx`,
  `method/page.tsx`, `prompts/page.tsx`, `growth/page.tsx`,
  `guides/[guideSlug]/page.tsx`) — dropped `PageShell`/`SectionRuleHeading`
  in favor of plain semantic markup styled by the theme classes.
- Every training presentation component (`HubModuleTile`, `HubModuleGrid`,
  `ResourceCard`, `ResourceFilters`, `TrainingLibraryView`,
  `TrainingGuideList`, `MethodContent`, `PromptList`, `SkillWheel`,
  `SkillGrowthClient`, `GuideViewer`) — rebuilt to render the literal
  branded markup/classes instead of `ds`/`ui` components and Tailwind
  utility classes. All existing business logic, state, and API calls were
  preserved verbatim; only the rendered JSX changed.
- `.claude/rules/DESIGN-SYSTEM-GATE.md` — added an "Owner-approved
  exception: `/training`" section pointing at this spec.
- `frontend/eslint.config.mjs` — added a scoped override disabling the
  `design-system/*` rules that exist specifically to enforce the pattern
  this route is intentionally not using (`require-page-shell`,
  `no-raw-heading`, `no-hardcoded-colors`, etc.), for
  `src/app/(main)/training/**` and `src/features/training/**` only.
- `frontend/jest.config.js` + `frontend/src/test-utils/css-module-mock.js`
  (new) — Jest has no CSS loader; added a `.module.css` → mock mapping so
  `styles.card` resolves to `"card"` in tests instead of throwing on real
  CSS. The mock's `get` trap must special-case `__esModule` (return
  `undefined`, not the property name) — a naive "return the property name"
  proxy answers `__esModule` truthily, which fools TypeScript's
  esModuleInterop helper into skipping the `{ default: mod }` wrap, so a
  later `.default` access returns the literal string `"default"` instead
  of the proxy. Cost about 20 minutes to find via a debug test isolating
  `typeof styles`.
- `lib/training/types.ts` / `lib/training/data-access.ts` /
  `features/training/types.ts` / `features/training/adapter.ts` — re-added
  optional `createdAt` threading (needed for the library's "NEW" badge,
  computed the same way the source does: `daysSince(createdAt) <= 14 &&
  status !== "review"`). Kept optional, not required, so any older fixture
  that omits it still compiles.

## Source of Truth

- Canonical design brief: `specs/LAYOUT-REFERENCE.md`.
- Canonical content/structure/style/logic: `training-source/{index.html,
  styles.v2.css,app.v2.js,data.js,Resource-Library.html}`.

Delivery lane: Standard

Verification contract: Optional

## Deliberate adaptations (documented, not silent)

1. **CSS Modules, not a hand-wired `.training-theme` wrapper class.** Achieves
   the same "scoped, can't leak" guarantee the owner asked for, via the
   same mechanism already used elsewhere in this app
   (`ai-dashboard-theme.module.css`), rather than inventing a new pattern.
2. **Two theme files, not one.** The hub/method/prompts/growth pages use
   `training-theme.module.css` (from `styles.v2.css`); the resource-library
   page uses its own `resource-library.module.css` (from
   `Resource-Library.html`'s embedded styles), because the source itself
   ships two different stylesheets for two different visual languages
   (card tiles vs. left-accent list items). Porting them as one merged
   file would have invented a design the source doesn't have.
3. **`SkillGrowthClient`/`SkillWheel` kept 100% of their existing logic.**
   This component already had real Supabase-backed persistence, focus
   ranking math, and 10 passing tests before this task — only the JSX
   changed. Two real test-contract mismatches were found and fixed
   properly rather than papered over: the score/target inputs must expose
   `role="textbox"` with a stable accessible name (`"<skill> current
   score"`) for the save-flow tests to drive them — solved by keeping the
   visual `<input type="range">` slider purely decorative
   (`aria-hidden="true"`) and moving the accessible control to a
   `type="text"` field styled like the reference's `.num` box; and the
   focus-plan fields need static labels ("Precise action" / "Frequency" /
   "Measure"), not per-skill-prefixed `aria-label`s, matching the original
   passing test contract.
4. **Nav tabs moved out of `PageShell`'s `tabs` prop into the shared
   `layout.tsx`.** The reference has ONE nav, rendered once, not
   re-rendered per page — matches the source's actual structure and removes
   a redundant PageShell dependency this design doesn't want anyway.
5. **Dropped the ESLint-driven "noise-gate" pass a different session applied
   to this same module** (bordered cards → open divided rows, "Coming
   soon" text-only). That pass predates this owner directive and is
   exactly what this directive reverses — see `specs/LAYOUT-REFERENCE.md`'s
   explicit "do not silently convert the hub to the muted design system."

## Acceptance Criteria

- [x] Sticky black nav with the 5 real nav links, logo left.
- [x] Black hero with orange radial glow, "OWN YOUR GROWTH" H1, orange kicker,
      CTA, italic tagline.
- [x] Course tile grid (`.card`/`.mod`/`.grid`) on the hub.
- [x] Resource library uses the source's own `.item`/`.chip`/badge system
      (FREE/type/DEEP DIVE/NEEDS REVIEW/NEW), not the hub's card tiles.
- [x] Method page: 4 principle cards, 6 numbered steps, honesty rubric,
      quick toolkit, black proficiency panel with checklist.
- [x] AI Prompts page: `.prompt` cards with a Copy button that turns filled
      "Copied ✓".
- [x] Skill Wheel dashboard: canvas-equivalent SVG wheel with the
      orange-fill/dashed-black-ring legend, editable score/target fields,
      impact×gap-ranked focus list, check-in history.
- [x] Black footer.
- [x] Scoped to `/training` only — no other route's visual system changed.

## Integration and Verification

- [x] Focused Jest suite: 155/155 passing across 40 suites
      (`npx jest src/features/training src/lib/training training`). The one
      failing suite in that glob (`task-training-service.test.ts`) is
      pre-existing, unrelated repo debt — an ESM import error in an
      unrelated AI agent-learning service, not touched by this task.
- [x] Focused ESLint on every new/changed file — clean.
- [x] Focused `tsc --noEmit` — no new training-related errors.
- [x] `bash scripts/check-route-conflicts.sh` — no conflicts.
- [ ] Authenticated live/browser readback — same sandbox blocker as prior
      training work this session (local Supabase env vars are blanked, so
      the local dev server won't boot); deferred to the Vercel preview /
      production check after review.

## Failure-Loudly Contract

- Cause surfaced as: N/A — design-direction change, not a bug fix.
- Detection path: N/A
- Recovery path: N/A

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Unit tests | `npx jest src/features/training src/lib/training training` | Pass | 155/155 across 40 suites; 1 unrelated pre-existing failure outside this scope. |
| Lint | `npx eslint <every new/changed file>` | Pass | Clean. |
| Typecheck | `npx tsc --noEmit \| grep training` | Pass | No new errors. |
| Route conflicts | `scripts/check-route-conflicts.sh` | Pass | No conflicts. |
| Live visual proof | — | Blocked | Local sandbox Supabase env vars are blanked; see prior training task files this session for the same limitation. |

## Remaining Risk

- Visual proof of the deployed result is pending — check the Vercel preview
  or production `/training` after merge for pixel-level fidelity to
  `specs/LAYOUT-REFERENCE.md`.
- This work supersedes the ResourceCard/TrainingLibraryView design in PR #148
  and the noise-gate-reduced hub/static-content integration already on
  `main` — PR #148 should be closed as superseded once this lands, since its
  DS-component approach directly conflicts with the owner's new direction.

## Final Status

- [x] All required checklist items are complete except the one explicitly
      blocked item (live visual proof), documented above.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A (no bug involved).
- [x] No other work is silently deferred — every adaptation is listed above.
