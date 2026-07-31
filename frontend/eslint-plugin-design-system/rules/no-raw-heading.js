/**
 * ESLint Rule: no-raw-heading
 *
 * Prevents raw <h2>, <h3>, <h4> elements outside of the component library.
 * PageShell handles <h1> automatically, and section headings should use
 * <SectionRuleHeading> from @/components/layout/spacing so that spacing,
 * typography, and dark mode remain consistent across the app.
 *
 * Exceptions:
 *   - <h1> is always allowed (PageShell owns it)
 *   - Files inside components/ui/ or components/ds/ (library definitions)
 *   - error.tsx files (Next.js error boundaries often need bare headings)
 *   - GOLDEN-EXAMPLES
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const FLAGGED_HEADINGS = new Set(['h2', 'h3', 'h4']);

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow raw <h2>/<h3>/<h4> elements — use <SectionRuleHeading> from @/components/layout/spacing',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawHeading:
        'Use <SectionRuleHeading> from @/components/layout/spacing instead of a raw <{{tag}}>. Raw headings create visual inconsistency.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/components/ui/') ||
      filename.includes('/components/ds/') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('error.tsx') ||
      filename.includes('globals.css') ||
      filename.includes('tailwind.config')
    ) {
      return {};
    }

    return {
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          FLAGGED_HEADINGS.has(node.name.name)
        ) {
          context.report({
            node,
            messageId: 'rawHeading',
            data: { tag: node.name.name },
          });
        }
      },
    };
  },
};
