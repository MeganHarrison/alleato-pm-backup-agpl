/**
 * ESLint Rule: require-semantic-colors
 *
 * Encourages use of semantic color tokens instead of direct color names.
 * Warns when using gray-* (should use neutral-* or semantic tokens).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require semantic color tokens instead of direct color names',
      category: 'Design System',
      recommended: false,
    },
    messages: {
      useNeutralInsteadOfGray: 'Use "neutral-{{value}}" instead of "gray-{{value}}" for consistency.',
      useSemanticToken: 'Consider using semantic tokens: text-muted-foreground, text-foreground, bg-background, bg-muted, bg-accent, text-destructive, text-primary.',
      avoidDirectColorNames: 'Avoid direct color names like "{{color}}". Use semantic tokens or status colors (text-status-success, text-status-warning, text-status-error, text-status-info).',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Exclude certain files
    if (
      filename.includes('globals.css') ||
      filename.includes('tailwind.config') ||
      filename.includes('design-tokens') ||
      filename.includes('theme.ts')
    ) {
      return {};
    }

    // Direct color names that should be avoided (except status colors)
    const directColorNames = [
      'orange', 'amber', 'lime', 'emerald', 'teal',
      'cyan', 'sky', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
      'slate', 'zinc', 'stone'
    ];

    // Status colors that ARE allowed per design system tokens
    // green-50/500/600, red-50/500/600, yellow-50/500/600, blue-50/500/600
    const allowedStatusPatterns = /^(text|bg)-(green|red|yellow|blue)-(50|500|600)$/;

    // Semantic tokens that should be preferred
    const semanticTokens = [
      'background', 'foreground', 'card', 'card-foreground', 'popover',
      'popover-foreground', 'primary', 'primary-foreground', 'secondary',
      'secondary-foreground', 'muted', 'muted-foreground', 'accent',
      'accent-foreground', 'destructive', 'destructive-foreground',
      'border', 'input', 'ring', 'status-success', 'status-warning',
      'status-error', 'status-info', 'brand', 'brand-hover'
    ];

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

        // Check for gray-* usage (should be neutral-* or semantic)
        const grayRegex = /(text|bg|border)-(gray)-(\d{2,3})/g;
        let match;
        while ((match = grayRegex.exec(classValue)) !== null) {
          const value = match[3]; // 50, 100, 200, etc.

          context.report({
            node,
            messageId: 'useNeutralInsteadOfGray',
            data: { value },
          });
        }

        // Check for bg-white, text-white, bg-black, text-black
        // These should use semantic tokens: bg-background, bg-card, text-foreground, etc.
        const allClasses = classValue.split(/\s+/);
        allClasses.forEach(cls => {
          if (/^(bg|text)-(white|black)$/.test(cls)) {
            context.report({
              node,
              messageId: 'useSemanticToken',
            });
          }
        });

        // Check for direct color names
        const classes = classValue.split(/\s+/);
        classes.forEach(className => {
          // Skip allowed status color patterns (green/red/yellow/blue 50/500/600)
          if (allowedStatusPatterns.test(className)) {
            return;
          }

          directColorNames.forEach(color => {
            // Match patterns like text-red-500, bg-blue-100, border-green-700
            const colorPattern = new RegExp(`^(text|bg|border|ring|outline)-(${color})-(\\d{2,3}|[a-z]+)$`);
            if (colorPattern.test(className)) {
              context.report({
                node,
                messageId: 'avoidDirectColorNames',
                data: { color },
              });
            }
          });
        });
      },
    };
  },
};
