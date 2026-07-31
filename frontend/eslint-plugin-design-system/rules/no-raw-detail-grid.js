/**
 * ESLint Rule: no-raw-detail-grid
 *
 * In detail page components (identified by importing ContentSectionStack),
 * the two-column responsive grid must be expressed as <DetailLayout sidebar={...}>
 * rather than a raw <div className="... xl:grid-cols-[...]">.
 *
 * This prevents each agent from re-inventing the grid with different breakpoints,
 * gap values, and sidebar widths, causing visual inconsistency across pages.
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Use <DetailLayout> instead of raw xl:grid-cols-[...] in detail page components',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawDetailGrid:
        'Raw xl:grid-cols-[...] detected in a detail page component. ' +
        'Use <DetailLayout sidebar={...}> from "@/components/layout" instead. ' +
        'This encodes the canonical two-column grid used by all detail pages.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename?.() || context.filename || '';

    // Only check TypeScript/TSX files
    if (!filename.endsWith('.tsx') && !filename.endsWith('.ts')) return {};

    let importsContentSectionStack = false;

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          source === '@/components/layout' ||
          source === '@/components/layout/spacing'
        ) {
          const hasIt = node.specifiers.some(
            (s) => s.imported && s.imported.name === 'ContentSectionStack',
          );
          if (hasIt) importsContentSectionStack = true;
        }
      },

      JSXAttribute(node) {
        if (!importsContentSectionStack) return;
        if (node.name.name !== 'className') return;

        const value = node.value;
        if (!value) return;

        // className="..." literal
        if (value.type === 'Literal' && typeof value.value === 'string') {
          if (value.value.includes('xl:grid-cols-[')) {
            context.report({ node, messageId: 'rawDetailGrid' });
          }
        }

        // className={`...`} template literal
        if (
          value.type === 'JSXExpressionContainer' &&
          value.expression.type === 'TemplateLiteral'
        ) {
          const raw = value.expression.quasis.map((q) => q.value.raw).join('');
          if (raw.includes('xl:grid-cols-[')) {
            context.report({ node, messageId: 'rawDetailGrid' });
          }
        }

        // className={cn("... xl:grid-cols-[...")} — check string args to cn()
        if (
          value.type === 'JSXExpressionContainer' &&
          value.expression.type === 'CallExpression'
        ) {
          const callee = value.expression.callee;
          const isCn =
            (callee.type === 'Identifier' && callee.name === 'cn') ||
            (callee.type === 'MemberExpression' &&
              callee.property.name === 'cn');
          if (!isCn) return;
          for (const arg of value.expression.arguments) {
            if (arg.type === 'Literal' && typeof arg.value === 'string') {
              if (arg.value.includes('xl:grid-cols-[')) {
                context.report({ node, messageId: 'rawDetailGrid' });
              }
            }
          }
        }
      },
    };
  },
};
