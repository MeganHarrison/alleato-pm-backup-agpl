import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface BudgetForecastData extends TutorialSeedData {
  projectId: number;
  submitWorkflow: boolean;
  forecastAmount: string;
  notes: string;
}

export default defineTutorial<BudgetForecastData>({
  id: "budget.budget-forecast",
  title: "Forecast a budget line",
  module: "budget",
  slug: "budget-forecast",
  description:
    "Set a budget line's forecast-to-complete using the automatic, lump-sum, manual, or monitored-resources method, recording each step as screenshots, Markdown, and manifest data.",
  dataPath: "./budget-forecast.data.json",
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
        expected:
          "The budget table loads with its line items and the Forecast to Complete column.",
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
        title: "Open the line's forecast",
        instruction:
          "On the budget line you want to forecast, open its Forecast To Complete.",
        expected: "The Forecast To Complete dialog opens for that line.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Forecast"), [aria-label*="forecast" i]',
      },
      async () => {
        await page
          .getByRole("button", { name: /forecast/i })
          .first()
          .click()
          .catch(() => undefined);
        await page
          .getByText(/forecast/i)
          .first()
          .click()
          .catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Choose a forecast method",
        instruction:
          "Select one of the methods: Automatic Calculation (Projected Budget minus Projected Costs), Lump Sum Entry (a fixed amount to complete), Manual Entry (build the forecast from editable line items), or Monitored Resources (track time-phased resources with drawdown).",
        expected: "The editor shows the inputs for the method you selected.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[role="combobox"], [data-slot="select-trigger"], [role="radiogroup"]',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/method|forecast/i).catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Enter the forecast detail",
        instruction:
          "For Lump Sum Entry, enter the Forecast Amount. For Manual Entry or Monitored Resources, add and complete the forecast line items. Automatic Calculation needs no manual input.",
        expected:
          "The Forecast To Complete total at the bottom of the dialog updates to match your entries.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name*="forecast" i], [name*="amount" i]',
      },
      async () => {
        await tutorial.fillByLabel(/forecast amount|amount/i, data.forecastAmount).catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Add notes (optional)",
        instruction: "Use the Notes field to add context for this forecast.",
        expected: "Your note is captured with the forecast.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name*="notes" i]',
      },
      async () => {
        await tutorial.fillByLabel(/notes/i, data.notes).catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Save the forecast",
        instruction:
          "Select Save. Saving the forecast requires Budget Write permission and an unlocked budget. Tutorial runs default to preview mode unless submitWorkflow is true.",
        expected: data.submitWorkflow
          ? "The line's forecast method and Forecast to Complete are saved, and the budget table reflects the updated forecast."
          : "The completed forecast is ready to save without creating demo data.",
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
