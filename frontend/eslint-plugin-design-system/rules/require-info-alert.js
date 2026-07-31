/**
 * ESLint Rule: require-info-alert
 *
 * Catches hand-rolled info/callout boxes and requires <InfoAlert> from @/components/ds.
 *
 * The symptom that caused this rule: an agent built a flex container with bg-muted/50,
 * an Info icon, and inline text — instead of using the existing InfoAlert component.
 * InfoAlert already handles bg-primary/5, primary-colored icon, border, and dark mode.
 *
 * Detects: <div className="... flex ... bg-muted ..."> that looks like a callout box.
 *
 * @type {import('eslint').Rule.RuleModule}
 */

'use strict';

/**
 * Extract the string value from a className JSX attribute value node.
 */
function getClassNameValue(node) {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked).join('');
  }
  if (node.type === 'CallExpression') {
    return node.arguments
      .filter((a) => a.type === 'Literal')
      .map((a) => a.value)
      .join(' ');
  }
  return '';
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require <InfoAlert> from @/components/ds instead of hand-rolling info/callout boxes',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      useInfoAlert:
        'Hand-rolled callout detected. Use <InfoAlert variant="info|warning|success|error"> ' +
        'from "@/components/ds/InfoAlert" instead. It handles bg-primary/5, icon color, ' +
        'border, and dark mode automatically. See GOLDEN-EXAMPLES.tsx.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Allow in design system files themselves
    if (
      filename.includes('/components/ds/') ||
      filename.includes('/components/ui/') ||
      filename.includes('GOLDEN-EXAMPLES') ||
      filename.includes('InfoAlert')
    ) {
      return {};
    }

    return {
      JSXOpeningElement(node) {
        const elementName =
          node.name.type === 'JSXIdentifier' ? node.name.name : null;

        // Only check <div> elements
        if (elementName !== 'div') return;

        const classNameAttr = node.attributes.find(
          (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'className',
        );
        if (!classNameAttr || !classNameAttr.value) return;

        const raw = getClassNameValue(
          classNameAttr.value.type === 'JSXExpressionContainer'
            ? classNameAttr.value.expression
            : classNameAttr.value,
        );

        if (!raw) return;

        // A hand-rolled callout typically has:
        // - flex layout
        // - a tinted background (bg-muted, bg-blue-*, bg-primary/*, bg-yellow-*, etc.)
        // - a gap (gap-*)
        // and then an icon inside it
        const hasFlex = /\bflex\b/.test(raw);
        const hasGap = /\bgap-/.test(raw);
        // Only a *persistent* tinted background signals a callout. State-prefixed
        // backgrounds (hover:/focus:/active:/group-hover: etc.) are interaction
        // affordances on clickable rows/list items, not callouts — the `(?<!:)`
        // lookbehind excludes any bg- token preceded by a variant colon.
        const hasTintedBg =
          /(?<!:)\bbg-(muted|primary|blue|yellow|red|green|amber|orange|destructive)/.test(raw);
        const hasBorder = /\bborder\b/.test(raw) && !/\bborder-(border|transparent)\b/.test(raw);

        // Must look like a callout: flex + gap + tinted background (not just a content section)
        // The "content section" pattern (bg-muted/50 p-6 without gap/flex) is fine
        if (hasFlex && hasGap && hasTintedBg) {
          context.report({ node, messageId: 'useInfoAlert' });
        }

        // Also catch: rounded + border + tinted bg (non-flex callout style)
        if (hasBorder && hasTintedBg && /\brounded/.test(raw) && /\bpx-/.test(raw)) {
          context.report({ node, messageId: 'useInfoAlert' });
        }
      },
    };
  },
};
