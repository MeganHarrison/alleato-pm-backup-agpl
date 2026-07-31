/**
 * ESLint Rule: no-hardcoded-colors
 *
 * Prevents hardcoded color values in className attributes.
 * Enforces use of design system tokens from globals.css.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded color values in className attributes',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      hardcodedHexColor: 'Hardcoded hex color "{{color}}" detected. Use design tokens from globals.css instead.',
      hardcodedRgbColor: 'Hardcoded rgb/rgba color detected. Use design tokens from globals.css instead.',
      hardcodedHslColor: 'Hardcoded hsl/hsla color detected. Use design tokens from globals.css instead.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Exclude globals.css and design token files
    if (
      filename.includes('globals.css') ||
      filename.includes('design-tokens') ||
      filename.includes('theme.ts') ||
      filename.includes('colors.ts')
    ) {
      return {};
    }

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
          // For template literals and expressions, try to extract static parts
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

        // Check for hex colors (#fff, #ffffff, #123abc)
        const hexColorRegex = /#[0-9a-fA-F]{3,6}/g;
        const hexMatches = classValue.match(hexColorRegex);
        if (hexMatches) {
          hexMatches.forEach(color => {
            context.report({
              node,
              messageId: 'hardcodedHexColor',
              data: { color },
            });
          });
        }

        // Check for rgb/rgba colors
        const rgbRegex = /rgba?\([^)]+\)/g;
        const rgbMatches = classValue.match(rgbRegex);
        if (rgbMatches) {
          context.report({
            node,
            messageId: 'hardcodedRgbColor',
          });
        }

        // Check for hsl/hsla colors
        const hslRegex = /hsla?\([^)]+\)/g;
        const hslMatches = classValue.match(hslRegex);
        if (hslMatches) {
          context.report({
            node,
            messageId: 'hardcodedHslColor',
          });
        }
      },

      // Also check for inline style objects
      JSXExpressionContainer(node) {
        if (node.parent.type !== 'JSXAttribute') return;
        if (node.parent.name.name !== 'style') return;

        const expression = node.expression;
        if (expression.type !== 'ObjectExpression') return;

        expression.properties.forEach(prop => {
          if (prop.type !== 'Property') return;
          const value = prop.value;

          if (value.type === 'Literal' && typeof value.value === 'string') {
            const strValue = value.value;

            // Check for hex colors
            if (/#[0-9a-fA-F]{3,6}/.test(strValue)) {
              const match = strValue.match(/#[0-9a-fA-F]{3,6}/);
              context.report({
                node: value,
                messageId: 'hardcodedHexColor',
                data: { color: match[0] },
              });
            }

            // Check for rgb/rgba
            if (/rgba?\([^)]+\)/.test(strValue)) {
              context.report({
                node: value,
                messageId: 'hardcodedRgbColor',
              });
            }

            // Check for hsl/hsla
            if (/hsla?\([^)]+\)/.test(strValue)) {
              context.report({
                node: value,
                messageId: 'hardcodedHslColor',
              });
            }
          }
        });
      },
    };
  },
};
