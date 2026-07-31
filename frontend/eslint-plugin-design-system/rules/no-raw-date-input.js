/**
 * ESLint Rule: no-raw-date-input
 *
 * Prevents using raw <Input type="date"> in form files.
 * All date fields in RHF forms must use <RHFDateField> from "@/components/forms/fields".
 *
 * <Input type="date"> renders the OS-native date picker which looks different
 * on every browser/OS and is inconsistent with the rest of the design system.
 * RHFDateField provides a consistent Popover+Calendar (desktop) / Drawer+Calendar (mobile).
 *
 * Excluded:
 *   - The RHFDateField component itself
 *   - shadcn ui/input primitive
 *   - Design system ds/ composites
 *   - Filter / timeline / AI widget contexts (non-form inputs)
 *   - Admin pages (internal tools)
 *   - Test / story files
 *   - Inline table editing (detail-panel, *-table-config)
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow raw <Input type="date"> — use <RHFDateField> from @/components/forms/fields',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawDateInput:
        'Do not use <Input type="date">. ' +
        'Use <RHFDateField> from "@/components/forms/fields" for RHF forms. ' +
        'It provides a consistent calendar popover on desktop and a drawer on mobile. ' +
        'Import: import { RHFDateField } from "@/components/forms/fields/RHFDateField"',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/components/ui/input') ||
      filename.includes('/components/ds/') ||
      filename.includes('RHFDateField') ||
      filename.includes('DateField') ||
      filename.includes('date-field') ||
      filename.includes('detail-panel') ||
      filename.includes('table-config') ||
      filename.includes('filter-popover') ||
      filename.includes('cross-source-timeline') ||
      filename.includes('assistant-widget-renderer') ||
      filename.includes('/app/(admin)/') ||
      filename.includes('/(admin)/') ||
      filename.includes('site-scribe') ||
      filename.includes('DailyLog') ||
      filename.includes('daily-log') ||
      filename.includes('AutoForm') ||
      filename.includes('.stories.') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('/tests/')
    ) {
      return {};
    }

    return {
      JSXOpeningElement(node) {
        const name = node.name;
        if (
          name.type !== 'JSXIdentifier' ||
          name.name !== 'Input'
        ) {
          return;
        }

        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute' || attr.name?.name !== 'type') {
            continue;
          }

          const val = attr.value;
          if (
            (val?.type === 'Literal' && val.value === 'date') ||
            (val?.type === 'JSXExpressionContainer' &&
              val.expression?.type === 'Literal' &&
              val.expression.value === 'date')
          ) {
            context.report({ node, messageId: 'rawDateInput' });
          }
        }
      },
    };
  },
};
