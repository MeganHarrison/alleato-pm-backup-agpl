# Task: Complete Training Guide Route Wiring

Status: Done
Owner: Session S232
Created: 2026-07-26
Task ID: ALL-20
Linear Issue: ALL-20 — https://linear.app/alleato-group/issue/ALL-20/t6-resource-cards-guide-viewer-migrate-written-guides
Related Handoff: `docs/ops/handoffs/2026-07-26-S225-training-module-guides.md`

## Objective

Authenticated employees can discover and read all three versioned Alleato
training guides from `/training`, with browser proof for every guide route.

## Scope

- Own the static guide catalog, guide summaries, and guide source loading.
- Own `/training/guides/[guideSlug]` and the guide entry points on `/training`.
- Reuse `GuideViewer`, `MarkdownRenderer`, `PageShell`, and the existing training
  route; do not add a second reader or page-local markdown styling.
- Exclude edits to database-backed training resources and the review/finder
  workflows.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/content/training-guides/catalog.ts`
- Existing shared primitives/services:
  `frontend/src/features/training/GuideViewer.tsx`,
  `frontend/src/components/docs/markdown-renderer.tsx`,
  `frontend/src/components/layout/page-shell.tsx`
- Deprecated or parallel paths: N/A

## Attention Brief

- Primary user: Authenticated Alleato employee.
- Primary job: Choose and read the guide relevant to current work.
- Primary decision: Which of the three guides answers the immediate need.
- Tier 1: Guide title and body.
- Tier 2: Concise guide descriptions and the app shell breadcrumb.
- Tier 3: N/A.
- Hide until requested: Role metadata and source-file details.
- Remove: Cards, badges, decorative icons, duplicate guide titles, duplicate
  breadcrumb rows, and duplicate navigation actions.
- Primary action: Open a written guide.
- Failure-loudly behavior: Unknown slugs return 404; missing or malformed known
  guides name the affected slug in the route error boundary.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] `/training` links to the PM Handbook, Superintendent Handbook, and Alleato
      PM Software Guide.
- [x] Each `/training/guides/[guideSlug]` route renders the matching guide in the
      authenticated app shell.
- [x] Unknown guide slugs return the canonical not-found boundary.
- [x] Missing or malformed known guide files fail with a guide-specific error.
- [x] External-product branding is absent from final guide content.
- [x] Resource cards continue to open canonical external URLs in a new tab.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
      unchanged.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Browser proof covers `/training` and all three guide routes.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned product files are published on `origin/main`; the isolated
      workspace publication is verified by exact file-blob parity.

## Failure-Loudly Contract

- Cause surfaced as: `Training guide '<slug>' could not be loaded` or a
  guide-specific frontmatter contract error; unregistered slugs use `notFound()`.
- Detection path: catalog/route tests plus direct browser navigation to all three
  registered routes and one unknown route.
- Recovery path: restore or correct the named MDX file and rerun the focused
  guide test command.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: the prior implementation narrowed ALL-20 to content conversion
  even though the issue acceptance contract required an in-app guide viewer.
- Detection gap: closeout relied on parser/content tests and explicitly omitted
  browser verification, so the missing user-facing route was not a failing gate.
- Prevention: route/catalog tests and required browser proof for every registered
  guide slug.
- Guardrail evidence: the focused Jest contract now covers the catalog, all
  registered route params, the unknown-slug boundary, guide links, and resource
  fallbacks; `npm run check:routes` blocks a conflicting dynamic route.
  Authenticated desktop/mobile browser evidence and production trace readback
  are recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Focused tests | Focused Jest feature/content run plus explicit App Router test paths | Pass — 45 tests | Covers guide content/catalog, reader route, training index, resource external links, and unknown slugs. |
| Route guardrail | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Targeted lint | `npx eslint 'src/content/training-guides/**/*.{ts,tsx}' 'src/features/training/**/*.{ts,tsx}' 'src/app/(main)/training/**/*.{ts,tsx}'` | Pass | No warnings or errors. |
| Production build | `NODE_OPTIONS='--max-old-space-size=12288' npx next build` | Pass | All three guide slugs emitted as SSG routes. The repository's 7 GB wrapper first OOMed; the documented 12 GB dev capacity passed. |
| Server trace | `.next/server/app/(main)/training/guides/[guideSlug]/page.js.nft.json` readback | Pass | Exactly three training-guide MDX files included. |
| Authenticated desktop browser | `agent-browser`, 1440×900 | Pass | `/training` exposed three canonical guide links; all three guide pages rendered 5,565–19,798 article characters without horizontal overflow. |
| Authenticated mobile browser | `agent-browser`, 375×812 | Pass | Three guide links, 136–157 px touch heights, no horizontal overflow; PM Handbook rendered in the app shell. |
| External resource links | `/training` DOM readback | Pass | 67 visible resource links all had `target="_blank"` and `rel` containing `noreferrer`. |
| Unknown slug | `/training/guides/not-a-guide` DOM readback | Pass | Canonical not-found UI rendered and no guide article was present. |
| Branding guardrail | Guide content test + live Software Guide DOM | Pass | Case-insensitive forbidden-brand match was false. |
| Repository typecheck | `NODE_OPTIONS='--max-old-space-size=12288' npx tsc --noEmit --pretty false` | Unrelated debt | 214 existing diagnostics; zero matches in task-owned training paths. First owners include admin API route exports and `admin/daily-briefs/[briefId]/fanout-client.tsx`. |
| Product publication | `origin/main@4fe672146` | Pass | Exact ALL-20 product paths published through the isolated-workspace integration flow. |

## Remaining Risk

- None in the changed boundary.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
