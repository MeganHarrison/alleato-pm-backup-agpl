/**
 * ESLint Rule: require-money-field
 *
 * Enforces that ALL currency/money input fields use the shared MoneyField
 * component (or its RHF adapter RHFMoneyField). Blocks:
 *
 * 1. <NumberInput currency> — NumberInput must not handle money
 * 2. <InputGroupAddon>$</InputGroupAddon> — manual $ prefix on inputs
 * 3. <Input> with inputMode="decimal" — only MoneyField should use this
 *
 * Allowed files:
 * - MoneyField.tsx (the canonical implementation)
 * - number-input.tsx (for non-currency NumberInput usage)
 * - Design system demo pages
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'All currency/money inputs must use MoneyField or RHFMoneyField',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      numberInputCurrency:
        '<NumberInput currency> is not allowed. Use <MoneyField> or <RHFMoneyField> for all currency inputs. See docs/design/DESIGN.md.',
      manualDollarPrefix:
        'Manual "$" prefix on input groups is not allowed. Use <MoneyField> or <RHFMoneyField> which handle the $ prefix internally.',
      rawDecimalInput:
        '<Input inputMode="decimal"> is not allowed outside MoneyField. Use <MoneyField> or <RHFMoneyField> for currency inputs.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Allow the canonical implementations and demo pages
    if (
      filename.includes('MoneyField') ||
      filename.includes('number-input') ||
      filename.includes('/design/page') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('/components/ui/')
    ) {
      return {};
    }

    return {
      // Rule 1: Block <NumberInput currency> or <NumberInput currency={true}>
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          node.name.name === 'NumberInput'
        ) {
          const hasCurrencyProp = node.attributes.some(
            (attr) =>
              attr.type === 'JSXAttribute' &&
              attr.name &&
              attr.name.name === 'currency'
          );
          if (hasCurrencyProp) {
            context.report({
              node,
              messageId: 'numberInputCurrency',
            });
          }
        }
      },

      // Rule 2: Block <InputGroupAddon>$</InputGroupAddon>
      JSXElement(node) {
        if (
          node.openingElement.name.type === 'JSXIdentifier' &&
          node.openingElement.name.name === 'InputGroupAddon'
        ) {
          // Check if the text content is "$"
          const children = node.children || [];
          const textContent = children
            .filter((child) => child.type === 'JSXText' || child.type === 'Literal')
            .map((child) => (child.value || '').trim())
            .join('');

          if (textContent === '$') {
            context.report({
              node,
              messageId: 'manualDollarPrefix',
            });
          }
        }
      },

      // Rule 3: Block <Input inputMode="decimal"> or <InputGroupInput inputMode="decimal">
      // outside of MoneyField
      JSXAttribute(node) {
        if (
          node.name &&
          node.name.name === 'inputMode' &&
          node.value &&
          node.value.type === 'Literal' &&
          node.value.value === 'decimal'
        ) {
          const parent = node.parent;
          if (
            parent &&
            parent.name &&
            parent.name.type === 'JSXIdentifier'
          ) {
            const tagName = parent.name.name;
            // Only flag on raw HTML inputs and InputGroupInput, not on MoneyField itself
            if (
              tagName === 'Input' ||
              tagName === 'input' ||
              tagName === 'InputGroupInput'
            ) {
              context.report({
                node: parent,
                messageId: 'rawDecimalInput',
              });
            }
          }
        }
      },
    };
  },
};
