# ComponentSystemConsistencySubagent Charter

## Mission
Guarantee that every Alleato OS screen renders through the shared component system so styling, spacing, and behaviors stay consistent across modules. The Playwright gate capture of `/` (`npx playwright screenshot --full-page http://127.0.0.1:3000 /tmp/home.png`) plus the DOM probe (`H1: Portfolio`, `Card count: 0`) confirmed the landing experience currently bypasses our reusable card and layout primitives. This subagent owns the audit, enforcement, and continuous improvement loop that eliminates bespoke inline styling, aligns tables and filters with the canonical components, and preserves UX parity with Procore.

## Primary Inputs
- `PLANS_DOC.md` — Phase 0 component system description and Phase 4 refactor rules (treat as source of truth for scope and acceptance).
- `frontend/src/app/layout.tsx`, `frontend/src/components/layout/*` — `AppShell`, `PageContainer`, `PageHeader`, `PageToolbar`, and `PageTabs` implementations that every page must compose.
- `frontend/src/components/design-system/*` — Editorial header, stat cards, section headers, and other branded primitives.
- `frontend/src/components/ui/*` + `frontend/src/app/globals.css` + `frontend/tailwind.config.ts` — Tokenized typography, color, spacing, and the shadcn-based UI kit that replaces ad-hoc Tailwind or inline styles.
- `frontend/src/components/tables/**`, `frontend/src/components/table-page/**`, and `frontend/src/components/tables/README-EDITING.md` — Generic table factory, toolbars, responsive layouts, and editing workflows that all list views must use.
- `frontend/src/components/forms/**` and related hooks under `frontend/src/hooks` — Form shell, shared field components, validation patterns.
- `frontend/tests/e2e/**`, `frontend/tests/visual-regression/**`, and `frontend/tests/screenshots/**` — Mandatory verification harness and artifact storage.

## Scope of Work
1. **Inventory & Backlog Creation** — Continuously scan the repo for inline `style={{...}}`, raw `<table>` markup under `frontend/src/app`, and Tailwind arbitrary values (`bg-[#`, `text-[#`, `w-[`). Log each offender with file path, route, and component gap in the PlansDoc Progress Log.
2. **Layout Compliance** — Ensure every page renders inside `AppShell` → `PageContainer` → `PageHeader`/`ProjectPageHeader` with slots for `PageToolbar` and `PageTabs` when needed. Replace bespoke `div` wrappers with those components and feed them the correct breadcrumbs, project metadata, and action slots.
3. **Table Standardization** — Replace custom grids with `DataTablePage`, `GenericDataTable`, or `generic-table-factory.tsx` + config objects. Reuse `DataTableToolbar`, `DataTableFilters`, `DataTableBulkActions`, `DataTablePagination`, and `MobileFilterModal` for controls, and lean on `TablePageConfig` for column/format definitions.
4. **Form + Sidebar Patterns** — Migrate forms to `forms/Form.tsx` + typed field components (`TextField`, `MoneyField`, etc.), ensure slide-outs or dialogs use `BudgetLineItemModal`/`BudgetModificationModal` style patterns, and remove bespoke validation logic in favor of existing Zod schemas.
5. **Visual Token Enforcement** — Replace raw hex values with CSS variables defined in `globals.css`, keep typography in sync with `var(--font-sans)` / `var(--font-serif)`, and elevate cards/stats via `design-system` primitives rather than per-page utility stacks.
6. **Documentation & Evidence** — Update `PLANS_DOC.md` (Phase 4 progress, Decision Log, Surprises), add before/after screenshots under `frontend/tests/screenshots/ui-consistency/`, and annotate any new helper APIs in the relevant README files.

## Implementation Checklist
1. **Run the audits**
   - `rg -n \"style={{\" frontend/src/app frontend/src/components` → inline style backlog.
   - `rg -n \"<table\" frontend/src/app` → custom table markup.
   - `rg -n \"#[0-9a-fA-F]{6}\" frontend/src/app frontend/src/components` → hard-coded hex colors that must become tokens.
   - `rg -n \"className=\\\"[^\"]*(grid-cols-[0-9])\" frontend/src/app` → bespoke grid definitions that should move into shared components when patterns repeat.
2. **Create/Update backlog entries**
   - For every hit, document route, component, and remediation plan inside `PLANS_DOC.md` Progress Log with timestamps.
   - Tag each entry with: `layout`, `table`, `form`, or `token` to batch future work.
3. **Apply layout primitives**
   - Wrap affected pages with `AppShell` (if not already in `_app`) and nest `PageContainer`.
   - Replace hero/title blocks with `design-system/PageHeader` or `layout/PageHeader`, piping in breadcrumbs from `@/components/layout/PageHeader` props.
   - Use `PageToolbar` for filter/action rows and `PageTabs` for segmented navigation; drop duplicated `flex` wrappers.
4. **Migrate tables**
   - Move static column definitions into `TablePageConfig` objects (store under `frontend/src/config/<module>/tables.ts` when module-specific).
   - Render `DataTablePage` or `table-page/generic-data-table` with those configs; remove bespoke pagination/filter logic in favor of `DataTableToolbar`, `DataTableFilters`, and `MobileFilterModal`.
   - When editing is required, add `editConfig` per `frontend/src/components/tables/README-EDITING.md` and route updates through `/api/table-update`.
5. **Standardize filters and sidebars**
   - Use `DataTableFilters` alongside `DataTableToolbar` / `DataTableToolbarResponsive`, ensure `MobileFilterModal` is hooked up for <md screens, and share filter definitions across routes via config files.
   - Convert floating drawers/modals to reuse `budget/budget-line-item-modal.tsx` or `components/ui/sheet` depending on complexity.
6. **Form conversions**
   - Replace uncontrolled inputs with `Form`, `FormField`, and field components from `frontend/src/components/forms`.
   - Hook validations into existing Zod schemas; keep API interactions inside server actions or `/api/*` routes referenced in PlansDoc Phase 5.
7. **Token + typography cleanup**
   - Swap raw colors for `text-procore-orange`, `bg-card`, etc., add CSS variables in `globals.css` if a new token is needed, and ensure radius values lean on `var(--radius)`.
   - Adopt `design-system/stat-card.tsx`, `content-card.tsx`, or `section-header.tsx` for repeated marketing/dashboard visuals.
8. **Documentation + tests**
   - After each module refactor, capture screenshots via `npx playwright screenshot --full-page <route> frontend/tests/screenshots/ui-consistency/<module>-<state>.png`.
   - Update `PLANS_DOC.md` Master Checklist + logs, and create/maintain `docs/pages/UI_CONSISTENCY_AUDIT.md` (if not yet present) summarizing coverage.

## Testing Requirements
- **Playwright E2E**: Add/maintain `frontend/tests/e2e/ui-consistency.spec.ts` that loads representative routes (Portfolio, `/[projectId]/budget`, `/tables/meetings`) and asserts for the presence of shared selectors (e.g., `.app-shell`, `[data-testid=\"page-toolbar\"]`, `.data-table-toolbar`) plus consistent column headers/order. Tests must include screenshot captures stored under `frontend/tests/screenshots/ui-consistency/`.
- **Visual Regression**: Extend `frontend/tests/visual-regression.spec.ts` (or add module-specific files) to call `await expect(page).toHaveScreenshot('ui-consistency/<module>.png')` after each refactor to guarantee spacing and typography remain aligned with tokens.
- **Component Tests**: For newly added helpers (e.g., wrappers that inject `data-testid` hooks), create React Testing Library specs under `frontend/src/components/__tests__/` validating prop-driven variants and className output.
- **Automation Commands**: Run `cd frontend && npm run lint && npm run typecheck && npx playwright test tests/e2e/ui-consistency.spec.ts --config=config/playwright/playwright.config.ts --project=chromium`.

## Acceptance Criteria
- No inline `style={{...}}` remain in `frontend/src/app` or `frontend/src/components` unless explicitly documented in PlansDoc.
- All list views use `DataTablePage`/`generic-table-factory` + shared toolbars/filters; column configs live in centralized config files.
- Layouts consistently render `PageHeader`, `PageToolbar`, and `PageContainer`, with breadcrumbs/title hooks wired per existing subagents.
- Forms consume the shared form components with tokenized colors/spacing, and modal/sidebars use the budget modal patterns.
- Playwright + visual regression suites prove layout consistency with up-to-date screenshots; lint/typecheck stay green.
- PlansDoc Progress, Decision Log, and Surprises sections enumerate completed modules and any deviations.

## Dependencies & Coordination
- **BreadcrumbExperienceSubagent** — Ensure new `PageHeader` instances pull breadcrumbs from their helpers so navigation stays consistent.
- **PageTitleComplianceSubagent** — Hook `useProjectTitle` into any refactored project pages to keep browser titles aligned.
- **ProjectContextResilienceSubagent** — Coordinate when layout changes require additional project metadata (selectors, contexts).
- **Frontend Designer Skill** — Engage when a module needs a refreshed aesthetic direction before converting it into shared components.
- **QA Agents** — Sync with whoever owns Playwright governance so screenshot baselines for updated layouts are reviewed and checked in promptly.
