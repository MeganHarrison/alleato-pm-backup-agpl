/**
 * ESLint Rule: no-editable-title-column
 *
 * The title/name/subject column of a table is the user's link to the detail
 * page. It must NEVER be inline-editable — an editable cell hijacks the click
 * that should navigate to the record, so the user can no longer open the record.
 *
 * This rule fires on table-config files (`*-table-config.{ts,tsx}`). It flags any
 * column that declares an inline editor (`editValue`) bound to the primary
 * identifier field — `item.title`, `item.name`, or `item.subject`. The fix is to
 * remove `editable`/`editValue`/`onEdit` from that column and let the cell render
 * as a link (or rely on the row's onRowClick) to the detail page.
 *
 * Secondary descriptive fields (description, scope_summary, notes, etc.) may stay
 * editable — only the primary title/name/subject identifier is forbidden.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Title/name/subject columns must link to the detail page, never be inline-editable',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      editableTitle:
        'The {{field}} column must link to the detail page — it cannot be inline-editable. ' +
        'An editable cell hijacks the click that opens the record. ' +
        'Remove `editable`/`editValue`/`onEdit` from this column and render it as a link ' +
        '(or rely on onRowClick). Only secondary fields (description, notes, status, dates) may be inline-editable.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();
    if (!/-table-config\.(ts|tsx)$/.test(filename)) {
      return {};
    }

    const FORBIDDEN_FIELDS = new Set(['title', 'name', 'subject']);

    // Find a `<param>.title|name|subject` member access anywhere in a node.
    function referencesForbiddenField(node, depth = 0) {
      if (!node || typeof node !== 'object' || depth > 40) return null;

      if (
        node.type === 'MemberExpression' &&
        node.property &&
        node.property.type === 'Identifier' &&
        FORBIDDEN_FIELDS.has(node.property.name) &&
        !node.computed
      ) {
        return node.property.name;
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child.type === 'string') {
              const found = referencesForbiddenField(child, depth + 1);
              if (found) return found;
            }
          }
        } else if (value && typeof value.type === 'string') {
          const found = referencesForbiddenField(value, depth + 1);
          if (found) return found;
        }
      }
      return null;
    }

    return {
      Property(node) {
        // Only inspect `editValue` properties — they exist solely on editable columns.
        const isEditValue =
          (node.key.type === 'Identifier' && node.key.name === 'editValue') ||
          (node.key.type === 'Literal' && node.key.value === 'editValue');
        if (!isEditValue) return;

        const field = referencesForbiddenField(node.value);
        if (!field) return;

        context.report({ node, messageId: 'editableTitle', data: { field } });
      },
    };
  },
};
