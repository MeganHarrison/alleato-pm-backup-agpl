# Handoff: Tablet Table Controls

Status: In Progress
Session: SROOT-FILTER-TABLET
Task: LOCAL-FILTER-TABLET-20260722

## Scope

Shared table filter-sheet sizing, close-control clearance, Company mobile header description, add/more action order, and mobile navigation drawer treatment.

## Evidence

- Source diagnosis: `FilterFields` uses desktop-sized controls inside a full-width tablet sheet.
- Source diagnosis: `SheetContent` positions the close control at `top-4 right-4`, while the filter-header Clear action reaches that edge.
- Source diagnosis: Company supplies a redundant header description on mobile; generic header action resizing distorts arbitrary button proportions.
- `npx jest --runInBand --runTestsByPath src/components/tables/unified/__tests__/table-toolbar-view-switcher.test.tsx src/components/tables/unified/__tests__/table-toolbar-tablet-filter.test.tsx`: pass, 5 tests.
- Targeted ESLint: no errors; six pre-existing warnings in the Company page and generic numeric filter path.
- Browser route: blocked by the available session redirecting to `/auth/login` on local and production.
- Mobile navigation: light semantic surface, neutral active state, existing `bg-black/50` Sheet overlay, and dynamic viewport height. `mobile-bottom-nav.test.tsx`: pass, 8 tests. App-sidebar complexity audit: pass.

## Next Step

Restore an authorized browser state, capture tablet and mobile screenshots on the canonical Company route, then publish the task-owned changes without absorbing unrelated workspace dirt.
