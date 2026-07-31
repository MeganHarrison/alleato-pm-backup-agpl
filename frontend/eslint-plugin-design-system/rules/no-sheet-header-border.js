/**
 * ESLint Rule: no-sheet-header-border
 *
 * Bans `border-b`/`border-t`/`border` utility classes on <SheetHeader> and
 * <SidePanelHeader> at any callsite. The shared components in
 * components/ui/sheet.tsx and components/ui/side-panel.tsx intentionally
 * render no border under the title section — every sidebar sheet/panel in
 * the app must look identical. Individual callsites bolting on their own
 * `border-b` is exactly how this drifted out of sync (some panels had a
 * border, some didn't, for no reason). If the border is ever wanted, it
 * belongs in the shared component, not scattered across callsites.
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const FLAGGED_COMPONENTS = new Set(['SheetHeader', 'SidePanelHeader']);
const BORDER_PATTERN = /(^|\s)border(-[a-z]+)?(\/\d+)?(\s|$)/;

function getClassNameAttr(node) {
  return node.attributes.find(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === 'className',
  );
}

function literalValue(attr) {
  if (!attr || !attr.value) return null;
  if (attr.value.type === 'Literal' && typeof attr.value.value === 'string') {
    return attr.value.value;
  }
  if (
    attr.value.type === 'JSXExpressionContainer' &&
    attr.value.expression.type === 'Literal' &&
    typeof attr.value.expression.value === 'string'
  ) {
    return attr.value.expression.value;
  }
  return null;
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow border-* classes on SheetHeader/SidePanelHeader — the shared component owns this styling, not callsites',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      noSheetHeaderBorder:
        '<{{tag}}> must not have a border class at the callsite — every sidebar sheet header must look identical. If a border is genuinely wanted, add it inside the shared component in components/ui/sheet.tsx or side-panel.tsx, not here.',
    },
    schema: [],
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        if (
          node.name.type !== 'JSXIdentifier' ||
          !FLAGGED_COMPONENTS.has(node.name.name)
        ) {
          return;
        }

        const classNameAttr = getClassNameAttr(node);
        const value = literalValue(classNameAttr);
        if (value && BORDER_PATTERN.test(` ${value} `)) {
          context.report({
            node: classNameAttr,
            messageId: 'noSheetHeaderBorder',
            data: { tag: node.name.name },
          });
        }
      },
    };
  },
};
