/**
 * ESLint Rule: no-inline-spinner
 *
 * Prevents hand-rolled border spinner divs.  The giveaway pattern is a JSX
 * element (div, span, etc.) whose className contains ALL THREE of:
 *   - border-* (or border-t-*, border-b-*, etc.)
 *   - rounded-full
 *   - animate-spin
 *
 * This pattern is always replaceable with <Spinner> from @/components/ds.
 *
 * Exceptions:
 *   - Files inside components/ui/ or components/ds/ (the Spinner implementation itself)
 *   - GOLDEN-EXAMPLES
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const BORDER_RE = /\bborder(?:-[a-z][\w-]*)?\b/;
const ROUNDED_FULL_RE = /\brounded-full\b/;
const ANIMATE_SPIN_RE = /\banimate-spin\b/;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow hand-rolled border spinner divs — use <Spinner> from @/components/ds',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      inlineSpinner:
        'Use <Spinner> from @/components/ds instead of a hand-rolled border spinner div.',
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
     * Extracts all static string segments from a className value (Literal or
     * TemplateLiteral).  Returns an empty string when the value cannot be
     * statically analysed.
     */
    function extractStaticClasses(val) {
      if (!val) return '';

      // className="..."
      if (val.type === 'Literal') {
        return typeof val.value === 'string' ? val.value : '';
      }

      // className={...}
      if (val.type === 'JSXExpressionContainer') {
        const expr = val.expression;
        if (expr.type === 'Literal') {
          return typeof expr.value === 'string' ? expr.value : '';
        }
        if (expr.type === 'TemplateLiteral') {
          return expr.quasis.map((q) => q.value.raw).join(' ');
        }
      }

      return '';
    }

    function isSpinnerPattern(classes) {
      return (
        BORDER_RE.test(classes) &&
        ROUNDED_FULL_RE.test(classes) &&
        ANIMATE_SPIN_RE.test(classes)
      );
    }

    return {
      JSXOpeningElement(node) {
        // Find the className attribute
        const classAttr = node.attributes.find(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'className'
        );

        if (!classAttr) return;

        const classes = extractStaticClasses(classAttr.value);
        if (isSpinnerPattern(classes)) {
          context.report({
            node: classAttr,
            messageId: 'inlineSpinner',
          });
        }
      },
    };
  },
};
