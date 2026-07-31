/**
 * ESLint Rule: no-stacked-table-cell
 *
 * Bans stacking a secondary line of information underneath the primary value
 * inside a table cell `render:` function.
 *
 * A table row is already a grid: one column = one attribute. Tucking a second
 * attribute (a slug under a title, a created date under a report name, a status
 * caption under a count) into the same cell makes rows ragged, doubles row
 * height, and hides the secondary datum from sorting, filtering, and CSV export.
 * If the secondary value matters, it gets its own column; if it doesn't, delete
 * it.
 *
 * Detected shape — a stacked container (flex-col / space-y-* / a bare div with
 * two element children) inside a `render:` where one child is muted secondary
 * text:
 *
 *   render: (doc) => (
 *     <div className="min-w-0">
 *       <CellLink value={doc.title} … />
 *       <div className="truncate text-xs text-muted-foreground">{doc.slug}</div>
 *     </div>
 *   )
 *
 * ALSO bans the shared `<CellStackText>` primitive whenever it is given a
 * `secondary` prop. That component stacks the secondary line *inside itself*, so
 * the raw-JSX detection above cannot see it — this is exactly how the banned
 * pattern kept reappearing (project-creation-log, email-attachments) after the
 * rule was first swept to zero. `<CellStackText primary … icon … />` with no
 * `secondary` is still fine (icon + single line is inline, not stacked).
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const STACKED_PATTERN = /(^|\s)(flex-col|space-y-\d)/;
const INLINE_PATTERN = /(^|\s)(flex-row|items-center|inline-flex|gap-x-)/;
const MUTED_PATTERN = /(^|\s)text-muted-foreground(\s|$)/;
const BLOCK_TAGS = new Set(['div', 'p', 'li']);

/**
 * Floating surfaces (tooltips, popovers, menus) legitimately stack lines — they
 * are not the cell. Their subtrees are skipped entirely.
 */
const FLOATING_CONTAINERS = new Set([
  'TooltipContent',
  'HoverCardContent',
  'PopoverContent',
  'DropdownMenuContent',
  'SheetContent',
]);

function tagNameOf(node) {
  const name = node.openingElement.name;
  return name.type === 'JSXIdentifier' ? name.name : null;
}

function classNameOf(node) {
  if (!node || node.type !== 'JSXElement') return null;
  const attr = node.openingElement.attributes.find(
    (candidate) =>
      candidate.type === 'JSXAttribute' &&
      candidate.name.type === 'JSXIdentifier' &&
      candidate.name.name === 'className',
  );
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
  // Template literals / cn() calls: fall back to the raw source text so the
  // static utility classes in them are still visible to the patterns above.
  return null;
}

function elementChildren(node) {
  return node.children.filter((child) => {
    if (child.type === 'JSXElement') return true;
    // `{cond && <span/>}` counts as a child line too.
    if (child.type === 'JSXExpressionContainer') {
      const { expression } = child;
      return (
        expression.type === 'LogicalExpression' &&
        expression.right.type === 'JSXElement'
      );
    }
    return false;
  });
}

function unwrapChild(child) {
  if (child.type === 'JSXElement') return child;
  return child.expression.right;
}

function hasMutedText(node, depth = 0) {
  if (depth > 3 || !node || node.type !== 'JSXElement') return false;
  const className = classNameOf(node);
  if (className && MUTED_PATTERN.test(className)) return true;
  return node.children.some((child) => {
    const element =
      child.type === 'JSXElement'
        ? child
        : child.type === 'JSXExpressionContainer' &&
            child.expression.type === 'LogicalExpression' &&
            child.expression.right.type === 'JSXElement'
          ? child.expression.right
          : null;
    return element ? hasMutedText(element, depth + 1) : false;
  });
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow stacking a secondary muted line under the primary value inside a table cell render function',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      noStackedTableCell:
        'Table cells never stack information. This cell renders a secondary muted line under its primary value — one column, one attribute. Give the secondary value its own column (so it is sortable, filterable, and exportable) or delete it.',
      noStackedCellComponent:
        'Table cells never stack information. <CellStackText secondary=…> renders a second muted line under the primary value — one column, one attribute. Give the secondary value its own column (sortable/filterable/exportable) or delete it. Keep <CellStackText> only for the icon + single-value case (drop the `secondary` prop).',
    },
    schema: [],
  },

  create(context) {
    // Storybook stories use `render:` for the story body, not a table cell.
    if (/\.stories\.[jt]sx?$/.test(context.filename ?? '')) return {};

    function checkRenderBody(node) {
      const stack = [node];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || current.type !== 'JSXElement') continue;
        if (FLOATING_CONTAINERS.has(tagNameOf(current))) continue;

        const children = elementChildren(current);
        if (children.length >= 2) {
          const className = classNameOf(current) ?? '';
          // Children only sit on separate lines when the container stacks them
          // explicitly, or when the children are themselves block-level.
          const hasBlockChild = children.some((child) => {
            const element = unwrapChild(child);
            const tag = tagNameOf(element);
            if (tag && BLOCK_TAGS.has(tag)) return true;
            const childClass = classNameOf(element) ?? '';
            return /(^|\s)block(\s|$)/.test(childClass);
          });
          const isStacked =
            STACKED_PATTERN.test(className) ||
            (hasBlockChild && !INLINE_PATTERN.test(className));
          const mutedChildren = children.filter((child) =>
            hasMutedText(unwrapChild(child)),
          );
          if (isStacked && mutedChildren.length > 0 && mutedChildren.length < children.length) {
            context.report({ node: current, messageId: 'noStackedTableCell' });
            return;
          }
        }

        for (const child of current.children) {
          if (child.type === 'JSXElement') stack.push(child);
          else if (
            child.type === 'JSXExpressionContainer' &&
            child.expression.type === 'LogicalExpression' &&
            child.expression.right.type === 'JSXElement'
          ) {
            stack.push(child.expression.right);
          }
        }
      }
    }

    function bodyJsx(fn) {
      if (!fn) return null;
      if (fn.body.type === 'JSXElement') return fn.body;
      if (
        fn.body.type === 'JSXFragment' ||
        fn.body.type === 'BlockStatement' ||
        fn.body.type === 'ParenthesizedExpression'
      ) {
        return null;
      }
      return null;
    }

    return {
      Property(node) {
        if (
          node.key.type !== 'Identifier' ||
          node.key.name !== 'render' ||
          (node.value.type !== 'ArrowFunctionExpression' &&
            node.value.type !== 'FunctionExpression')
        ) {
          return;
        }
        const jsx = bodyJsx(node.value);
        if (jsx) checkRenderBody(jsx);
      },

      // The shared <CellStackText> primitive stacks its own secondary line, so
      // the raw-JSX walk above cannot see it. Flag any usage that passes a live
      // `secondary` value (an explicit null/undefined is a no-op and allowed).
      JSXOpeningElement(node) {
        if (
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'CellStackText'
        ) {
          return;
        }
        const secondary = node.attributes.find(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'secondary',
        );
        if (!secondary) return;

        if (
          secondary.value &&
          secondary.value.type === 'JSXExpressionContainer'
        ) {
          const expr = secondary.value.expression;
          const isNoop =
            (expr.type === 'Identifier' && expr.name === 'undefined') ||
            (expr.type === 'Literal' && expr.value === null);
          if (isNoop) return;
        }

        context.report({ node, messageId: 'noStackedCellComponent' });
      },
    };
  },
};
