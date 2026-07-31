import path from "node:path";
import { FlatCompat } from "@eslint/eslintrc";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "@typescript-eslint/eslint-plugin";
import designSystemPlugin from "./eslint-plugin-design-system/index.js";

const compat = new FlatCompat({
  baseDirectory: path.resolve(),
  recommendedConfig: false,
  allConfig: false,
});

const IGNORE_PATTERNS = [
  ".next/**",
  "**/.next/**",
  // Per-port dev dist dirs created by scripts/dev/start-frontend-clean.sh
  // (NEXT_DIST_DIR=".next-dev-${PORT}" / NEXT_TSCONFIG_PATH=".tsconfig-dev-${PORT}.json").
  // These hold compiled output, not source — linting them floods the report.
  ".next-dev-*/**",
  "**/.next-dev-*/**",
  ".tsconfig-dev-*.json",
  "**/node_modules/**",
  "dist/**",
  "build/**",
  "out/**",
  "coverage/**",
  "public/**",
  "storybook-static/**",
  "test-results/**",
  "scripts/**", // Utility scripts - allow console.log
  "tests/**", // Test files - allow console.log
  "verify-*.js", // Verification scripts - allow console.log
  "verify-*.mjs",
  "check-scrollbar.mjs",
  "verify-scrollbar-final.mjs",
  "sidebar-verification-standalone.js",
  "verify-transcript*.js",
  "verify-transcript*.mjs",
  "drizzle/**",
  "eslint-plugin-design-system/**", // Plugin source - excluded from linting but imported above
  "src/types/**",
  // Vendored third-party drop: Supabase UI "Platform Kit" (platform-kit-nextjs
  // registry). Kept verbatim so it stays updatable from the registry; it is
  // stock shadcn/ui and intentionally does not follow the design-system gates.
  "src/components/platform-kit/**",
];

const config = [
  {
    ignores: IGNORE_PATTERNS,
  },
  ...compat.extends("next/core-web-vitals"),
  {
    plugins: {
      turbo: turboPlugin,
      "@typescript-eslint": tseslint,
      "design-system": designSystemPlugin,
    },
    rules: {
      // MANDATORY RULES - Errors that BLOCK commits/pushes
      "turbo/no-undeclared-env-vars": "off",
      "react-hooks/rules-of-hooks": "error", // Critical: React hooks must follow rules
      "no-debugger": "error", // Never ship debuggers
      "prefer-const": "error",
      "no-var": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/layout/PageTabsV2",
              message:
                "Use PageTabs for page-level tabs or Tabs from @/components/ui/tabs for section tabs.",
            },
            {
              name: "@/components/layout",
              importNames: ["PageTabsV2"],
              message:
                "PageTabsV2 is deprecated. Use PageTabs for page-level tabs or Tabs for section tabs.",
            },
            {
              name: "@/components/ds",
              importNames: ["PageTabsV2"],
              message:
                "PageTabsV2 is deprecated. Use PageTabs for page-level tabs or Tabs for section tabs.",
            },
            {
              name: "radix-ui",
              message:
                "Import tab primitives through shared components in src/components/ui instead of raw Radix.",
            },
            {
              name: "@radix-ui/react-tabs",
              message:
                "Use the shared tabs primitive from @/components/ui/tabs instead of importing Radix tabs directly.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name='TabsList'] > JSXAttribute[name.name='variant'][value.value='line']",
          message:
            "Do not use TabsList variant=\"line\". Use PageTabs for page-level tabs or default Tabs for section tabs.",
        },
      ],

      // IMPORTANT RULES - Warnings (disabled to unblock cleanup tasks)
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "off",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-console": "off",
      "react-hooks/exhaustive-deps": "off",
      "no-alert": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "@next/next/no-img-element": "off",

      // Design System Enforcement
      // All rules are "warn" globally + escalated to "error" on changed files via lint-staged.
      // To escalate a rule to "error" globally: verify zero violations first with:
      //   node_modules/.bin/eslint src --no-color 2>&1 | grep "<rule-name>"

      "design-system/no-hardcoded-colors": "warn",
      "design-system/no-arbitrary-spacing": "warn",
      "design-system/require-semantic-colors": "warn",
      "design-system/no-design-violations": "warn",
      "design-system/require-page-shell": "warn",
      "design-system/no-raw-button": "warn",
      "design-system/no-raw-form-controls": "warn",
      "design-system/require-approved-form-components": "warn",
      "design-system/require-money-field": "warn",
      // WARN globally (300+ existing violations — tracked as debt, fix incrementally).
      // ENFORCED as ERROR on changed files via lint-staged (.lintstagedrc.js).
      "design-system/require-api-client": "warn",
      "design-system/require-empty-state": "warn",
      "design-system/no-raw-heading": "error",
      "design-system/no-inline-currency": "warn",
      "design-system/require-error-state": "warn",
      "design-system/require-info-alert": "warn",
      // Gate 19: blocks raw <TableBody>/<TableRow> etc. in page/component files
      "design-system/no-raw-table-primitives": "warn",
      // Gate 16: blocks raw fetch() to external URLs in API routes
      "design-system/no-external-fetch-in-api-routes": "warn",
      "design-system/no-supabase-auth-getuser-in-api-routes": "error",
      // Gate 20: blocks toast.error(err instanceof Error ? err.message : "fallback")
      // which leaks raw browser errors ("Failed to fetch") into the UI
      "design-system/no-raw-error-message-toast": "warn",
      // Gate 21: blocks raw <Input placeholder="Search..."> — use <ExpandingSearch> from @/components/ds
      "design-system/no-raw-search-input": "warn",
      // Gate 21b: blocks bespoke popover divs with Button-row menus when the shared
      // DropdownMenu primitive should own alignment, keyboard behavior, and destructive styling.
      "design-system/no-hand-rolled-dropdown-menu": "warn",
      // Gate 22: status/dropdown columns in *-table-config files must declare an explicit
      // `editable` decision (wire inline editing, or `editable: false` to opt out). Stops
      // tables shipping a dropdown that forces a redirect-to-edit-page.
      "design-system/require-editable-status-column": "warn",
      // Gate 22b: title/name/subject columns must link to the detail page, never be
      // inline-editable (an editable cell hijacks the click that opens the record).
      "design-system/no-editable-title-column": "error",
      // Gate 23: blocks raw <Input type="date"> in form files — use <RHFDateField> instead.
      // Ratchet: warn globally (existing debt), error on changed files via lint-staged.
      "design-system/no-raw-date-input": "warn",
      // Gate 24: blocks raw <dl>/<dt>/<dd> — use <DetailField> / <DetailFieldGrid> from @/components/ds.
      "design-system/no-raw-detail-field": "warn",
      // Gate 25: blocks raw xl:grid-cols-[...] in detail pages — use <DetailLayout> from @/components/layout.
      "design-system/no-raw-detail-grid": "warn",
      // Gate 26: blocks raw multi-column grids in page files — use <PageScaffold layout=...> from @/components/layout.
      // WARN globally (73 existing pages are debt); ERROR on changed files via lint-staged.
      "design-system/no-raw-page-grid": "warn",
      // Case law docs/design/noise-gate-log.md #10: banned everywhere, no exceptions.
      "design-system/no-external-link-icon": "warn",
      // Sidebar sheet/panel headers must look identical app-wide — the border
      // (or lack of one) belongs in the shared component, never a callsite override.
      "design-system/no-sheet-header-border": "warn",
      // Table cells never stack a secondary muted line under the primary value.
      // One column, one attribute — see docs/design/noise-gate-log.md #38.
      // ERROR globally: the app was swept to zero violations when this landed,
      // so there is no debt to grandfather in.
      "design-system/no-stacked-table-cell": "error",
    },
  }, // Admin pages: relax heading rule — these are internal tools used only by the Alleato team.
  // Layout consistency is nice-to-have here; focus enforcement on customer-facing pages.
  {
    files: ["src/app/(admin)/**/*.tsx", "src/app/(admin)/**/*.ts"],
    rules: {
      "design-system/no-raw-heading": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.tsx", "src/components/ui/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  }, // Scheduling task mutations depend on current task/version state. Keep
  // stale-closure detection mandatory on the two task-editing owners.
  {
    files: [
      "src/app/(main)/[projectId]/schedule/page.tsx",
      "src/components/scheduling/task-edit-modal.tsx",
    ],
    rules: {
      "react-hooks/exhaustive-deps": "error",
    },
  }, // Design template files: used as starting points / exploratory UI, not production components.
  // Intentional use of hardcoded colors, arbitrary values, and non-semantic tokens.
  {
    files: [
      "src/components/ds/futuristic-id-card.tsx",
      "src/components/ds/liquid-metal-id-card.tsx",
    ],
    rules: {
      "design-system/no-hardcoded-colors": "off",
      "design-system/no-arbitrary-spacing": "off",
      "design-system/require-semantic-colors": "off",
      "design-system/no-design-violations": "off",
      "design-system/no-raw-button": "off",
      "design-system/no-raw-form-controls": "off",
    },
  }, // Redirect-only pages have no JSX output — PageShell rule does not apply.
  {
    files: ["src/app/**/estimates/new/page.tsx"],
    rules: {
      "design-system/require-page-shell": "off",
    },
  }, // Training module: owner-approved exception to the whole design system —
  // see specs/LAYOUT-REFERENCE.md and DESIGN-SYSTEM-GATE.md "Owner-approved
  // exception: /training". This route faithfully ports the standalone "Own
  // Your Growth" hub's own brand system (training-theme.module.css), not
  // ds/ui components or semantic tokens — every rule below exists to enforce
  // exactly what this route is intentionally not doing.
  {
    files: ["src/app/(main)/training/**/*.tsx", "src/features/training/**/*.tsx"],
    rules: {
      "design-system/require-page-shell": "off",
      "design-system/no-raw-heading": "off",
      "design-system/no-hardcoded-colors": "off",
      "design-system/no-arbitrary-spacing": "off",
      "design-system/require-semantic-colors": "off",
      "design-system/no-design-violations": "off",
      "design-system/no-raw-button": "off",
      "design-system/no-raw-form-controls": "off",
      "design-system/no-raw-search-input": "off",
      "design-system/require-empty-state": "off",
      "design-system/require-error-state": "off",
      "design-system/require-info-alert": "off",
      "design-system/no-raw-detail-field": "off",
      "design-system/no-raw-detail-grid": "off",
      "design-system/no-raw-page-grid": "off",
      "design-system/no-raw-table-primitives": "off",
    },
  }, // Transactional email templates: rendered by Resend/React Email to static HTML
  // for external inboxes, which cannot resolve CSS variables. Inline hex is
  // required here, matching the shared EmailShell palette.
  {
    files: ["src/emails/**/*.tsx", "src/emails/**/*.ts"],
    rules: {
      "design-system/no-hardcoded-colors": "off",
      "design-system/require-semantic-colors": "off",
    },
  }, // Kanban feature: board lanes and draggable cards require fixed geometry and card styling.
  // PageShell remains enforced; only geometry/card-noise rules are relaxed here.
  {
    files: ["src/features/kanban/**/*.tsx", "src/features/kanban/**/*.ts"],
    rules: {
      "design-system/no-arbitrary-spacing": "off",
      "design-system/no-design-violations": "off",
    },
  }, // Platform Kit AI-SQL route: vendored Supabase management endpoint. Lives under
  // app/api (so it cannot use the platform-kit dir ignore) and calls the Supabase
  // Management API via openapi-fetch, which is the whole point of the route.
  {
    files: ["src/app/api/ai/sql/**/*.ts"],
    rules: {
      "design-system/no-external-fetch-in-api-routes": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default config;
