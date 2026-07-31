/**
 * ESLint Rule: no-raw-form-controls
 *
 * Prevents raw HTML form controls in app code.
 * Use shared design-system primitives and form-field wrappers instead.
 *
 * Allowed:
 * - UI primitive implementations under /components/ui/
 * - Hidden inputs (<input type="hidden">) for metadata fields
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw <input>/<select>/<textarea> outside UI primitives',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      rawInput:
        'Use shared form primitives (Input/Textarea/Select or field wrappers) instead of raw <input>.',
      rawSelect:
        'Use shared Select/form primitives instead of raw <select>.',
      rawTextarea:
        'Use shared Textarea/form primitives instead of raw <textarea>.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes('/components/ui/') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('tailwind.config') ||
      filename.includes('globals.css')
    ) {
      return {};
    }

    const getAttrValue = (node, attrName) => {
      const attr = node.attributes.find(
        (a) =>
          a.type === 'JSXAttribute' &&
          a.name &&
          a.name.type === 'JSXIdentifier' &&
          a.name.name === attrName,
      );
      if (!attr || !attr.value) return null;
      if (attr.value.type === 'Literal') return attr.value.value;
      return null;
    };

    const isHiddenInput = (node) => getAttrValue(node, 'type') === 'hidden';

    // <input type="file" className="hidden"> is a legitimate browser file picker
    // trigger pattern — it cannot be replaced by a DS Input component.
    const isHiddenFileInput = (node) => {
      const type = getAttrValue(node, 'type');
      if (type !== 'file') return false;
      const cls = getAttrValue(node, 'className');
      return cls != null && /\bhidden\b/.test(cls);
    };

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;

        if (node.name.name === 'input') {
          if (isHiddenInput(node)) return;
          if (isHiddenFileInput(node)) return;
          context.report({ node, messageId: 'rawInput' });
          return;
        }

        if (node.name.name === 'select') {
          context.report({ node, messageId: 'rawSelect' });
          return;
        }

        if (node.name.name === 'textarea') {
          context.report({ node, messageId: 'rawTextarea' });
        }
      },
    };
  },
};

