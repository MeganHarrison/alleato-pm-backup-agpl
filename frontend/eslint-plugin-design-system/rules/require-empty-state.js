/**
 * require-empty-state
 *
 * Flags hand-rolled empty states. Every empty state must use <EmptyState>
 * from @/components/ds — never a bare div with centered text/icon.
 */

'use strict';

const EMPTY_STATE_PATTERNS = [
  // className contains text-center AND (py-8 | py-12 | py-16) AND text-muted-foreground
  /\btext-center\b/,
];

const SUSPICIOUS_TEXT = [
  /^No\s+\w+/i,          // "No items yet", "No payments recorded"
  /^There are no\s/i,
  /nothing here/i,
  /not yet/i,
];

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require <EmptyState> from @/components/ds instead of hand-rolled empty states',
      recommended: true,
    },
    messages: {
      useEmptyState:
        'Use <EmptyState> from @/components/ds instead of hand-rolling an empty state. ' +
        'See DESIGN-SYSTEM-GATE.md for the correct pattern.',
    },
    schema: [],
  },

  create(context) {
    function getClassNameValue(node) {
      // className="..." (string literal)
      if (node.type === 'Literal') return node.value;
      // className={`...`} (template literal with no expressions)
      if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis.map((q) => q.value.cooked).join('');
      }
      // className={cn("...", "...")} — check string args
      if (
        node.type === 'CallExpression' &&
        node.arguments.length > 0
      ) {
        return node.arguments
          .filter((a) => a.type === 'Literal')
          .map((a) => a.value)
          .join(' ');
      }
      return '';
    }

    function isHandRolledEmptyState(jsxOpeningElement) {
      const classNameAttr = jsxOpeningElement.attributes.find(
        (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'className',
      );
      if (!classNameAttr || !classNameAttr.value) return false;

      const raw = getClassNameValue(
        classNameAttr.value.type === 'JSXExpressionContainer'
          ? classNameAttr.value.expression
          : classNameAttr.value,
      );

      if (!raw) return false;

      const hasTextCenter = /\btext-center\b/.test(raw);
      const hasVerticalPadding = /\bpy-(8|10|12|14|16|20|24)\b/.test(raw);
      const hasMutedFg = /\btext-muted-foreground\b/.test(raw);

      return hasTextCenter && hasVerticalPadding && hasMutedFg;
    }

    return {
      JSXOpeningElement(node) {
        const elementName =
          node.name.type === 'JSXIdentifier' ? node.name.name : null;

        // Skip the EmptyState component itself and non-div elements
        if (!elementName || elementName === 'EmptyState') return;
        if (elementName !== 'div') return;

        if (isHandRolledEmptyState(node)) {
          context.report({
            node,
            messageId: 'useEmptyState',
          });
        }
      },
    };
  },
};
