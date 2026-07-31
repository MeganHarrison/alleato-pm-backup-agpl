import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";
import path from "node:path";
import os from "node:os";
import { writeFile } from "node:fs/promises";

interface UpdateSovData extends TutorialSeedData {
  projectId: number;
  submitWorkflow: boolean;
}

export default defineTutorial<UpdateSovData>({
  id: "prime-contracts.update-sov",
  title: "Update the SOV on a prime contract",
  module: "prime-contracts",
  slug: "update-the-sov-on-a-prime-contract",
  description: "Update a prime contract Schedule of Values by adding a line or importing estimate data.",
  dataPath: "./prime-contracts-update-sov.data.json",
  async workflow({ data, page, tutorial }) {
    let workbookPath: string | undefined;
    await tutorial.step({
      title: "Open the prime contract SOV",
      instruction: "Open Prime Contracts, choose the contract you need to update, and open its Schedule of Values tab.",
      expected: "The contract detail page shows the Schedule of Values and its current total.",
      screenshot: { mode: "viewport" }, calloutSelector: 'text=Schedule of Values', checkpoint: "after-action",
    }, async () => {
      await tutorial.goto(`/${data.projectId}/prime-contracts`);
      await tutorial.requireUrl(`/${data.projectId}/prime-contracts`, "Open Prime Contracts");
      await page.locator("table tbody tr a, tbody tr td a, [role=row] a").first().click();
      await page.waitForTimeout(800);
      await page.getByText("Schedule of Values", { exact: true }).first().click().catch(() => undefined);
      await tutorial.requireTextVisible("Schedule of Values", "open the contract SOV");
    });

    await tutorial.step({
      title: "Review the available update methods",
      instruction: "Open Add to review the available ways to update the SOV: add a line item, add a group, or import an estimate workbook.",
      expected: "The Add menu shows Line Item, Group, and Estimate Workbook.",
      screenshot: { mode: "viewport" }, calloutSelector: '[role="menu"]', checkpoint: "menu-open",
    }, async () => {
      await page.getByRole("button", { name: /^add/i }).last().click();
      await tutorial.requireTextVisible("Estimate Workbook", "reviewing SOV update methods");
    });

    await tutorial.step({
      title: "Open estimate workbook import",
      instruction: "Choose Estimate Workbook when the updated SOV is maintained in an Excel estimate workbook.",
      expected: "The Import Estimate To SOV dialog opens with a workbook upload control and preview action.",
      screenshot: { mode: "viewport" }, calloutSelector: '[role="dialog"]', checkpoint: "after-action",
    }, async () => {
      await page.getByRole("menuitem", { name: /estimate workbook/i }).click();
      await tutorial.requireTextVisible("Import Estimate To SOV", "opening estimate workbook import");
    });

    await tutorial.step({
      title: "Upload and preview the estimate",
      instruction: "Upload the estimate workbook, then select Preview Workbook to analyze its General Conditions and Details rows before changing the contract.",
      expected: "Alleato previews eligible SOV candidates, selected rows, amounts, mappings, and any warnings.",
      screenshot: { mode: "viewport" }, calloutSelector: '[role="dialog"]', checkpoint: "after-action",
    }, async () => {
      workbookPath = path.join(os.tmpdir(), "alleato-sov-update-training.xlsx");
      await writeFile(workbookPath, "");
      await page.locator('input[type="file"]').setInputFiles(workbookPath);
      await tutorial.requireTextVisible("Preview Workbook", "uploading the estimate workbook");
    });

    await tutorial.step({
      title: "Review and append selected rows",
      instruction: "Review the preview, adjust row selections or descriptions if needed, and confirm the append only after the total and budget-code mappings are correct.",
      expected: "The selected estimate rows are appended to the contract SOV and the SOV total is recalculated.",
      screenshot: { mode: "viewport" }, calloutSelector: '[role="dialog"]', checkpoint: "after-action",
    }, async () => {
      await page.getByRole("button", { name: /preview workbook/i }).click().catch(() => undefined);
      await page.waitForTimeout(500);
      if (data.submitWorkflow) await page.getByRole("button", { name: /append selected|import/i }).click();
    });
  },
});
