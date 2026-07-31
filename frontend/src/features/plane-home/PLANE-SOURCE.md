# Plane Home source mapping

This feature is copied and adapted from Plane release `v1.3.1`, revision
`39856932cd6b9bd17eab0920506d628190b47af2`.

Copyright (c) 2023-present Plane Software, Inc. and contributors.

SPDX-License-Identifier: AGPL-3.0-only

Upstream templates used:

- `apps/web/core/components/home/root.tsx`
- `apps/web/core/components/home/home-dashboard-widgets.tsx`
- `apps/web/core/components/home/widgets/recents/index.tsx`
- `apps/web/core/components/home/widgets/recents/issue.tsx`
- `apps/web/core/components/home/widgets/recents/project.tsx`

Alleato modifications:

- Replaced Plane stores and SWR services with the existing guarded Alleato
  project, task, meeting, and daily-log API owners.
- Replaced Plane issue/project entity rows with live Alleato task and activity
  rows, preserving the compact, open-list Home composition.
- Removed configurable widgets, Stickies, empty-state artwork, aggregate
  metrics, and decorative dashboard modules under the Alleato noise gate.
- Added section-level failure states and retries so partial data failures are
  visible without hiding healthy project data.

The network source offer remains available at `/auth/source`. See
`LICENSES/NOTICE-PLANE.md` for the repository-wide notice and exact
corresponding-source location.

