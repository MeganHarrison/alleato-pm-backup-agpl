/**
 * ESLint Rule: require-page-shell
 *
 * Every page.tsx file under app/ must use a shared page-level shell as its root
 * layout wrapper.
 * This prevents the recurring pattern of agents writing raw <div> + manual <h1>
 * instead of using the design system's page component.
 *
 * What it checks:
 * - The file exports a default function (a Next.js page)
 * - The file imports PageShell from @/components/layout, UnifiedTablePage from
 *   @/components/tables/unified, or an approved feature-owned page shell
 * - The returned JSX contains a <PageShell>, <UnifiedTablePage>, or approved
 *   feature-owned page shell element
 *
 * Exceptions (via eslint-disable or path-based):
 * - Files in (auth)/ routes (login, signup pages have custom layouts)
 * - Files that explicitly disable with eslint-disable comment
 * - Layout files (layout.tsx) — those wrap pages, not the other way around
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require PageShell component in all page.tsx files',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      missingPageShell:
        'Page files must use <PageShell> from "@/components/layout", <UnifiedTablePage> from "@/components/tables/unified", or an approved feature-owned page shell. ' +
        'Do not write raw <div> + manual headings. ' +
        'See CLAUDE.md → "BUILDING A NEW PAGE? START HERE" for variants: ' +
        'dashboard, table, form, detail, content.',
      missingPageShellImport:
        'Page file is missing the shared page shell import. ' +
        'Add PageShell from "@/components/layout", UnifiedTablePage from "@/components/tables/unified", or an approved feature-owned page shell.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename?.() || context.filename || '';

    // Only apply to page.tsx files
    if (!filename.endsWith('page.tsx')) return {};

    // Skip auth routes, error pages, and special pages
    const skipPatterns = [
      '(auth)',
      '/auth/',
      'error.tsx',
      'not-found.tsx',
      'loading.tsx',
      'layout.tsx',
      // Admin pages that are legitimately non-standard
      'test-modals',
      'test-form',
      // Redirect-only pages: these return null after calling router.replace() in useEffect.
      // They cannot use PageShell because they render nothing — the redirect is the page.
      'edit/page.tsx',
      'database/page.tsx',
      '(admin)/pipeline-health/page.tsx',
      // Thin delegation pages: the page exists only to extract URL params and pass them to
      // a feature component that already owns its own PageShell. Adding a second PageShell
      // here would create nested shells.
      '(admin)/training-docs/page.tsx',
      '(admin)/training-map/page.tsx',
      // Thin delegation page: renders ProductBoardClient, which owns its own
      // PageShell (title + view/filter actions live on the header row there).
      '(admin)/product-board/page.tsx',
      // Restored transcript detail: delegates to MeetingDetailContent, which
      // owns its own full page shell (same shape as the (tables)/ global page).
      '[projectId]/meetings/[meetingId]/page.tsx',
      // Restored project meetings list: thin server component delegating to
      // MeetingsTablePage (owns UnifiedTablePage) / TablePageWrapper on error.
      '[projectId]/meetings/page.tsx',
      '(admin)/meeting-templates/page.tsx',
      '(admin)/meeting-templates/[templateId]/page.tsx',
      // Thin delegation page: extracts templateId and passes it to
      // PermissionTemplateDetailPageClient, which owns its own PageShell.
      '(admin)/user-management/templates/[templateId]/page.tsx',
      'invoicing/subcontractor/page.tsx',
      'invoicing/subcontractor/[invoiceId]/page.tsx',
      'commitments/[commitmentId]/invoices/[invoiceId]/page.tsx',
      'submittals/new/page.tsx',
      // Budget page: complex legacy Suspense wrapper — BudgetPageContent owns its own header.
      '[projectId]/budget/page.tsx',
      // Global cross-project table pages under (tables)/: thin server components that fetch
      // data and pass it to a client component that owns the UnifiedTablePage shell.
      // Adding PageShell here would create a double shell.
      '(tables)/',
      // Dev-tool pages with fully custom layouts — a sidebar nav + scrollable demo canvas
      // that intentionally owns its own structure. Adding PageShell would double-wrap.
      'ui-library/page.tsx',
      // Public no-auth pages (e.g. subcontractor RFI response): these live outside the
      // authenticated app shell entirely and use their own lightweight layouts.
      'app/respond/',
      // Daily Executive Brief: a bespoke, full-viewport editorial document
      // (masthead + index rail + sections) rendered outside the app shell. It
      // intentionally does not use PageShell — see daily-brief/build-brief.ts
      // (body builder) and daily-brief/brief-styles.ts (styles).
      'daily-brief/page.tsx',
    ];
    if (skipPatterns.some(p => filename.includes(p))) return {};

    let hasSharedPageShellImport = false;
    let hasSharedPageShellJSX = false;
    let defaultExportNode = null;

    return {
      // Track imports
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          source === '@/components/layout' ||
          source === '@/components/layout/page-shell' ||
          source === '@/components/layout/page-scaffold'
        ) {
          const hasPageShell = node.specifiers.some(
            s =>
              s.imported &&
              (s.imported.name === 'PageShell' || s.imported.name === 'PageScaffold')
          );
          if (hasPageShell) hasSharedPageShellImport = true;
        }

        if (source === '@/components/tables/unified') {
          const hasUnifiedTablePage = node.specifiers.some(
            s => s.imported && s.imported.name === 'UnifiedTablePage'
          );
          if (hasUnifiedTablePage) hasSharedPageShellImport = true;
        }

        if (source === '@/features/emails/inbox/email-inbox-client') {
          const hasEmailInboxClient = node.specifiers.some(
            s => s.imported && s.imported.name === 'EmailInboxClient'
          );
          if (hasEmailInboxClient) hasSharedPageShellImport = true;
        }
      },

      // Track JSX usage of page-level shell primitives.
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          (node.name.name === 'PageShell' ||
            node.name.name === 'PageScaffold' ||
            node.name.name === 'UnifiedTablePage' ||
            node.name.name === 'EmailInboxClient')
        ) {
          hasSharedPageShellJSX = true;
        }
      },

      // Track default export
      ExportDefaultDeclaration(node) {
        defaultExportNode = node;
      },

      // Check at the end of the file
      'Program:exit'() {
        // Only check files that export a default (page components)
        if (!defaultExportNode) return;

        if (!hasSharedPageShellImport && !hasSharedPageShellJSX) {
          context.report({
            node: defaultExportNode,
            messageId: 'missingPageShell',
          });
        } else if (hasSharedPageShellImport && !hasSharedPageShellJSX) {
          // Imported but never used — likely a mistake
          context.report({
            node: defaultExportNode,
            messageId: 'missingPageShell',
          });
        } else if (!hasSharedPageShellImport && hasSharedPageShellJSX) {
          // Used but not imported — would be a runtime error anyway
          context.report({
            node: defaultExportNode,
            messageId: 'missingPageShellImport',
          });
        }
      },
    };
  },
};
