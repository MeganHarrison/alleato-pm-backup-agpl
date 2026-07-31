/**
 * ESLint Rule: require-error-state
 *
 * Flags hand-rolled error displays using <p> or <div> with text-destructive
 * class that render an error variable directly. Use <ErrorState> from
 * @/components/ds instead.
 *
 * See DESIGN-SYSTEM-GATE.md.
 */

const ERROR_VAR_PATTERN = /^(error|errorMessage|errorText|fetchError|loadError|queryError)$/;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use <ErrorState> from @/components/ds instead of hand-rolled error displays',
      recommended: false,
    },
    messages: {
      useErrorState:
        'Use <ErrorState error={...} /> from @/components/ds instead of a hand-rolled error display. See DESIGN-SYSTEM-GATE.md.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const tagName =
          node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (tagName !== 'p' && tagName !== 'div') return;

        // Check for text-destructive in className
        const classAttr = node.attributes.find(
          (a) =>
            a.type === 'JSXAttribute' &&
            a.name &&
            a.name.name === 'className'
        );
        if (!classAttr) return;

        let classValue = '';
        if (classAttr.value) {
          if (classAttr.value.type === 'Literal') {
            classValue = classAttr.value.value || '';
          } else if (
            classAttr.value.type === 'JSXExpressionContainer' &&
            classAttr.value.expression.type === 'Literal'
          ) {
            classValue = classAttr.value.expression.value || '';
          } else if (
            classAttr.value.type === 'JSXExpressionContainer' &&
            classAttr.value.expression.type === 'TemplateLiteral'
          ) {
            // For template literals, check the static quasis
            classValue = classAttr.value.expression.quasis
              .map((q) => q.value.cooked || '')
              .join(' ');
          }
        }

        if (!classValue.includes('text-destructive')) return;

        // Check if the parent JSXElement has a child that references an error variable
        const parent = node.parent;
        if (!parent || parent.type !== 'JSXElement') return;

        const hasErrorChild = parent.children.some((child) => {
          if (child.type === 'JSXExpressionContainer') {
            const expr = child.expression;
            // Direct reference: {error}
            if (
              expr.type === 'Identifier' &&
              ERROR_VAR_PATTERN.test(expr.name)
            ) {
              return true;
            }
            // Logical expression: {error && ...} or {error || "fallback"}
            if (
              expr.type === 'LogicalExpression' &&
              expr.left.type === 'Identifier' &&
              ERROR_VAR_PATTERN.test(expr.left.name)
            ) {
              return true;
            }
            // Member expression: {error?.message}
            if (
              expr.type === 'ChainExpression' &&
              expr.expression.type === 'MemberExpression' &&
              expr.expression.object.type === 'Identifier' &&
              ERROR_VAR_PATTERN.test(expr.expression.object.name)
            ) {
              return true;
            }
            if (
              expr.type === 'MemberExpression' &&
              expr.object.type === 'Identifier' &&
              ERROR_VAR_PATTERN.test(expr.object.name)
            ) {
              return true;
            }
          }
          return false;
        });

        if (hasErrorChild) {
          context.report({ node, messageId: 'useErrorState' });
        }
      },
    };
  },
};
