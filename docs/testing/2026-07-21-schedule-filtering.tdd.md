# Schedule Filtering TDD Evidence

## Source

The user journey and acceptance criteria were derived during this implementation run. No external plan file was used.

## User journey

As a project team member, I want schedule search and filters to change every schedule view so that I can find the relevant activities without receiving misleading toolbar feedback.

## Localization

- Expected: search, status, task type, and date selections determine the task hierarchy supplied to each schedule view.
- Observed boundary: the toolbar updated `searchValue` and `activeFilters`, but the page supplied a hierarchy derived only from `dateFilter` to Gantt, table, board, timeline, and calendar.
- Runtime preflight: project 767 contained nine schedule tasks, and searching for `Rag pipeline` initially left all nine tasks visible.
- Authenticated production proof: after deployment, Gantt and Table views both showed only `Rag pipeline` with `1 of 9 rows`; a no-result search showed the empty state with `0 of 9 rows`; Clear Search restored all nine tasks.

## Task report

| Behavior | RED evidence | GREEN evidence | Guarantee |
|---|---|---|---|
| Shared schedule filtering | Focused Jest run failed because `schedule-task-filters` did not exist | Focused Jest run passed 7 tests | All schedule views can consume the same filtered hierarchy |
| Hierarchy-aware search | Missing implementation at RED | Name and WBS search tests pass | Matching descendants remain visible with their ancestors |
| Status and milestone filters | Missing implementation at RED | Individual and combined filter tests pass | Toolbar filter values reduce the task hierarchy using AND semantics |
| Date filtering | Existing behavior was page-local | Deterministic date test passes | Tasks active on the selected day remain visible with their ancestors |
| Immutability | No shared boundary existed | Immutability test passes | Filtering does not mutate the fetched hierarchy |
| Filtered row count | Toolbar rendered `9 rows` while one task was visible | Shared toolbar component test passes | Filtered tables show the visible count alongside the total count |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | Empty search and filters preserve the original hierarchy | `returns the full hierarchy when no filters are active` | Unit | PASS |
| 2 | Search matches task names and WBS codes without case sensitivity | `searches task names and WBS codes case-insensitively while preserving ancestors` | Unit | PASS |
| 3 | Status filtering uses valid schedule statuses | `filters by valid schedule status` | Unit | PASS |
| 4 | Milestones can be separated from regular tasks | `filters milestones from regular tasks` | Unit | PASS |
| 5 | Search, status, and type filters combine | `combines search, status, and task type filters` | Unit | PASS |
| 6 | Today filtering respects task date overlap | `keeps only tasks active on the selected day and their ancestors` | Unit | PASS |
| 7 | Filtering does not mutate source data | `does not mutate the original hierarchy while filtering` | Unit | PASS |
| 8 | The table toolbar reports filtered and total row counts | `shows the filtered count alongside the total count` | Component | PASS |

## Commands and results

- RED: `jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-task-filters.test.ts` - failed because the shared filter module was missing.
- GREEN: the same focused Jest target - 1 suite passed, 7 tests passed.
- Coverage: focused helper coverage - 89.47% statements, 82.53% branches, 100% functions, and 89.18% lines.
- Lint: touched files produced zero errors. One pre-existing design-system warning remains on the page's `min-h-[600px]` class.
- Toolbar RED: `jest --runInBand --runTestsByPath src/components/tables/unified/__tests__/table-toolbar-view-switcher.test.tsx` - expected `1 of 9 rows` but rendered `9 rows`.
- Toolbar GREEN: the same focused Jest target - 1 suite passed, 4 tests passed.
- Shared toolbar regression suite: 2 suites passed, 7 tests passed.
- Authenticated production: Vercel deployment `33eb513` reached Ready; Gantt, Table, no-result, and clear-search states passed on project 767.

## Known gaps

- Full-project typecheck was not run from this sparse checkout; Jest compiled the helper and test, and the canonical toolbar filter type is reused by the page.
- Two unrelated unified-table test files could not start from the sparse checkout because their additional page-level dependencies were not present. The two directly relevant shared-toolbar suites passed.

## Merge evidence

- `d021273` - RED checkpoint: failing schedule filter reproducer.
- `e133f35` - GREEN checkpoint: shared filtering wired to every schedule view.
- `aa3cf85` - Refactor checkpoint: canonical toolbar filter type reused.
- `76e21ae` - RED checkpoint: failing filtered-count toolbar reproducer.
- `33eb513` - GREEN checkpoint: filtered and total row counts shown together.
