# Orphan-route gate

A CI ratchet that stops new **top-level pages** from being added without being
reachable from anywhere in the app. It exists to prevent route/page bulk from
accumulating: historically a page gets built, superseded, or forgotten, nothing
links it, and nothing prunes it — so the surface grows unbounded.

- Script: [`frontend/scripts/build/check-orphan-routes.mjs`](../../frontend/scripts/build/check-orphan-routes.mjs)
- Baseline: [`frontend/scripts/build/orphan-routes.baseline.json`](../../frontend/scripts/build/orphan-routes.baseline.json)
- Enforced in CI by the `quality-gate.yml` **Quality Gate** workflow (PRs).

## What counts as an orphan

The check reuses the exact enumeration + reference heuristic that backs the
Page Access inventory (`route-inventory.mjs` → `generateRouteInventory`). Each
route carries a `refCount`: the number of source files that mention its route
string. An **orphan** is a page with `refCount === 0` — nothing references it.

### Scope: fully-static top-level routes only

The gate deliberately considers **only** routes with no dynamic segment (no
`[...]`). This is not laziness — it is correctness:

- Project-scoped routes (`/[projectId]/…`) and dynamic detail pages
  (`/x/[id]`) are linked at runtime via template literals like
  `` `/${projectId}/tasks` ``. A static string scan cannot see those links, so
  such routes almost always report `refCount === 0`. Gating them would produce
  ~100 false positives (including live, actively-used pages).
- Static top-level routes are normally linked with a literal href
  (`href="/megans-dashboard"`). For those, `refCount === 0` is a trustworthy
  "nothing links here" signal.

So a passing gate does **not** prove every page is reachable — it proves no new
*statically-unlinked top-level* page slipped in. That is the class that
actually drives orphan accumulation.

> Baseline membership means "not statically linked", **not** "dead code". Some
> baselined routes are reached by other means (admin deep links, redirect
> targets, experiments). The baseline is the review list of those exceptions —
> a good place to start a cleanup pass.

## When the gate fails on your PR

You added (or exposed) a top-level page that nothing links to. Two fixes:

1. **Wire it into navigation** — add a literal `href`/`path` so the page is
   actually reachable. This is the right fix for a real user-facing page.
2. **Baseline it, intentionally** — if the route is deliberately unlinked
   (a redirect target, a deep-link-only surface, an experiment), run:

   ```bash
   node frontend/scripts/build/check-orphan-routes.mjs --write-baseline
   ```

   commit the updated baseline, and say **why** in your PR description.

## Updating the baseline after a cleanup

When you delete or wire up a baselined route, prune it from the baseline the
same way (`--write-baseline`). The check reports baseline entries that are no
longer orphaned so you know when a prune is due.
