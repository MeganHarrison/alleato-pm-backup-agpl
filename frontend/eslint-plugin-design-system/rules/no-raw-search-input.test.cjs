const { RuleTester } = require("eslint");
const rule = require("./no-raw-search-input");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

tester.run("no-raw-search-input", rule, {
  valid: [
    {
      filename:
        "/repo/frontend/src/app/(main)/comments/page.tsx",
      code: `
        import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
        export function CommentsToolbar() {
          return <ExpandableSearch value="" onChange={() => {}} placeholder="Search comments" />;
        }
      `,
    },
    {
      filename:
        "/repo/frontend/src/components/tables/unified/expandable-search.tsx",
      code: `
        import { Input } from "@/components/ui/input";
        export function ExpandableSearch() {
          return <Input placeholder="Search table" />;
        }
      `,
    },
  ],
  invalid: [
    {
      filename:
        "/repo/frontend/src/app/(main)/comments/page.tsx",
      code: `
        import { ExpandingSearch } from "@/components/ds";
        export function CommentsToolbar() {
          return <ExpandingSearch value="" onChange={() => {}} placeholder="Search comments" />;
        }
      `,
      errors: [{ messageId: "expandingSearch" }],
    },
    {
      filename:
        "/repo/frontend/src/app/(main)/comments/page.tsx",
      code: `
        import { Input } from "@/components/ui/input";
        export function CommentsToolbar() {
          return <Input placeholder="Search comments" />;
        }
      `,
      errors: [{ messageId: "rawSearchInput" }],
    },
  ],
});
