/**
 * ESLint Rule: no-raw-error-message-toast
 *
 * Flags toast.error(X instanceof Error ? X.message : "fallback") — the most
 * common way "Failed to fetch" leaks into the UI.
 *
 * When a network request fails, the browser throws TypeError("Failed to fetch").
 * The pattern `err instanceof Error ? err.message : "fallback"` passes that raw
 * message directly, so the user sees "Failed to fetch" instead of the descriptive
 * fallback.
 *
 * CORRECT patterns:
 *   // Load errors — always use the descriptive string
 *   toast.error("Failed to load contracts. Try refreshing the page.");
 *   console.error("Failed to load contracts:", err);
 *
 *   // Action errors — use handleFormError which handles ApiError + TypeError
 *   handleFormError(err, { entity: "contract", action: "update" });
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow toast.error(err instanceof Error ? err.message : "fallback") — leaks raw browser errors like "Failed to fetch" into the UI',
      category: 'Error Handling',
      recommended: true,
    },
    messages: {
      rawErrorMessage:
        'Never pass err.message to toast.error — it leaks "Failed to fetch" when the network fails. ' +
        'For load errors: toast.error("Descriptive message. Try refreshing the page.") + console.error(). ' +
        'For action errors: use handleFormError(err, { entity, action }).',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        // Match toast.error(...)
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.object.name !== 'toast' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'error'
        ) {
          return;
        }

        const firstArg = node.arguments[0];
        if (!firstArg) return;

        // Match X instanceof Error ? X.message : "fallback"
        if (
          firstArg.type === 'ConditionalExpression' &&
          firstArg.test.type === 'BinaryExpression' &&
          firstArg.test.operator === 'instanceof' &&
          firstArg.test.right.type === 'Identifier' &&
          firstArg.test.right.name === 'Error' &&
          firstArg.consequent.type === 'MemberExpression' &&
          firstArg.consequent.property.type === 'Identifier' &&
          firstArg.consequent.property.name === 'message'
        ) {
          context.report({
            node: firstArg,
            messageId: 'rawErrorMessage',
          });
        }
      },
    };
  },
};
