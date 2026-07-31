/**
 * ESLint Rule: no-raw-detail-field
 *
 * Prevents hand-rolled <dl>/<dt>/<dd> elements outside the component library.
 * Detail view label+value pairs must use <DetailField> and <DetailFieldGrid>
 * from @/components/ds so that layout, typography, and dark mode stay consistent.
 *
 * Exceptions:
 *   - Files inside components/ui/ or components/ds/ (library definitions)
 *   - GOLDEN-EXAMPLES
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const RAW_TAGS = new Set(['dl', 'dt', 'dd']);

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow raw <dl>/<dt>/<dd> elements — use <DetailField> and <DetailFieldGrid> from @/components/ds',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawDetailField:
        'Use <DetailField> / <DetailFieldGrid> from @/components/ds instead of a raw <{{tag}}>. Hand-rolled detail fields break layout consistency.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/components/ui/') ||
      filename.includes('/components/ds/') ||
      filename.includes('GOLDEN-EXAMPLES')
    ) {
      return {};
    }

    return {
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          RAW_TAGS.has(node.name.name)
        ) {
          context.report({
            node,
            messageId: 'rawDetailField',
            data: { tag: node.name.name },
          });
        }
      },
    };
  },
};
