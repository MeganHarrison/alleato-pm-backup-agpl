# Browser verification

Status: PASS

Authenticated local runtime: `http://localhost:3011`

## User flows

- `/brain` rendered exactly five live Business Areas: AI, Finance, Internal
  Operations, Leads, and Marketing.
- Finance was visibly marked restricted without exposing content.
- Internal Operations loaded live branch views: Knowledge 77 rows, Meetings
  157 rows, Tasks 215 rows, and Files 30 rows.
- File search for `expense report` updated the URL and returned the matching
  source.
- Opening that result reached the stored Alleato SharePoint source.
- The next-page control changed the URL to `?tab=files&page=2` and loaded the
  second server page.
- Title sort changed the URL to
  `?tab=files&page=1&sort=title&sort_dir=asc`, proving sort state resets and
  reloads from the first server page.
- Selecting 50 rows changed the URL to include `per_page=50`.
- The admin upload action opened
  `Upload Knowledge Source to Internal Operations`; no test document was
  persisted.
- An existing authenticated external contact was redirected from `/brain` to
  `/access-denied?reason=brain-internal-only`; no Business Area list loaded.
- An existing active internal non-admin without Finance membership opened
  `/brain/3` and saw the route-owned Finance denial. No resource tabs, rows, or
  upload action rendered.

## Responsive proof

No horizontal overflow was detected at 375, 414, 768, 1024, or 1440 pixels.
Screenshots are stored in `screenshots/` for every width, plus desktop/mobile
Business Area list proof.

The compact view uses the canonical table's record-list representation; desktop
uses the canonical tabular representation.

After the route files took direct ownership of the canonical `PageShell`,
desktop and mobile screenshots were refreshed from the final source state.
The mobile readback remained 375 CSS pixels wide with no horizontal overflow.

Authorization screenshots:

- `screenshots/brain-finance-denied-1440.png`
- `screenshots/brain-external-denied-1440.png`

## Accessibility observation

The axe scan reported shared-shell issues: two unnamed shell buttons, nested or
duplicate main landmarks, and active-tab/badge contrast. These selectors belong
to the existing project selector, application shell, and shared PageShell tab
primitive. This task does not hide them with a page-local override; the shared
owners remain the durable fix location.
