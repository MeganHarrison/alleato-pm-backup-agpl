/**
 * ESLint Rule: no-hardcoded-status-colors
 *
 * Prevents Tailwind color classes that carry implied status meaning from being
 * used directly in JSX className strings.  These classes are non-semantic and
 * break dark mode — the correct replacement is <StatusBadge> from @/components/ds
 * or a semantic color token.
 *
 * Flagged patterns (text-* and bg-* variants):
 *   green-*, red-*, yellow-*, orange-*
 *
 * Exceptions:
 *   - Files inside components/ui/ or components/ds/ (library definitions)
 *   - GOLDEN-EXAMPLES, globals.css, tailwind.config
 *   - text-red-* / bg-red-* on a <button> element (destructive action styling)
 *     is intentionally NOT flagged — only status indicators inside spans/divs.
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const STATUS_COLOR_PATTERN =
  /\b(?:text|bg)-(?:green|red|yellow|orange)-\d{1,3}\b/;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow hardcoded status color classes — use <StatusBadge> or semantic tokens',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      hardcodedStatusColor:
        "Use <StatusBadge> from @/components/ds or semantic color tokens instead of hardcoded status colors like 'text-green-600'. Hardcoded colors break dark mode.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/components/ui/') ||
      filename.includes('/components/ds/') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('globals.css') ||
      filename.includes('tailwind.config')
    ) {
      return {};
    }

    /**
     * Returns true when the closest JSX element ancestor is a <button>.
     * Destructive buttons legitimately use red colors, so we skip those.
     */
    function isInsideButtonElement(node) {
      let current = node.parent;
      while (current) {
        if (
          current.type === 'JSXOpeningElement' &&
          current.name &&
          current.name.type === 'JSXIdentifier' &&
          current.name.name === 'button'
        ) {
          return true;
        }
        // Stop at JSX element boundaries to keep the search shallow
        if (current.type === 'JSXElement') {
          // Check the opening element of this JSX element
          if (
            current.openingElement &&
            current.openingElement.name &&
            current.openingElement.name.type === 'JSXIdentifier' &&
            current.openingElement.name.name === 'button'
          ) {
            return true;
          }
          // Don't go further than the enclosing element
          break;
        }
        current = current.parent;
      }
      return false;
    }

    function checkClassValue(value, reportNode) {
      if (typeof value !== 'string') return;
      if (!STATUS_COLOR_PATTERN.test(value)) return;
      if (isInsideButtonElement(reportNode)) return;

      context.report({
        node: reportNode,
        messageId: 'hardcodedStatusColor',
      });
    }

    return {
      JSXAttribute(node) {
        if (
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'className'
        ) {
          return;
        }

        const val = node.value;
        if (!val) return;

        // className="some classes"
        if (val.type === 'Literal') {
          checkClassValue(val.value, node);
          return;
        }

        // className={`...`} or className={"..."}
        if (val.type === 'JSXExpressionContainer') {
          const expr = val.expression;
          if (expr.type === 'Literal') {
            checkClassValue(expr.value, node);
          } else if (expr.type === 'TemplateLiteral') {
            // Check static quasis of the template literal
            for (const quasi of expr.quasis) {
              checkClassValue(quasi.value.raw, node);
            }
          }
        }
      },
    };
  },
};
