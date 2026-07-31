# Task: Submittal Detail Layout Tidy

Status: Complete
Owner: Codex
Created: 2026-06-25

## Objective

Update the submittals detail page for project `25125` so the General Information panel is
single-column and ordered as requested, and reorganize the right-side detail sections.

## Scope Checklist

- [x] Locate active submittal detail detail-page client component used by
  `frontend/src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx`.
- [x] Update General Information to one-column layout.
- [x] Reorder General Information fields to: number, revision, spec section, package,
  Link Drawings, description.
- [x] Add right-side section "Parties and Responsibility" with responsibility-related fields.
- [x] Add right-side section "Dates and Timeline" with issue/received/final/lead/required-on-site dates.
- [x] Verify on the target page that field order and section placement match.
- [x] Remove unused legacy linked-drawings panel that still rendered a duplicate
  Linked Drawings heading/list.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Route target located | `rg --files .../submittals/[submittalId]/page.tsx` | Pass | Detail page component found. |
| Client component updated | `frontend/src/features/submittals/submittal-detail-client.tsx` | Pass | Current structure uses `DetailLayout` with `General Information` as main content, `Parties and Responsibility` and `Dates and Timeline` in the sidebar, and `Workflow` in the full-width `footer` row below the two-column grid. |
| Legacy linked-drawings panel removed | `frontend/src/features/submittals/submittal-linked-drawings-panel.tsx` | Pass | `rg` showed no imports; deleted the dead panel that still contained a duplicate Linked Drawings heading/list. |
| Structural verification | `frontend/src/components/layout/detail-layout.tsx` | Pass | `DetailLayout.footer` renders below the main/sidebar grid, matching the requested full-width Workflow row. |
| Browser verification | `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/details-tab.png` | Pass | Exact route loaded authenticated at `http://127.0.0.1:3001/25125/submittals/7dfbccac-6ccf-4d69-8129-7de7918c5248`; Details tab showed the normal page header, no duplicate Linked Drawings table, the single `Drawing` link control, and Workflow below the main detail row. |
| Linked drawing dropdown proof | `/Users/meganharrison/.codex/worktrees/alleato-pm-submittal-loop/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-browser-proof/linked-drawing-dropdown.png` | Pass | Exact route on `127.0.0.1:3002`; `Drawing` trigger is enabled, opens the project drawing dropdown, and linked A201 is labeled `Linked`. |
