# Task: Training Library Breadcrumb

Status: Complete
Delivery lane: Fast
Owner: Codex Strainingbreadcrumb

## Objective

On training resource detail routes, label the collection breadcrumb `Library`
and link it to the canonical `/training/library` route.

## Verification

- [x] Production DOM localized the incorrect boundary: `Resources` linked to
      `/training/resources`.
- [x] Shared header breadcrumb mapping now returns `Library` linked to
      `/training/library`.
- [x] Focused unit test passes: 1 suite, 4 tests.
- [x] Scoped ESLint and `git diff --check` pass.

## Failure-Loudly Guardrail

The route override is centralized in `breadcrumb-utils.ts` and covered by a
focused regression test so future URL-segment formatting cannot restore the
non-canonical collection link.
