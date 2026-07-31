import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface AddSovData extends TutorialSeedData {
  projectId: number;
  sovAmount: string;
  sovDescription: string;
  submitWorkflow: boolean;
}

export default defineTutorial<AddSovData>({
  id: "commitments.add-sov",
  title: "Add a schedule of values (SOV)",
  module: "commitments",
  slug: "commitments-add-sov",
  description:
    "Add, edit, reorder, and save the schedule-of-values line items that break a commitment into billable amounts.",
  dataPath: "./commitments-add-sov.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const listRoute = `/${data.projectId}/commitments`;

    await tutorial.step(
      {
        title: "Open the commitment",
        instruction:
          "Open the commitment from the Commitments list, then open its General tab (or the SOV / PO SOV tab) where the Schedule of Values section appears.",
        expected:
          "The Schedule of Values table is visible with its existing line items and totals.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Schedule of Values',
      },
      async () => {
        await tutorial.goto(listRoute);
        await tutorial.requireUrl(listRoute, "Open the commitment");
        await page
          .locator("table tbody tr a, tbody tr td a, [role=row] a")
          .first()
          .click()
          .catch(() => undefined);
        await page.waitForTimeout(800);
      },
    );

    await tutorial.step(
      {
        title: "Confirm you can edit",
        instruction:
          "SOV line items are editable at any time unless the commitment's status is Approved. If the commitment is Approved, the schedule of values is locked and the edit actions are hidden.",
        expected:
          "The Add Line Item action is available for an unapproved commitment, or a locked message shows for an Approved one.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Add Line Item")',
      },
      async () => {
        await page
          .getByText(/schedule of values/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Add line items",
        instruction:
          "Select Add Line Item to append a new row, then fill in Budget Code, Description, and Amount. When the commitment uses unit/quantity accounting, enter Qty, UOM, and Unit Cost instead — the Amount is calculated for you. To pull every budget line in at once, use Import from Budget.",
        expected:
          "New rows appear in the table and the Totals and summary rows (Subtotal, Contract Total, Amount Remaining) recalculate as you type.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Add Line Item"), button:has-text("Import from Budget")',
      },
      async () => {
        await page
          .getByRole("button", { name: /add line item/i })
          .first()
          .click()
          .catch(() => undefined);
        await page.getByLabel(/description/i).last().fill(data.sovDescription).catch(() => undefined);
        await page.getByLabel(/amount/i).last().fill(data.sovAmount).catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Assign a budget code to each line",
        instruction:
          "For each line, select a budget code in the Budget Code column. If the code you need does not exist, use the create-new option to add it without leaving the table.",
        expected:
          "Every line is mapped to a valid budget code, with no unmapped-code warning on the row.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Budget Code',
      },
      async () => {
        await tutorial.selectFirstComboboxOption(/budget code|cost code/i);
      },
    );

    await tutorial.step(
      {
        title: "Reorder lines if needed",
        instruction:
          "Use the up and down arrows on a row to move it. Line numbers renumber automatically to match the new order.",
        expected: "Lines appear in the intended order with sequential numbering.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Schedule of Values',
      },
      async () => {
        await page
          .getByText(/schedule of values/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Note locked (invoiced) lines",
        instruction:
          "A line that has already been billed shows a lock icon and cannot have its amount changed or be deleted. Remove the related invoice first if the line must change.",
        expected: "Invoiced lines stay protected; only un-billed lines remain editable.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Schedule of Values',
      },
      async () => {
        await page
          .getByText(/schedule of values/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Save the changes",
        instruction: "When there are unsaved edits, select Save Changes.",
        expected:
          "A confirmation appears and the saved line items, totals, and summary values persist on the commitment.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'button:has-text("Save Changes")',
      },
      async () => {
        if (data.submitWorkflow) {
          await page
            .getByRole("button", { name: /save changes/i })
            .first()
            .click()
            .catch(() => undefined);
        }
      },
    );
  },
});
