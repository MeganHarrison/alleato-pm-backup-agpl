import { defineTutorial, type TutorialSeedData } from "../tutorial-recorder";

interface EditCommitmentData extends TutorialSeedData {
  description: string;
  projectId: number;
  retainage: string;
  submitWorkflow: boolean;
  title: string;
}

export default defineTutorial<EditCommitmentData>({
  id: "commitments.edit",
  title: "Edit a commitment",
  module: "commitments",
  slug: "commitments-edit",
  description:
    "Update a commitment's fields, dates, retainage, attachments, and visibility settings.",
  dataPath: "./commitments-edit.data.json",
  maskSelectors: [
    '[data-sensitive="true"]',
    '[name*="email" i]',
    '[name*="phone" i]',
  ],
  async workflow({ data, page, tutorial }) {
    const listRoute = `/${data.projectId}/commitments`;

    await tutorial.step(
      {
        title: "Open the commitment to edit",
        instruction:
          "Open the commitment record. You can change most fields inline on the General tab, or open the full edit form from the more-actions menu via Edit.",
        expected: "The commitment detail page or the edit form is open.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=General',
      },
      async () => {
        await tutorial.goto(listRoute);
        await tutorial.requireUrl(listRoute, "Open the commitment to edit");
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
        title: "Edit fields inline on the detail page",
        instruction:
          "On the General tab, edit a field in place — such as Title, Status, Contract Date, Start Date, Signed Date, Issued On, Actual Completion, Default Retainage, or Executed. Each inline edit saves on its own.",
        expected: "The edited value saves and the page refreshes to show it.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=General',
      },
      async () => {
        await page
          .getByText(/general/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Update header fields in the edit form",
        instruction:
          "In the full edit form, update General Information (Title, Contract #, Contract Company, Status), retainage, the Executed flag, and the Description as needed.",
        expected: "The header fields reflect the updated values.",
        screenshot: { mode: "viewport" },
        calloutSelector: '[name="title"], text=General Information',
      },
      async () => {
        await tutorial.fillByLabel(/^title/i, data.title);
        await tutorial.fillByLabel(/retainage|retention/i, data.retainage);
        await tutorial.fillByLabel(/description/i, data.description);
      },
    );

    await tutorial.step(
      {
        title: "Adjust dates and scope",
        instruction:
          "Update the Contract Dates and the Inclusions + Exclusions to match the current agreement.",
        expected: "Dates and scope notes are current.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Contract Dates, text=Inclusions',
      },
      async () => {
        await page
          .getByText(/contract dates|inclusions/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Manage attachments",
        instruction: "In Attachments, add or remove supporting files for the commitment.",
        expected: "The attachment list matches the supporting documents on file.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Attachments, input[type="file"]',
      },
      async () => {
        await page
          .getByText(/attachments/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Review the schedule of values",
        instruction:
          "Confirm the Schedule of Values line items and amounts still reflect the contract. Note that an Approved commitment locks its SOV, and any invoiced line is locked individually.",
        expected:
          "The SOV is correct, or you proceed through a change order if the commitment is already executed.",
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
        title: "Set privacy and invoice contacts",
        instruction:
          "Review the Privacy setting and Invoice Contacts so visibility and billing routing are correct.",
        expected: "Visibility and invoice contacts are set as intended.",
        screenshot: { mode: "viewport" },
        calloutSelector: 'text=Privacy, text=Invoice Contacts',
      },
      async () => {
        await page
          .getByText(/privacy|invoice contacts/i)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
      },
    );

    await tutorial.step(
      {
        title: "Save the changes",
        instruction:
          "Select Save Changes in the edit form (inline edits on the detail page save automatically).",
        expected: "A confirmation appears and the updated commitment persists.",
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
