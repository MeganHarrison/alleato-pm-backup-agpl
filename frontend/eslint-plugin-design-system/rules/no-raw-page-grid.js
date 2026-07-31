/**
 * ESLint Rule: no-raw-page-grid
 *
 * In page files (src/app/**\/page.tsx), the overall page layout must be expressed
 * through <PageScaffold layout="single|sidebar|two-column|three-column"> rather
 * than a hand-rolled multi-column grid (`grid-cols-2`, `lg:grid-cols-3`,
 * `xl:grid-cols-[...]`, etc.).
 *
 * Why: PageShell controls width + header, but it leaves the content region free,
 * so each agent re-invents the column structure with different breakpoints, gaps,
 * and ratios — producing the random "why is this two columns?" layouts. Forcing
 * every page to pick from a fixed menu of named layouts removes that freedom.
 *
 * Single-column grids (`grid-cols-1`) are allowed. Repeated-card grids belong in
 * a component (e.g. <KpiRow>), not inline in a page file.
 */

// Matches a multi-column grid utility: grid-cols-2..12 or grid-cols-[arbitrary],
// with or without a responsive prefix. Deliberately does NOT match grid-cols-1.
const MULTI_COL_GRID =
  /(?:(?:sm|md|lg|xl|2xl):)?grid-cols-(?:[2-9]|1[0-2]|\[)/;

function isPageFile(filename) {
  const normalized = filename.replace(/\\/g, "/");
  return (
    /\/src\/app\/.*\/page\.tsx$/.test(normalized) ||
    /\/src\/app\/page\.tsx$/.test(normalized)
  );
}

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use <PageScaffold layout=...> instead of a raw multi-column grid in a page file",
      category: "Design System",
      recommended: true,
    },
    messages: {
      rawPageGrid:
        "Raw multi-column grid in a page file. Use <PageScaffold layout=\"single|sidebar|two-column|three-column\"> " +
        "from \"@/components/layout\" so page layout stays consistent. " +
        "Repeated cards/metrics go in a component (e.g. <KpiRow>), not an inline grid.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename?.() || context.filename || "";
    if (!filename.endsWith(".tsx")) return {};
    if (!isPageFile(filename)) return {};

    function check(node, str) {
      if (typeof str === "string" && MULTI_COL_GRID.test(str)) {
        context.report({ node, messageId: "rawPageGrid" });
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") return;
        const value = node.value;
        if (!value) return;

        // className="..."
        if (value.type === "Literal") {
          check(node, value.value);
          return;
        }

        if (value.type !== "JSXExpressionContainer") return;
        const expr = value.expression;

        // className={`...`}
        if (expr.type === "TemplateLiteral") {
          check(node, expr.quasis.map((q) => q.value.raw).join(" "));
          return;
        }

        // className={cn("...", ...)} — scan string args
        if (expr.type === "CallExpression") {
          const callee = expr.callee;
          const isCn =
            (callee.type === "Identifier" && callee.name === "cn") ||
            (callee.type === "MemberExpression" &&
              callee.property &&
              callee.property.name === "cn");
          if (!isCn) return;
          for (const arg of expr.arguments) {
            if (arg.type === "Literal") {
              check(node, arg.value);
            } else if (arg.type === "TemplateLiteral") {
              check(node, arg.quasis.map((q) => q.value.raw).join(" "));
            }
          }
        }
      },
    };
  },
};
