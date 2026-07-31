/**
 * ESLint Rule: no-hand-rolled-dropdown-menu
 *
 * Prevent bespoke dropdown/context-menu stacks built from an absolutely/fixed
 * positioned popover <div> plus nested <Button> rows. These bypass the shared
 * DropdownMenu primitive and drift on alignment, keyboard behavior, and
 * destructive styling.
 *
 * The rule intentionally targets the narrow offender shape seen in production:
 *   - a <div> menu shell with popover/menu-like classes
 *   - rendered outside the shared dropdown primitive
 *   - containing nested Button rows
 *
 * It does not block legitimate custom overlays such as searchable multiselects,
 * dev tooling, or context menus that already use DropdownMenuContent/Item.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow hand-rolled dropdown/context-menu button stacks when the shared dropdown primitive should be used',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      handRolledDropdown:
        'Use the shared DropdownMenu primitive instead of a hand-rolled popover div with Button rows.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/components/ui/') ||
      filename.includes('/components/dev/') ||
      filename.includes('/components/dev-tools/') ||
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('.stories.') ||
      filename.includes('/tests/')
    ) {
      return {};
    }

    function getStaticClassName(node) {
      for (const attr of node.attributes ?? []) {
        if (
          attr.type !== 'JSXAttribute' ||
          attr.name?.name !== 'className' ||
          !attr.value
        ) {
          continue;
        }

        if (attr.value.type === 'Literal') {
          return typeof attr.value.value === 'string' ? attr.value.value : null;
        }

        if (
          attr.value.type === 'JSXExpressionContainer' &&
          attr.value.expression.type === 'Literal' &&
          typeof attr.value.expression.value === 'string'
        ) {
          return attr.value.expression.value;
        }
      }

      return null;
    }

    function hasMenuShellClasses(className) {
      if (!className) return false;

      const tokens = [
        'bg-popover',
        'p-1',
        'border',
        'shadow-sm',
      ];

      const hasPositionToken =
        className.includes('absolute') || className.includes('fixed');

      return hasPositionToken && tokens.every((token) => className.includes(token));
    }

    function subtreeContainsButton(node) {
      if (!node || typeof node !== 'object') return false;

      if (
        node.type === 'JSXOpeningElement' &&
        node.name?.type === 'JSXIdentifier' &&
        node.name.name === 'Button'
      ) {
        return true;
      }

      for (const [key, value] of Object.entries(node)) {
        if (key === 'parent') {
          continue;
        }

        if (Array.isArray(value)) {
          for (const child of value) {
            if (subtreeContainsButton(child)) return true;
          }
          continue;
        }

        if (subtreeContainsButton(value)) return true;
      }

      return false;
    }

    return {
      JSXOpeningElement(node) {
        if (
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'div'
        ) {
          return;
        }

        const className = getStaticClassName(node);
        if (!hasMenuShellClasses(className)) {
          return;
        }

        const jsxElement = node.parent;
        if (!jsxElement || jsxElement.type !== 'JSXElement') {
          return;
        }

        if (!subtreeContainsButton(jsxElement)) {
          return;
        }

        context.report({
          node,
          messageId: 'handRolledDropdown',
        });
      },
    };
  },
};
