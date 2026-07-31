/**
 * ESLint Rule: no-inline-currency
 *
 * Prevents inline number formatting for currency values.  Two patterns are flagged:
 *
 *   1. `someValue.toFixed(2)` — imprecise and locale-unaware
 *   2. `new Intl.NumberFormat(...)` constructed inline inside a JSX expression
 *
 * The correct replacement is `formatCurrency()` from @/lib/format, which is
 * locale-aware, consistent, and tested in one place.
 *
 * Scope: only flags these patterns when they appear inside a JSX expression
 * container `{...}` to avoid false-positives in utility/service files that
 * may legitimately use low-level formatting.
 *
 * Exceptions:
 *   - Files inside lib/format* (the utility itself)
 *   - Test files (*.test.ts, *.spec.ts, *.test.tsx, *.spec.tsx)
 *
 * @type {import('eslint').Rule.RuleModule}
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow inline number formatting — use formatCurrency() from @/lib/format',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      inlineCurrency:
        "Use the shared formatCurrency() utility from @/lib/format instead of inline number formatting. Inconsistent formatting causes display drift across the app.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/lib/format') ||
      /\.(test|spec)\.(tsx?|jsx?)$/.test(filename)
    ) {
      return {};
    }

    /**
     * Walks up the ancestor chain and returns true when the node sits inside a
     * JSXExpressionContainer — i.e. it is rendered directly in JSX.
     */
    function isInsideJSXExpression(node) {
      let current = node.parent;
      while (current) {
        if (current.type === 'JSXExpressionContainer') return true;
        // Stop at function/arrow boundaries — we only care about JSX render scope
        if (
          current.type === 'FunctionDeclaration' ||
          current.type === 'FunctionExpression' ||
          current.type === 'ArrowFunctionExpression'
        ) {
          break;
        }
        current = current.parent;
      }
      return false;
    }

    return {
      // Pattern 1: someValue.toFixed(2)  ← only flagged inside JSX expressions
      'CallExpression[callee.type="MemberExpression"][callee.property.name="toFixed"]'(
        node
      ) {
        if (!isInsideJSXExpression(node)) return;
        context.report({ node, messageId: 'inlineCurrency' });
      },

      // Pattern 2: new Intl.NumberFormat(...)  ← only flagged inside JSX expressions
      'NewExpression[callee.type="MemberExpression"][callee.object.name="Intl"][callee.property.name="NumberFormat"]'(
        node
      ) {
        if (!isInsideJSXExpression(node)) return;
        context.report({ node, messageId: 'inlineCurrency' });
      },
    };
  },
};
