/**
 * ESLint Rule: require-editable-status-column
 *
 * Every table in this app is built on UnifiedTablePage, which has built-in
 * inline cell editing (click a cell → edit in place → save). It is ON by
 * default. A status/dropdown column should be editable inline — forcing the
 * user to open a separate edit page just to change a dropdown is the exact
 * anti-pattern this rule exists to prevent.
 *
 * This rule fires on table-config files (`*-table-config.{ts,tsx}`). When a
 * column's `render` returns a <StatusBadge> (the canonical status-dropdown
 * signal), the column object MUST make an explicit decision about inline
 * editing by declaring an `editable` property:
 *
 *   - `editable: Boolean(inlineEdit)` / `editable: true` — wire it (also add
 *     editType: "select", editValue, editOptions, onEdit). See
 *     features/drawings/drawings-table-config.tsx for the reference pattern.
 *   - `editable: false` — an explicit, intentional opt-out (e.g. the status is
 *     controlled by a lifecycle/state machine or an approval route, not free
 *     user choice). This silences the rule and documents the decision.
 *
 * The escape hatch is deliberate: lifecycle-owned statuses SHOULD be read-only,
 * but that must be a conscious `editable: false`, not an accidental omission.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Status/dropdown columns must declare an explicit `editable` decision so tables are inline-editable by default',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      missingEditable:
        'This status column (renders <StatusBadge>) does not declare `editable`. ' +
        'UnifiedTablePage supports inline editing — wire it with `editable: Boolean(inlineEdit)` + ' +
        'editType: "select" + editValue + editOptions + onEdit (see features/drawings/drawings-table-config.tsx), ' +
        'OR explicitly opt out with `editable: false` if this status is lifecycle/approval-controlled. ' +
        'Do not force a redirect-to-edit-page for a dropdown.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only enforce on table-config files — that is where column definitions live.
    if (!/-table-config\.(ts|tsx)$/.test(filename)) {
      return {};
    }

    /**
     * Recursively search an AST node for a JSX element named `StatusBadge`.
     * Kept intentionally small — column render fns are shallow.
     */
    function containsStatusBadge(node, depth = 0) {
      if (!node || typeof node !== 'object' || depth > 40) return false;

      if (
        node.type === 'JSXOpeningElement' &&
        node.name &&
        node.name.type === 'JSXIdentifier' &&
        node.name.name === 'StatusBadge'
      ) {
        return true;
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child.type === 'string' && containsStatusBadge(child, depth + 1)) {
              return true;
            }
          }
        } else if (value && typeof value.type === 'string') {
          if (containsStatusBadge(value, depth + 1)) return true;
        }
      }
      return false;
    }

    function hasProperty(objectExpression, name) {
      return objectExpression.properties.some(
        (prop) =>
          prop.type === 'Property' &&
          ((prop.key.type === 'Identifier' && prop.key.name === name) ||
            (prop.key.type === 'Literal' && prop.key.value === name)),
      );
    }

    return {
      ObjectExpression(node) {
        const renderProp = node.properties.find(
          (prop) =>
            prop.type === 'Property' &&
            ((prop.key.type === 'Identifier' && prop.key.name === 'render') ||
              (prop.key.type === 'Literal' && prop.key.value === 'render')),
        );
        if (!renderProp) return;

        // Looks like a column definition. Does its render emit a StatusBadge?
        if (!containsStatusBadge(renderProp.value)) return;

        // A status column — require an explicit editable decision.
        if (hasProperty(node, 'editable')) return;

        context.report({ node: renderProp, messageId: 'missingEditable' });
      },
    };
  },
};
