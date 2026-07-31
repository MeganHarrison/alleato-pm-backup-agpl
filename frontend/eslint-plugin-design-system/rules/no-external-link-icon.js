/**
 * ESLint Rule: no-external-link-icon
 *
 * Bans the lucide-react `ExternalLink` icon (the box-with-arrow glyph)
 * anywhere in the app. Case law: docs/design/noise-gate-log.md #10 — Megan
 * has repeatedly flagged this icon as visually unpleasant ("never use this
 * anywhere"). A "view/go to" link uses a plain `ArrowRight` instead.
 *
 * @type {import('eslint').Rule.RuleModule}
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow the lucide-react ExternalLink icon — use ArrowRight for "view/go to" links instead',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      noExternalLinkIcon:
        'Never use the ExternalLink (box-with-arrow) icon — see docs/design/noise-gate-log.md #10. Use ArrowRight from lucide-react instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'lucide-react') return;

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name === 'ExternalLink'
          ) {
            context.report({
              node: specifier,
              messageId: 'noExternalLinkIcon',
            });
          }
        }
      },
    };
  },
};
