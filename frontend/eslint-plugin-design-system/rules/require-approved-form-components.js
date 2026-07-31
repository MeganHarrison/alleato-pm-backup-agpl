/**
 * ESLint Rule: require-approved-form-components
 *
 * In react-hook-form contexts, enforce shared RHF field adapters instead of
 * wiring raw UI primitives directly.
 *
 * This rule intentionally targets files that appear to be form-managed to
 * reduce false positives for non-form controls (filters, table controls, etc.).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require approved RHF form components in form-managed contexts',
      category: 'Design System',
      recommended: false,
    },
    messages: {
      inputInForm:
        'In RHF/form contexts, use RHFTextField/RHFDateField/RHFNumberField (or shared form field components) instead of raw <Input>.',
      numericInput:
        'Raw numeric <Input> is not allowed. Use <NumberInput>/<NumberField>/<RHFNumberField> for non-currency values, or <MoneyField>/<RHFMoneyField> for currency values.',
      textareaInForm:
        'In RHF/form contexts, use RHFTextareaField (or shared TextareaField) instead of raw <Textarea>.',
      selectInForm:
        'In RHF/form contexts, use RHFSelectField (or shared SelectField) instead of raw <Select>.',
      numberInputInForm:
        'In RHF/form contexts, use RHFNumberField or MoneyField/RHFMoneyField instead of raw <NumberInput>.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/components/ui/') ||
      filename.includes('/components/forms/') ||
      filename.includes('/design/page') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('.stories.') ||
      filename.includes('__tests__') ||
      filename.includes('/tests/')
    ) {
      return {};
    }

    let hasFormContext = false;

    function getLiteralAttrValue(node, attrName) {
      const attr = (node.attributes || []).find(
        (candidate) =>
          candidate.type === 'JSXAttribute' &&
          candidate.name &&
          candidate.name.type === 'JSXIdentifier' &&
          candidate.name.name === attrName,
      );
      if (!attr || !attr.value) return null;
      if (attr.value.type === 'Literal') return attr.value.value;
      return null;
    }

    function hasAttr(node, attrName) {
      return (node.attributes || []).some(
        (candidate) =>
          candidate.type === 'JSXAttribute' &&
          candidate.name &&
          candidate.name.type === 'JSXIdentifier' &&
          candidate.name.name === attrName,
      );
    }

    function isNumericInput(node) {
      if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'Input') {
        return false;
      }

      const type = getLiteralAttrValue(node, 'type');
      if (type === 'number') return true;

      const inputMode = getLiteralAttrValue(node, 'inputMode');
      if (inputMode === 'decimal' || inputMode === 'numeric') return true;

      return hasAttr(node, 'step');
    }

    function markIfFormContext(importNode) {
      const source = importNode.source && importNode.source.value;
      if (source === 'react-hook-form') {
        hasFormContext = true;
      }

      if (
        source === '@/components/ui/form' ||
        source === '@/components/forms/FormField'
      ) {
        const formNames = new Set([
          'FormField',
          'FormItem',
          'FormControl',
          'Controller',
          'useForm',
          'useFieldArray',
        ]);
        for (const specifier of importNode.specifiers || []) {
          const importedName =
            specifier.imported && specifier.imported.name
              ? specifier.imported.name
              : specifier.local && specifier.local.name;
          if (importedName && formNames.has(importedName)) {
            hasFormContext = true;
            break;
          }
        }
      }
    }

    return {
      ImportDeclaration(node) {
        markIfFormContext(node);
      },

      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;

        if (isNumericInput(node)) {
          context.report({ node, messageId: 'numericInput' });
          return;
        }

        if (!hasFormContext) return;

        if (node.name.name === 'Input') {
          context.report({ node, messageId: 'inputInForm' });
          return;
        }

        if (node.name.name === 'Textarea') {
          context.report({ node, messageId: 'textareaInForm' });
          return;
        }

        if (node.name.name === 'Select') {
          context.report({ node, messageId: 'selectInForm' });
          return;
        }

        if (node.name.name === 'NumberInput') {
          context.report({ node, messageId: 'numberInputInForm' });
        }
      },
    };
  },
};
