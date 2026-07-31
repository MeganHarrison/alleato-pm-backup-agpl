# Handoff: Company Brain Layout Repair

1) Session ID: S202
2) Task ID: AAI-1208
3) Linear issue: AAI-1208
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1208/fix-company-brain-shell-collision-and-page-title-layout
5) Current status: In Progress
6) Files changed (absolute paths):
   - `/tmp/project-management-aai-1208/docs/ops/tasks/2026-07-20-company-brain-layout-repair.md`
   - `/tmp/project-management-aai-1208/docs/ops/handoffs/2026-07-20-S202-company-brain-layout-repair.md`
   - `/tmp/project-management-aai-1208/frontend/src/features/company-brain/company-brain.module.css`
   - `/tmp/project-management-aai-1208/frontend/src/features/company-brain/__tests__/company-brain-layout.test.ts`
7) Commands run and outcome:
   - Production route readback redirects unauthenticated users to login as expected.
   - Screenshot review and source localization found viewport-relative overlays caused by an unpositioned `.root`.
   - Focused Jest passed, 15 assertions across Company Brain layout and graph tests.
   - Shared dashboard header refactor reuses `WorkspacePageIntro` and `WorkspaceSection`; the focused tests still pass 15/15.
   - Surface complexity audit passed for the shared header, Company Brain experience, and graph canvas.
   - Time ranges now filter the typed graph and derived relationship counts. Focused Jest passes 17/17; empty ranges display an explicit recovery state.
   - Isolated-worktree ESLint is blocked because its ESM plugin dependencies are not installed in that worktree.
8) Evidence artifacts:
   - User-provided production screenshot.
   - `/tmp/company-brain-before.png` shows the unauthenticated boundary.
9) Top finding:
   - `.head`, `.metrics`, and `.hint` are absolutely positioned, but `.root` was not a positioning context, so they escaped the graph stage and overlapped global chrome.
   - The page title and metrics also competed with the graph. They now use the shared dashboard header and a supporting section below the graph.
   - The range control previously only varied particle speed. It now changes the graph data rendered by the canvas.
10) Recommended next action: publish the focused repair, then attach authenticated desktop and mobile screenshots to AAI-1208.
11) Handoff file path: `docs/ops/handoffs/2026-07-20-S202-company-brain-layout-repair.md`
12) Migration ledger evidence: No migration changes.
