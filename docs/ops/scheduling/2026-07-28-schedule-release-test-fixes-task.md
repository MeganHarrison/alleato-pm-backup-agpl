# Scheduling release-suite contract repairs

## Scope

Refresh the six scheduling tests exposed by the expanded release gate without
changing production behavior.

## Acceptance

- Calendar tests cover the persisted/default time zone and post-write reload.
- Task route tests assert the current structured guardrail error envelope.
- Component tests use current accessibility roles and isolate unrelated API reads.
- Hierarchy tests isolate task paging from segment retrieval.
- The resource calendar interaction has enough time for the full-suite load.
- All six suites pass together and the expanded scheduling release gate passes.

## Evidence

- Initial release gate: 64/70 suites and 369/379 tests passed; the six
  failures in this scope accounted for all ten failed tests.
- Focused validation after repair: 6/6 suites and 23/23 tests passed.
- Focused ESLint on all six test files passed with no findings.
- React async-isolation repair: the modal tests now return valid endpoint-
  specific contacts and segment responses, await the settled segment state,
  and pass 5/5 without console warnings.
- Independent code review: APPROVE, no findings.
- Independent React review: APPROVE; 5/5 independently rerun with no console
  or React `act(...)` warnings.
