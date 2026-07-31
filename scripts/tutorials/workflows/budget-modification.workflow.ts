import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface BudgetModificationData extends TutorialSeedData {
  projectId: number;
  submitWorkflow: boolean;
  amount: string;
  notes: string;
}

export default defineTutorial<BudgetModificationData>({
  id: "budget.budget-modification",
  title: "Create a budget modification",
  module: "budget",
  slug: "budget-modification",
  description:
    "Record a budget modification that transfers money between budget lines without changing the contract value, recording each step as screenshots, Markdown, and manifest data.",
  dataPath: "./budget-modification.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const budgetRoute = `/${data.projectId}/budget`;

    await tutorial.step(
      {
        title: "Open the Budget",
        instruction:
          "Select the project, then open Budget from the project sidebar.",
        expected: "The budget table loads with its line items.",
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
        title: "Open Add Budget Modification",
        instruction: "Select Add Budget Modification in the budget header.",
        expected:
          "The Add Budget Modification dialog opens with a single transfer row.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Add Budget Modification")',
      },
      async () => {
        await page
          .getByRole("button", { name: /add budget modification/i })
          .first()
          .click()
          .catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Choose the From and To lines",
        instruction:
          "In the row, set From to the budget line giving up money and To to the budget line receiving it. The From and To lines must be different.",
        expected: "Both line items are selected and differ from each other.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[role="combobox"], [data-slot="select-trigger"]',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/from/i).catch(() => undefined);
        await tutorial.selectFirstComboboxOption(/to/i).catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Enter the amount and notes",
        instruction:
          "Enter the transfer Amount (greater than zero) and add Notes describing the reason for the modification.",
        expected: "The amount and notes are filled in for the row.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name*="amount" i], [name*="notes" i]',
      },
      async () => {
        await tutorial.fillByLabel(/^amount/i, data.amount).catch(() => undefined);
        await tutorial.fillByLabel(/notes/i, data.notes).catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Add more transfers if needed",
        instruction:
          "Select Add Additional Modifications to add more transfer rows, and complete From, To, Amount, and Notes for each.",
        expected: "Every row has a valid From, To, and amount.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Add Additional Modifications")',
      },
      async () => {
        await page
          .getByRole("button", { name: /add additional modifications/i })
          .first()
          .click()
          .catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Save the modification",
        instruction:
          "Select Save. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The budget modification is created as a draft. Only approved modifications change the Revised Budget — the draft must still be approved to take effect."
          : "The completed draft is ready to save without creating demo data.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Save")',
      },
      async () => {
        if (data.submitWorkflow) {
          await tutorial.clickByRole(/^save$/i).catch(() => undefined);
        }
      },
    );
  },
});
