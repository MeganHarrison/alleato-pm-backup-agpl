/**
 * ESLint Rule: no-arbitrary-spacing
 *
 * Prevents arbitrary spacing values in Tailwind classes.
 * Enforces 8px grid system (p-1=4px, p-2=8px, p-4=16px, etc.)
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow arbitrary spacing values in Tailwind classes',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      arbitrarySpacing: 'Arbitrary spacing "{{value}}" detected. Use 8px grid spacing (p-1, p-2, p-4, p-6, p-8, p-12) or CSS variables (var(--space-*)).',
      offGridSpacing: 'Off-grid spacing value "{{value}}" detected. Use values that align with 4px grid: 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, etc.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Exclude certain files
    if (
      filename.includes('globals.css') ||
      filename.includes('tailwind.config')
    ) {
      return {};
    }

    /**
     * Check if a spacing value is on the 4px grid
     * Allowed: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96
     */
    const allowedSpacingValues = new Set([
      '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8',
      '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40',
      '44', '48', '52', '56', '60', '64', '72', '80', '96', 'px', 'full', 'auto'
    ]);

    return {
      JSXAttribute(node) {
        // Only check className and class attributes
        if (!node.name || (node.name.name !== 'className' && node.name.name !== 'class')) {
          return;
        }

        // Get the value of the className
        let classValue = '';
        if (node.value && node.value.type === 'Literal') {
          classValue = node.value.value;
        } else if (node.value && node.value.type === 'JSXExpressionContainer') {
          const expression = node.value.expression;
          if (expression.type === 'TemplateLiteral') {
            classValue = expression.quasis.map(q => q.value.raw).join(' ');
          } else if (expression.type === 'Literal') {
            classValue = expression.value;
          }
        }

        if (!classValue || typeof classValue !== 'string') {
          return;
        }

        // Spacing prefixes to check
        const spacingPrefixes = [
          'p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-', 'ps-', 'pe-',
          'm-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-', 'ms-', 'me-',
          'gap-', 'gap-x-', 'gap-y-',
          'space-x-', 'space-y-',
          'inset-', 'inset-x-', 'inset-y-', 'top-', 'right-', 'bottom-', 'left-',
          'w-', 'h-', 'min-w-', 'min-h-', 'max-w-', 'max-h-',
        ];

        // Check for arbitrary values like p-[10px] or m-[1.5rem]
        const arbitraryRegex = /(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|w|h|min-w|min-h|max-w|max-h)-\[([^\]]+)\]/g;
        let match;
        while ((match = arbitraryRegex.exec(classValue)) !== null) {
          const fullMatch = match[0];
          const value = match[2];

          // Allow CSS variables
          if (value.startsWith('var(--')) {
            continue;
          }

          // Allow calc() expressions
          if (value.startsWith('calc(')) {
            continue;
          }

          context.report({
            node,
            messageId: 'arbitrarySpacing',
            data: { value: fullMatch },
          });
        }

        // Check for off-grid spacing values (optional - less strict)
        // This would check if someone uses p-7 when they should use p-6 or p-8
        const classes = classValue.split(/\s+/);
        classes.forEach(className => {
          spacingPrefixes.forEach(prefix => {
            if (className.startsWith(prefix)) {
              const value = className.substring(prefix.length);

              // Skip negative values (like -mt-4)
              if (className.startsWith('-')) return;

              // Skip arbitrary values (already caught above)
              if (value.startsWith('[')) return;

              // Check if value is in allowed set
              if (!allowedSpacingValues.has(value)) {
                // This is likely a custom value or typo
                // For now, we'll be lenient and not report this
                // Uncomment below to enforce strict grid
                // context.report({
                //   node,
                //   messageId: 'offGridSpacing',
                //   data: { value: className },
                // });
              }
            }
          });
        });
      },
    };
  },
};
