# Task: Training Hub Visual Parity

Status: Complete
Owner: S248
Created: 2026-07-27
Task ID: local-training-visual-parity
Linear Issue: Not required for this single-session Standard task; direct Linear tools are unavailable in this session.
Related Handoff: N/A, single-session Standard task.

## Objective

Make the authenticated `/training` landing page visibly match the supplied
training-platform reference: a dark Alleato hero, compact training navigation,
one assessment action, and a responsive horizontal course-card library.

## Scope

- Canonical `/training` landing page composition.
- Canonical training hub module grid, tile, content, and focused tests.
- Desktop and mobile browser evidence.
- Excludes training subpage redesigns, data contracts, authentication, and the
  blocked training-library embedding provider.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/training/page.tsx` and
  `frontend/src/features/training/**`.
- Existing shared primitives/services: `PageShell`, `Card`, `Button`, Next.js
  `Link`/`Image`, and the existing `HUB_MODULE_TILES` content model.
- Visual reference: user-supplied screenshot plus the read-only
  `training-source/index.html`, `training-source/styles.v2.css`, and
  `training-source/data.js`.
- Deprecated or parallel paths: the standalone `training-source` prototype is a
  reference only and will not become a second runtime.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] `/training` uses the supplied black, orange, and warm-light composition.
- [x] The hero exposes one primary assessment action and compact training navigation.
- [x] Learning modules render as responsive course cards with working destinations.
- [x] The layout has no page-level horizontal overflow at required viewport widths.
- [x] Missing destinations remain explicit rather than rendering dead links.
- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
      out of scope and unchanged.

Owned implementation paths:

- `frontend/src/app/(main)/training/page.tsx`
- `frontend/src/app/(main)/training/__tests__/page.test.tsx`
- `frontend/src/features/training/HubModuleGrid.tsx`
- `frontend/src/features/training/HubModuleTile.tsx`
- `frontend/src/features/training/hub-content.ts`
- `frontend/src/features/training/index.ts`
- `frontend/src/features/training/__tests__/hub-module-grid.test.tsx`
- `frontend/src/features/training/__tests__/hub-module-tile.test.tsx`
- `docs/architecture/PROJECT-MAP.md` (generated route index)
- `frontend/src/lib/app-surface/app-surface.generated.json` (generated route index)

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual browser rendering proves the requested visual boundary.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published to `origin/main` and the production
      deployment is verified against the published commit.

## Failure-Loudly Contract

- Cause surfaced as: unavailable module destinations render `Coming soon`; route
  errors continue through the existing training error boundary.
- Detection path: focused Jest tests plus browser snapshots at desktop/mobile widths.
- Recovery path: use a working course action or return through the visible training
  navigation without losing the page.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The production landing page reused the generic content-header and
  divided-row patterns even though a supplied, approved training composition
  already existed.
- Detection gap: Closeout verified route availability and content, but had no
  screenshot-parity assertion against the approved visual reference.
- Prevention: Focused DOM guardrails for the hero/card composition plus desktop
  and mobile screenshots stored with this task.
- Guardrail evidence: Focused hero/card DOM tests, zero-finding focused ESLint,
  passing surface-complexity audit, and responsive browser screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Baseline | User-supplied screenshot and `training-source` reference | Fail | Current route uses generic PageShell header and divided rows. |
| Focused tests | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/(main)/training/__tests__/page.test.tsx' 'src/features/training/__tests__/hub-module-grid.test.tsx' 'src/features/training/__tests__/hub-module-tile.test.tsx'` | Pass | 3 suites, 8 tests. |
| Focused lint | `cd frontend && ./node_modules/.bin/eslint <8 changed training files>` | Pass | Zero errors or warnings. |
| Design audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs <page/grid/tile>` | Pass | All three changed UI files passed. |
| Noise gate | Manual review using `impeccable` noise-gate contract | Pass | Removed the generic duplicate page header/description and divided-row treatment; kept only the training navigation, one primary assessment action, and actionable course cards. The installed `npx impeccable` binary does not expose the repository skill's `noise-gate` command, so the file-backed contract was applied manually. |
| Desktop browser | Local artifact: `.codex-artifacts/training-hub-visual-parity/desktop-final.png` | Pass | Signed-in 2048×900 route shows the black hero and eight 199px cards in one row; `scrollWidth === clientWidth === 2048`. The repository retention guard intentionally excludes generated browser artifacts from Git. |
| Mobile browser | Local artifact: `.codex-artifacts/training-hub-visual-parity/mobile-final.png` | Pass | Signed-in 375×812 route stacks navigation and cards with 44px primary touch targets and no horizontal overflow. The repository retention guard intentionally excludes generated browser artifacts from Git. |
| Responsive readback | Agent Browser at 375, 414, 768, 1024, 1440, and 2048px | Pass | Every viewport returned `scrollWidth === clientWidth` and all 8 cards. |
| Interaction | Agent Browser clicks `Take the Assessment` and `Start Here` | Pass | Assessment navigated to `/training/growth`; Start Here navigated to `/training#start-here` with the section 154px below the viewport top. |
| Publication | `npm run codex:finish -- --message "Match training hub reference design" --session S248 --files <task-owned paths>` | Pass | Published 11 exact files to `origin/main` at `c105a4c8bdb35848f0ef1bf907427533d1c2c2ae`. |
| Production deployment | Vercel deployment `dpl_6d9njRtUEayxJywxs7JCUMNpi4er` | Pass | Ready production deployment cloned and built `The-Alleato-Group/project-management@main` commit `c105a4c8bdb3`; `projects.alleatogroup.com` is an active alias. |
| Production desktop | Local artifact: `.codex-artifacts/training-hub-visual-parity/production-desktop.png` | Pass | Signed-in production route at 2048×900 renders eight 199px course columns with `scrollWidth === clientWidth === 2048`. |
| Production mobile | Local artifact: `.codex-artifacts/training-hub-visual-parity/production-mobile.png` | Pass | Signed-in production route at 375×812 renders all 8 course entries with `scrollWidth === clientWidth === 375`. |
| Production interaction | Agent Browser on `https://projects.alleatogroup.com/training` | Pass | The live `Take the Assessment` action navigated to `https://projects.alleatogroup.com/training/growth`. |

## Remaining Risk

- `Ask the Library` retains its existing production provider/index blocker. The
  redesigned landing does not hide that route's explicit error/recovery state.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
