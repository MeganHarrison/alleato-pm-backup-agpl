import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface BudgetAddLineItemData extends TutorialSeedData {
  projectId: number;
  submitWorkflow: boolean;
  qty: string;
  uom: string;
  unitCost: string;
  amount: string;
}

export default defineTutorial<BudgetAddLineItemData>({
  id: "budget.budget-add-line-item",
  title: "Add a budget line item",
  module: "budget",
  slug: "budget-add-line-item",
  description:
    "Add one or more line items to an existing project budget, recording each step as screenshots, Markdown, and manifest data.",
  dataPath: "./budget-add-line-item.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const budgetRoute = `/${data.projectId}/budget`;
    const createRoute = `/${data.projectId}/budget/line-item/new`;

    await tutorial.step(
      {
        title: "Open the Budget",
        instruction:
          "Select the project in the header, then open Budget from the project sidebar.",
        expected: "The budget table loads, grouped by cost code and category.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'a[href$="/budget"]',
      },
      async () => {
        await tutorial.goto(budgetRoute);
        await tutorial.requireUrl(budgetRoute, "Open the Budget");
      },
    );

    await tutorial.step(
      {
        title: "Start a new line item",
        instruction:
          "Open the Create menu in the budget header and choose Budget Line Item. If the budget is locked, unlock it first — line items cannot be added while the budget is locked.",
        expected:
          "The Create Budget Line Items page opens with an empty line item row.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'form, [name="budget_code_id"]',
      },
      async () => {
        await tutorial.goto(createRoute);
        await tutorial.requireUrl("/budget/line-item/new", "Start a new line item");
      },
    );

    await tutorial.step(
      {
        title: "Select the Budget Code",
        instruction:
          "In the Budget Code column, pick a budget code from the project's list. If the code you need is not there, choose to create a new one and select a Cost Code and Cost Type in the Create New Budget Code dialog.",
        expected: "The selected budget code appears in the row.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[role="combobox"], [data-slot="select-trigger"]',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/budget code|cost code/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Enter the amounts",
        instruction:
          "Fill in Qty, UOM, and Unit Cost for the row. The Amount is calculated automatically from quantity times unit cost, and can be overridden directly.",
        expected: "The Amount field reflects the entered values and is non-zero.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name*="amount" i], [name*="unit_cost" i]',
      },
      async () => {
        await tutorial.fillByLabel(/qty|quantity/i, data.qty).catch(() => undefined);
        await tutorial.fillByLabel(/uom|unit of measure/i, data.uom).catch(() => undefined);
        await tutorial.fillByLabel(/unit cost/i, data.unitCost).catch(() => undefined);
        await tutorial.fillByLabel(/^amount/i, data.amount).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Add more rows if needed",
        instruction:
          "Select Add Row to add additional line items, and repeat the budget code and amount entry for each. Each row needs a budget code and a non-zero amount.",
        expected: "One row exists per line item you intend to create.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Add Row")',
      },
      async () => {
        await tutorial.clickByRole(/add row/i).catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Create the line items",
        instruction:
          "Select the Create … Line Items button to submit. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The line items are saved and you return to the Budget table, where the new lines appear with their cost codes and amounts."
          : "The completed draft is ready to submit without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Create"), button:has-text("Line Item")',
      },
      async () => {
        if (data.submitWorkflow) {
          await tutorial.clickByRole(/create .*line item/i).catch(() => undefined);
        }
      },
    );
  },
});
