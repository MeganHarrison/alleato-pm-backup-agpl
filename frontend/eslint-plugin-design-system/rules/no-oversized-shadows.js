/**
 * ESLint Rule: no-oversized-shadows
 *
 * Prevents shadow-md, shadow-lg, shadow-xl, shadow-2xl in className attributes.
 * Design system only allows shadow-xs (cards) and shadow-sm (dropdowns/elevated).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow oversized shadow classes — only shadow-xs and shadow-sm are allowed',
      category: 'Design System',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      oversizedShadow:
        '"{{value}}" is too heavy. Use shadow-xs (cards) or shadow-sm (dropdowns). See docs/design/DESIGN.md.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('globals.css') ||
      filename.includes('tailwind.config') ||
      filename.includes('GOLDEN-EXAMPLES')
    ) {
      return {};
    }

    const banned = ['shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl'];
    const banRegex = /\bshadow-(md|lg|xl|2xl)\b/g;

    function checkValue(node, raw) {
      if (!raw || typeof raw !== 'string') return;
      let match;
      while ((match = banRegex.exec(raw)) !== null) {
        context.report({
          node,
          messageId: 'oversizedShadow',
          data: { value: match[0] },
        });
      }
      banRegex.lastIndex = 0;
    }

    return {
      JSXAttribute(node) {
        if (
          !node.name ||
          (node.name.name !== 'className' && node.name.name !== 'class')
        ) {
          return;
        }

        if (node.value && node.value.type === 'Literal') {
          checkValue(node, node.value.value);
        } else if (node.value && node.value.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;
          if (expr.type === 'TemplateLiteral') {
            expr.quasis.forEach((q) => checkValue(node, q.value.raw));
          } else if (expr.type === 'Literal') {
            checkValue(node, expr.value);
          }
        }
      },

      // Also catch cn(...) / clsx(...) calls with string arguments
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== 'Identifier' ||
          !['cn', 'clsx', 'cva', 'twMerge'].includes(callee.name)
        ) {
          return;
        }
        node.arguments.forEach((arg) => {
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            checkValue(arg, arg.value);
          }
          if (arg.type === 'TemplateLiteral') {
            arg.quasis.forEach((q) => checkValue(arg, q.value.raw));
          }
        });
      },
    };
  },
};
