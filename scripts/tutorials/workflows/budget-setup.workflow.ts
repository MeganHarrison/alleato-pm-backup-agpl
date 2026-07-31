import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface BudgetSetupData extends TutorialSeedData {
  projectId: number;
  submitWorkflow: boolean;
  qty: string;
  uom: string;
  unitCost: string;
}

export default defineTutorial<BudgetSetupData>({
  id: "budget.budget-setup",
  title: "Set up the project budget",
  module: "budget",
  slug: "budget-setup",
  description:
    "Build the initial budget by selecting cost codes and entering amounts for each line, recording each step as screenshots, Markdown, and manifest data.",
  dataPath: "./budget-setup.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const setupRoute = `/${data.projectId}/budget/setup`;

    await tutorial.step(
      {
        title: "Open budget setup",
        instruction:
          "From the project, go to the budget setup page. The Add Budget Line Items page loads the project's active cost codes.",
        expected:
          "The setup page opens with an empty line item row and the project's cost codes available.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'form, [name="budget_code_id"]',
      },
      async () => {
        await tutorial.goto(setupRoute);
        await tutorial.requireUrl("/budget/setup", "Open budget setup");
      },
    );

    await tutorial.step(
      {
        title: "Select a budget code",
        instruction:
          "In the first row, select a budget code from the project's active cost codes. If the code you need does not exist, create a new budget code and it becomes available for selection.",
        expected: "The chosen budget code appears in the row.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[role="combobox"], [data-slot="select-trigger"]',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/budget code|cost code/i).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Enter the line amounts",
        instruction:
          "Fill in the quantity, unit of measure, and unit cost for the row. The amount is calculated automatically from quantity times unit cost.",
        expected: "The row shows an amount based on your entries.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name*="unit_cost" i], [name*="amount" i]',
      },
      async () => {
        await tutorial.fillByLabel(/qty|quantity/i, data.qty).catch(() => undefined);
        await tutorial.fillByLabel(/uom|unit of measure/i, data.uom).catch(() => undefined);
        await tutorial.fillByLabel(/unit cost/i, data.unitCost).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Add a row for each budget line",
        instruction:
          "Select Add Row and repeat budget-code selection and amount entry for every cost line the budget should contain.",
        expected:
          "One row exists for each budget line, each with a selected budget code.",
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
        title: "Create the budget lines",
        instruction:
          "Select the Create … Line Item(s) button to submit. Every row must have a budget code selected, and every selected code must have a cost type. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The budget lines are created and you return to the Budget table showing the new lines."
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
