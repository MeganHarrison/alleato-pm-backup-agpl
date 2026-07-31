/**
 * ESLint Rule: no-raw-search-input
 *
 * Prevents using page-local search controls for table/list search.
 * App list/table surfaces must use <ExpandableSearch> from
 * "@/components/tables/unified/table-toolbar" or the full UnifiedTableToolbar.
 *
 * The older ds <ExpandingSearch> and raw <Input placeholder="Search..."> both
 * create divergent search UI and are blocked outside the approved primitives.
 *
 * Allowed locations:
 *   - The ExpandingSearch component itself
 *   - The ExpandableSearch / unified table toolbar components
 *   - The ui/input primitive (shadcn source)
 *   - Design system ds/ composites
 *   - Table toolbar components (they have their own search)
 *   - Test files
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow page-local search controls — use the unified table search',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawSearchInput:
        'Do not use a raw <Input> for search. ' +
        'Use <ExpandableSearch> from "@/components/tables/unified/table-toolbar" or <UnifiedTableToolbar> instead.',
      expandingSearch:
        'Do not use <ExpandingSearch> for app table/list search. ' +
        'Use <ExpandableSearch> from "@/components/tables/unified/table-toolbar" or <UnifiedTableToolbar> so every page uses the same search.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/components/ui/input') ||
      filename.includes('/components/ds/') ||
      filename.includes('/components/tables/') ||
      filename.includes('expanding-search') ||
      filename.includes('table-toolbar') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('/tests/')
    ) {
      return {};
    }

    const SEARCH_PLACEHOLDER_RE = /\b(search|find|filter)\b/i;

    return {
      JSXOpeningElement(node) {
        const name = node.name;
        if (
          name.type === 'JSXIdentifier' &&
          name.name === 'ExpandingSearch'
        ) {
          context.report({ node, messageId: 'expandingSearch' });
          return;
        }

        // Match <Input ...>
        if (
          name.type !== 'JSXIdentifier' ||
          name.name !== 'Input'
        ) {
          return;
        }

        for (const attr of node.attributes) {
          if (
            attr.type !== 'JSXAttribute' ||
            attr.name?.name !== 'placeholder'
          ) {
            continue;
          }

          let placeholderValue = null;

          if (attr.value?.type === 'Literal') {
            placeholderValue = attr.value.value;
          } else if (
            attr.value?.type === 'JSXExpressionContainer' &&
            attr.value.expression?.type === 'Literal'
          ) {
            placeholderValue = attr.value.expression.value;
          }

          if (
            typeof placeholderValue === 'string' &&
            SEARCH_PLACEHOLDER_RE.test(placeholderValue)
          ) {
            context.report({ node, messageId: 'rawSearchInput' });
          }
        }
      },
    };
  },
};
