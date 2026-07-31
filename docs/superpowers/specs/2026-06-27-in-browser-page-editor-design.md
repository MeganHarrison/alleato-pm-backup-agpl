# In-Browser Page Editor — Design Spec

**Date:** 2026-06-27
**Status:** Approved (brainstorming) — ready for implementation plan
**Author:** Claude (with Megan)

## Problem

Editing a page's shell config (PageShell `variant`, `title`, `description`/subheading, header
visibility, and which content sections show) currently means opening VS Code or sending the
change to Claude Code. For small, frequent layout tweaks that round-trip is slow. We want to
flip these settings directly from the running page in the browser and have the change persist
to the real source code.

## Goal

A dev-only **"Edit page"** affordance in the footer that opens a drawer pre-filled with the
current page's settings. Editing a field previews instantly; **Save** writes the change back
into the page's `page.tsx` source file (git-tracked, single source of truth). Production builds
are completely unaffected — the entire feature tree-shakes out when `NODE_ENV !== 'development'`.

## Non-goals

- No production runtime config store. Config lives in code, full stop.
- No editing of arbitrary, un-wrapped child components. Section toggling works only for
  sections wrapped in the new `<PageSection>` component (opt-in, page by page).
- No auth/multi-user concerns — this is a local developer tool, dev server only.

## Decisions (from brainstorming)

1. **Persistence:** write back to the source `page.tsx`. Dev-only. (Not DB, not localStorage.)
2. **v1 scope:** PageShell header props + header on/off toggle + named-section toggles + live
   preview before save. All selected.
3. **Section toggles:** ship the generic `<PageSection>` wrapper + convert `ai-system-health`'s
   top-level panels as the reference. Other pages opt in later with zero editor changes.

## Architecture

Three layers, every one gated to development:

### 1. Drawer UI — `PageEditorDrawer` (client)
- Rendered by a dev-only footer link `PageEditorLauncher` (`process.env.NODE_ENV === 'development'`
  guard; renders `null` otherwise so it's dead-code-eliminated in prod).
- On open: calls the dev API to resolve + read the current page's props, pre-fills the form.
- Controls:
  - `variant` — select over the 7 `PageShellVariant` values.
  - `title` — text input.
  - `description` (subheading) — text input with a "Remove subheading" action that clears it;
    empty ⇒ the `description` prop is deleted from source entirely.
  - `eyebrow` — text input (string values only; JSX eyebrows are read-only/ignored).
  - `showHeader` — switch; off ⇒ writes `showHeader={false}`.
  - **Sections** — auto-listed from sections registered on the page (see layer 3); each a toggle.
- Edits are staged in local state and pushed to the preview context live. **Save** POSTs the
  staged values to the dev API. **Reset** reverts staged values to last-saved.
- Built from existing DS components (Sheet/Drawer, Select, Input, Switch, Button). No raw
  elements, no hardcoded colors (respects the design-system gate).

### 2. Dev API — `/api/__page-editor/*` (route handlers, dev-guarded)
Every handler returns `404` immediately if `process.env.NODE_ENV !== 'development'`.

- `GET /api/__page-editor/resolve?pathname=<url>` → resolves the URL to an absolute
  `page.tsx` path. Walks `frontend/src/app`, matching URL segments against folder segments
  while **skipping route-group folders** (`(admin)`, `(main)`, `(tables)`, …) and honoring
  dynamic segments. Returns `{ filePath }` or a clear error if ambiguous/not found.
- `GET /api/__page-editor/read?filePath=<abs>` → parses the file with the **TypeScript
  compiler API** (the `typescript` package, already a dependency — no new install), finds the
  `<PageShell>` JSX element, and returns its current `variant/title/description/eyebrow/
  showHeader` (string/boolean literal values only). Also returns the list of `<PageSection>`
  ids/titles/hidden-state found in the file.
- `POST /api/__page-editor/write` `{ filePath, pageShell?, sections? }` → applies a **TS-AST
  transform**: insert/update/remove the named attributes on the `<PageShell>` element, and
  add/remove the `hidden` attribute on `<PageSection id="…">` elements. Writes the file with a
  printer that preserves surrounding formatting as much as possible; on parse failure it makes
  **no write** and returns the error. Path safety: every target path is resolved to an absolute
  path, must live under `frontend/src`, must end in `.tsx`, and must contain no `..` traversal.
  (PageShell-prop writes target the resolved `page.tsx`; section-toggle writes may target a
  child component file under `src/components` — both are inside `frontend/src`, so this single
  rule covers both while still refusing anything outside the source tree.)

**Why AST, not regex:** JSX attribute editing (especially deleting a prop or toggling a
boolean) is unreliable with regex across multiline/formatted props. The TS compiler API gives
us a real element + attribute model.

### 3. Preview context + section registry — `PageEditorProvider` / `<PageSection>` (dev-only)
- `PageEditorProvider` wraps the app **in dev only** (mounted from the root layout behind the
  `NODE_ENV` guard). Holds: staged preview overrides for PageShell props, and a registry of
  sections that registered themselves this render.
- `PageShell` reads the preview context **only in dev** via a tiny hook that no-ops (returns
  `undefined`) in prod, so prod behavior and bundle are unchanged. When a preview override is
  present, the displayed `variant/title/description/showHeader` use it; otherwise the real props.
- `<PageSection id title>` — wraps a content block. In dev it registers `{id, title}` with the
  context on mount and reads its preview hidden-state (so toggling hides it instantly); in prod
  it's a plain passthrough wrapper that just renders children (with the real `hidden` prop from
  source if set). This keeps a single component that's safe everywhere.

## Data flow

```
open drawer
  → GET resolve(pathname)   → filePath
  → GET read(filePath)      → current props + sections
  → drawer pre-fills, registers preview overrides = none

edit a field
  → drawer updates staged state
  → pushes override into PageEditorProvider
  → PageShell / PageSection re-render with preview values (instant, no write)

Save
  → POST write(filePath, {pageShell, sections})
  → API AST-edits page.tsx on disk
  → Next.js Fast Refresh reloads the route
  → drawer clears preview overrides; rendered page now reflects real source
```

## Section toggling — reference conversion

`ai-system-health`'s body is `<AiSystemHealthPanel />`, so its sections are declared inside a
child component (`ai-system-health-panel.tsx`), not in `page.tsx`. We need section toggles to
work regardless of which file declares the `<PageSection>`.

**Chosen mechanism:** each `<PageSection>` registers its own **source file path and line**
with the preview context, using the JSX `_source` info that Next.js injects in development
(`@babel/plugin-transform-react-jsx-source`). The drawer sends that `{ filePath, line, id }`
to the write API, which AST-edits the `hidden` attribute on the matching `<PageSection>` in
that file. Because the path-safety rule allows any `.tsx` under `frontend/src`, editing a
child component file is permitted. This means section toggles work for any `<PageSection>`
anywhere — no requirement that it sit in `page.tsx`.

**Reference conversion:** wrap `ai-system-health-panel.tsx`'s top-level panels in
`<PageSection id=… title=…>`. This is the only page-specific work in v1.

## Error handling

- Resolve ambiguous/not-found → drawer shows "Couldn't locate this page's source file" and
  disables editing (no silent failure).
- Read finds no `<PageShell>` → drawer shows header controls disabled with a clear reason;
  section controls still work if sections registered.
- Write parse/validation failure → **no file change**, drawer surfaces the exact error.
- Non-literal prop values (e.g. `title={someVar}`, JSX `eyebrow`) → shown read-only, not
  clobbered.
- All API handlers hard-404 outside development.

## Testing

- **Unit (Jest):** the AST read/transform module — round-trip a sample `page.tsx`: change
  variant, change title, delete description, set `showHeader={false}`, toggle a `<PageSection>`
  `hidden`; assert exact output and that non-literal props are untouched. Include a malformed
  file → asserts no write + error.
- **Path-safety unit:** write API rejects paths outside `frontend/src/app` and non-`page.tsx`.
- **Resolve unit:** pathname→file mapping skips route groups, handles dynamic segments, errors
  on not-found.
- **Prod-guard unit:** API handlers return 404 when `NODE_ENV` is not development; preview hook
  returns `undefined` in prod.
- **Manual/E2E (dev):** open drawer on `/ai-system-health`, remove subheading, save, confirm the
  source file now reads `<PageShell variant="dashboard" title="AI System Health">` and the page
  reloads without the subheading; toggle a section off, confirm `hidden` written + section gone.

## Guardrails (per CLAUDE.md core principles)

- **Prevented:** write API validates path (under `src/app`, `page.tsx`) and refuses on AST
  parse failure — can't corrupt arbitrary files or write broken JSX.
- **Caught pre-deploy:** prod-guard unit tests assert the feature is inert outside dev, so it
  can never ship to production users; AST round-trip tests cover the edit surface.
- **No silent failures:** every resolve/read/write failure surfaces a specific message in the
  drawer; write failures make zero file changes.

## Files (anticipated)

- `frontend/src/components/dev/page-editor/PageEditorLauncher.tsx` (footer link, dev guard)
- `frontend/src/components/dev/page-editor/PageEditorDrawer.tsx`
- `frontend/src/components/dev/page-editor/PageEditorProvider.tsx` (context + section registry)
- `frontend/src/components/dev/page-editor/page-section.tsx` (`<PageSection>`)
- `frontend/src/lib/dev/page-editor/page-shell-ast.ts` (read + transform; unit-tested)
- `frontend/src/lib/dev/page-editor/resolve-page-file.ts` (pathname→file; unit-tested)
- `frontend/src/app/api/__page-editor/resolve/route.ts`
- `frontend/src/app/api/__page-editor/read/route.ts`
- `frontend/src/app/api/__page-editor/write/route.ts`
- Edits: root layout (mount provider+launcher in dev), `page-shell.tsx` (read preview override
  in dev), `ai-system-health-panel.tsx` (wrap sections — reference conversion).
```
