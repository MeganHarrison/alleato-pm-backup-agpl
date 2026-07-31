# Reuse-First / Path-of-Least-Resistance Gate

This gate applies to every implementation task, especially frontend pages,
tables, tabs, forms, dashboards, and detail surfaces.

Before writing JSX, CSS, or a new data-flow wrapper:

1. Search for the canonical route and the component that currently owns the
   requested behavior.
2. Inspect the canonical page, its table/config definition, shared tabs, hooks,
   and data query.
3. Reuse the canonical implementation directly. Change only the input query,
   scope, or adapter data required by the new route.
4. Do not copy/paste the canonical JSX or create a parallel table/config/tab
   implementation.
5. If direct reuse is impossible, document the exact incompatibility before
   implementing an adapter. The adapter must remain thin and must not recreate
   the canonical interaction or visual contract.

## Stop condition

If a new table, tab bar, form, or detail layout is being written while an
existing implementation appears to cover the request, stop and inspect the
existing owner. “Uses the same shared primitive” is not sufficient evidence of
reuse; the canonical component/config must be composed or the incompatibility
must be explicit.

## Review evidence

Every frontend task should be able to name:

- canonical owner inspected;
- files/components reused;
- query or scope changed;
- why any new adapter exists;
- proof that the canonical interaction and visual behavior still renders.
