# Verification: hidden project portfolio visibility

Date: 2026-07-30

## Deployment

- Production deployment: `dpl_6TSPgDtkJexbka3N63BUAVSdCZoa`
- Status: Ready
- Source: `The-Alleato-Group/project-management@main` commit `a5ac6af1fc7bae67e5ba8e79be4cf551d6bba195`
- Deployment URL: `https://frontend-3gpf90wl6-meganharrisons-projects.vercel.app`

## Database readback

The controlled update matched and changed exactly eight records. Each now has `phase = 'Hidden'`, `archived = false`, `archived_at = null`, and `archived_by = null`.

| ID | Project |
| --- | --- |
| 67 | Vermillion Rise Warehouse |
| 760 | Exol Wilmer |
| 761 | Ulta Beauty Fresno |
| 866 | Goodwill Morris |
| 871 | Goodwill Pioneer |
| 877 | Goodwill Brookville Road |
| 1014 | NEXCOM SEDC |
| 1016 | Goodwill Kokomo |

The exclusion readback remained unchanged:

- Champaign Ace Addition: `Current`, active, prior archive metadata retained.
- Uturum Aut: `Archive`, archived, current archive metadata retained.
- Vargo Greenwood Permitting: `Development`, active, prior archive metadata retained.

The eight retained projects continue to have 2,263 linked `document_metadata` records. The update changed project visibility/archival fields only; it did not delete or re-key projects or linked records.

## Regression and negative-path proof

- `pnpm exec jest --runInBand --runTestsByPath src/app/api/projects/__tests__/route.test.ts`: PASS (24 tests).
- `pnpm exec eslint src/app/api/projects/route.ts src/app/api/projects/__tests__/route.test.ts src/lib/auth/owner.ts`: PASS.
- The regression suite verifies that a member query applies `phase.is.null,phase.neq.Hidden`, that Megan skips this exclusion, and that Brandon does not skip it.

## Deferred visual proof

Every available saved browser state redirected to `/auth/login`. The production screenshot is therefore not represented as complete evidence. Refresh an authenticated Megan session and capture the portfolio route before changing this result to `PASS`.
