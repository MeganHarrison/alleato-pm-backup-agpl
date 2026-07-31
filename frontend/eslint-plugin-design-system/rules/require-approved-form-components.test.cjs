const { RuleTester } = require("eslint");
const rule = require("./require-approved-form-components");

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

tester.run("require-approved-form-components", rule, {
  valid: [
    {
      filename: "/repo/frontend/src/app/(main)/project/page.tsx",
      code: `
        import { Input } from "@/components/ui/input";
        export function Toolbar() {
          return <Input placeholder="Search projects" />;
        }
      `,
    },
    {
      filename: "/repo/frontend/src/app/(main)/project/page.tsx",
      code: `
        import { NumberInput } from "@/components/ui/number-input";
        export function InlineEditor() {
          return <NumberInput step="0.01" min="0" value="2" onChange={() => {}} />;
        }
      `,
    },
    {
      filename: "/repo/frontend/src/app/(main)/project/page.tsx",
      code: `
        import { MoneyField } from "@/components/forms/MoneyField";
        export function InlineMoney() {
          return <MoneyField label="Amount" inline value={2} onChange={() => {}} />;
        }
      `,
    },
  ],
  invalid: [
    {
      filename: "/repo/frontend/src/app/(main)/project/page.tsx",
      code: `
        import { Input } from "@/components/ui/input";
        export function InlineEditor() {
          return <Input type="number" step="0.01" value="2" onChange={() => {}} />;
        }
      `,
      errors: [{ messageId: "numericInput" }],
    },
    {
      filename: "/repo/frontend/src/app/(main)/project/page.tsx",
      code: `
        import { Input } from "@/components/ui/input";
        export function InlineEditor() {
          return <Input inputMode="decimal" value="2" onChange={() => {}} />;
        }
      `,
      errors: [{ messageId: "numericInput" }],
    },
    {
      filename: "/repo/frontend/src/app/(main)/project/form.tsx",
      code: `
        import { useForm } from "react-hook-form";
        import { Input } from "@/components/ui/input";
        export function ExampleForm() {
          useForm();
          return <Input value="" onChange={() => {}} />;
        }
      `,
      errors: [{ messageId: "inputInForm" }],
    },
  ],
});
