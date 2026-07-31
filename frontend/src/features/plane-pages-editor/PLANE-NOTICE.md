# Plane Pages editor adaptation notice

This feature directly adapts Plane Pages editor source from Plane revision
`39856932cd6b9bd17eab0920506d628190b47af2` (`v1.4.0-rc1-11`):

- `apps/web/core/components/pages/editor/title.tsx`
- `apps/web/core/components/pages/editor/editor-body.tsx`
- `apps/web/core/components/pages/editor/header/root.tsx`
- `apps/web/core/components/pages/editor/toolbar/root.tsx`
- `apps/web/core/components/pages/editor/summary/root.tsx`
- `apps/web/core/components/pages/navigation-pane/tab-panels/info/version-history.tsx`
- `apps/web/core/components/pages/version/root.tsx`
- `apps/web/core/components/pages/version/main-content.tsx`

Copyright (c) 2023-present Plane Software, Inc. and contributors.

SPDX-License-Identifier: AGPL-3.0-only

Modified for Alleato on 2026-07-31. Plane's MobX, collaborative editor, and
realtime service contracts are replaced by an injected
`PlanePagesEditorAdapter`. The production adapter persists block documents
through Alleato's permission-guarded, project-scoped notes API. Comments and
version history remain visibly unavailable until persistent APIs exist; the
integration does not simulate either capability. The replacement preserves Plane's centered document
canvas, title treatment, block-oriented editing, top toolbar, and right-side
history model. The comments contract is an Alleato extension placed in the same
progressively disclosed side panel. The bundled memory adapter supports
deterministic component tests only and is not used by the Pages route.
