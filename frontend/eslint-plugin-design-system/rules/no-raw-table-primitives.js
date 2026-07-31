/**
 * ESLint Rule: no-raw-table-primitives
 *
 * Prevents importing raw shadcn table primitives (TableBody, TableRow, TableHead,
 * TableCell, TableHeader) from "@/components/ui/table" in page or client component files.
 *
 * Every list/data-grid page in this codebase uses UnifiedTablePage from
 * "@/components/tables/unified". It includes search, filters, column visibility,
 * pagination, row selection, bulk delete, row actions, and empty states — all wired
 * together consistently. A hand-rolled table misses all of that.
 *
 * Allowed locations:
 *   - The ui/table primitives themselves (shadcn source)
 *   - The design system (ds/) components that compose table primitives
 *   - GOLDEN-EXAMPLES (documentation)
 *   - InlineTable component (uses raw primitives intentionally for compact panels)
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw table primitives — use UnifiedTablePage from @/components/tables/unified',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawTablePrimitive:
        'Do not import raw table primitives from "@/components/ui/table" in page or component files. ' +
        'Use UnifiedTablePage (and useUnifiedTableState) from "@/components/tables/unified". ' +
        'It includes search, filters, pagination, row selection, bulk delete, and row actions. ' +
        'Reference: frontend/src/app/(main)/[projectId]/commitments/page.tsx',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Allow the primitives themselves and intentional composites
    if (
      filename.includes('/components/ui/table') ||
      filename.includes('/components/ds/') ||
      filename.includes('/components/tables/') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('inline-table') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('/tests/')
    ) {
      return {};
    }

    const RAW_PRIMITIVES = new Set([
      'TableBody',
      'TableRow',
      'TableHead',
      'TableHeader',
      'TableCell',
      'TableFooter',
      'TableCaption',
    ]);

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          source !== '@/components/ui/table' &&
          !source.endsWith('/components/ui/table')
        ) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            RAW_PRIMITIVES.has(specifier.imported.name)
          ) {
            context.report({
              node: specifier,
              messageId: 'rawTablePrimitive',
            });
          }
        }
      },
    };
  },
};
