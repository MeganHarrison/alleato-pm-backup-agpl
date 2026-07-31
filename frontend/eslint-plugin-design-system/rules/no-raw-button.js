/**
 * ESLint Rule: no-raw-button
 *
 * Prevents <button> elements — always use <Button> from @/components/ui/button.
 * Raw <button> elements bypass design system styling (radius, padding, font, hover states).
 *
 * Allows <button> only inside component library definitions (ui/ directory).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw <button> elements — use <Button> from @/components/ui/button',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawButton:
        'Use <Button> from "@/components/ui/button" instead of raw <button>. See docs/design/DESIGN.md.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Allow raw <button> inside UI primitives (shadcn implementations)
    if (
      filename.includes('/components/ui/') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('globals.css') ||
      filename.includes('tailwind.config')
    ) {
      return {};
    }

    return {
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          node.name.name === 'button'
        ) {
          context.report({
            node,
            messageId: 'rawButton',
          });
        }
      },
    };
  },
};
